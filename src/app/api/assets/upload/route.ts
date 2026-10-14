import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, isUuid } from "@/lib/api/server";
import { checkProjectLimits, MAX_ACCOUNT_BYTES, REPRESENTATIVE } from "@/lib/storage/asset-limits";
import { InvalidImageError, processImage } from "@/lib/storage/process-image";
import { SECTION_KEYS as ANSWER_SECTION_KEYS } from "@/lib/validation/project-answers";

// 런타임은 지정하지 않는다(기본 Node.js). sharp는 Node.js에서만 동작한다.
// Vercel 함수는 요청 본문이 4.5MB를 넘으면 앱 코드에 닿기 전에 거절한다. 여유를 두고 4MB로 제한한다.
// 브라우저가 올리기 전에 이 크기 안으로 줄여서 보낸다 (src/lib/storage/client-compress.ts).
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;

const SECTION_KEYS = new Set<string>([...ANSWER_SECTION_KEYS, REPRESENTATIVE]);

/**
 * 이미지를 올리고 프로젝트의 한 구역에 붙인다 (spec F06).
 * 폼 필드: file(이미지), project_id(프로젝트), section_key(구역. 대표 이미지는 "representative"),
 * operation_id(선택. 같은 번호로 다시 보내면 새로 만들지 않고 처음 결과를 돌려준다 — 네트워크 재시도용)
 */
export async function POST(request: NextRequest) {
  const auth = await getAuthed(request, "upload");
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_REQUEST_BYTES + 64 * 1024) {
    return fail(413, "too_large", "이미지가 너무 커요. 4MB 이하로 줄여서 올려 주세요.");
  }

  let file: File | null = null;
  let projectId = "";
  let sectionKey = "";
  let operationId = "";
  try {
    const form = await request.formData();
    const value = form.get("file");
    file = value instanceof File ? value : null;
    projectId = String(form.get("project_id") ?? "");
    sectionKey = String(form.get("section_key") ?? "");
    operationId = String(form.get("operation_id") ?? "");
  } catch {
    return fail(400, "invalid_body", "업로드 형식이 올바르지 않아요.");
  }
  if (!file) return fail(400, "missing_file", "올릴 파일을 선택해 주세요.");
  if (!isUuid(projectId) || !SECTION_KEYS.has(sectionKey)) {
    return fail(400, "invalid_target", "이미지를 붙일 프로젝트와 구역을 확인해 주세요.");
  }
  if (file.size > MAX_REQUEST_BYTES) {
    return fail(413, "too_large", "이미지가 너무 커요. 4MB 이하로 줄여서 올려 주세요.");
  }
  if (operationId && !isUuid(operationId)) return fail(400, "invalid_operation", "요청 번호가 올바르지 않아요.");

  // 같은 작업 번호가 이미 있으면: 끝났다면 처음 결과를 그대로, 아직 처리 중이면 잠시 뒤 다시 시도하라고 알린다
  if (operationId) {
    const { error: claimError } = await supabase.from("client_operation").insert({ owner_id: user.id, operation_id: operationId });
    if (claimError) {
      const { data: prior } = await supabase.from("client_operation").select("result").eq("operation_id", operationId).maybeSingle();
      if (prior?.result) return ok(prior.result, { status: 200 });
      return fail(409, "operation_in_progress", "같은 이미지를 처리하는 중이에요. 잠시 뒤 다시 확인해 주세요.");
    }
  }
  const releaseOperation = async () => {
    if (operationId) await supabase.from("client_operation").delete().eq("operation_id", operationId);
  };

  // 내 프로젝트인지 확인한다 (RLS 덕분에 남의 프로젝트는 보이지 않는다)
  const { data: project } = await supabase.from("project").select("id, workspace_id").eq("id", projectId).is("deleted_at", null).maybeSingle();
  if (!project) { await releaseOperation(); return fail(404, "not_found", "프로젝트를 찾을 수 없어요."); }

  let image;
  try {
    image = await processImage(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    if (e instanceof InvalidImageError) { await releaseOperation(); return fail(415, "unsupported_image", e.message); }
    await releaseOperation();
    return fail(500, "process_failed", "이미지를 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  }

  // 한도 확인: 프로젝트(개수·용량)와 계정(용량)
  const { data: links, error: linksError } = await supabase.from("project_asset").select("asset_id, section_key, sort_order").eq("project_id", projectId);
  if (linksError) { await releaseOperation(); return fail(500, "usage_failed", "저장 용량을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요."); }

  const ids = (links ?? []).map((l) => l.asset_id);
  const { data: linkedAssets } = ids.length ? await supabase.from("asset").select("id, bytes").in("id", ids) : { data: [] };
  const bytesById = new Map((linkedAssets ?? []).map((a) => [a.id, a.bytes]));
  const limitError = checkProjectLimits(
    (links ?? []).map((l) => ({ section_key: l.section_key, bytes: bytesById.get(l.asset_id) ?? 0 })),
    sectionKey,
    image.bytes,
  );
  if (limitError) { await releaseOperation(); return fail(413, limitError.code, limitError.message); }

  const { data: usageRows, error: usageError } = await supabase.from("asset").select("bytes").is("deleted_at", null);
  if (usageError) { await releaseOperation(); return fail(500, "usage_failed", "저장 용량을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요."); }
  const used = (usageRows ?? []).reduce((sum, r) => sum + r.bytes, 0);
  if (used + image.bytes > MAX_ACCOUNT_BYTES) {
    await releaseOperation();
    return fail(413, "quota_exceeded", "저장 공간이 부족해요. 쓰지 않는 이미지를 지우고 다시 시도해 주세요.");
  }

  const assetId = randomUUID();
  const storagePath = `${user.id}/${assetId}.${image.ext}`;

  const { error: uploadError } = await supabase.storage
    .from("portfolio-assets")
    .upload(storagePath, image.buffer, { contentType: image.mime, upsert: false });
  if (uploadError) { await releaseOperation(); return fail(500, "upload_failed", "이미지를 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요."); }

  const { error: assetError } = await supabase.from("asset").insert({
    id: assetId,
    owner_id: user.id,
    workspace_id: project.workspace_id,
    storage_path: storagePath,
    mime: image.mime,
    bytes: image.bytes,
    width: image.width,
    height: image.height,
  });
  if (assetError) {
    await supabase.storage.from("portfolio-assets").remove([storagePath]);
    await releaseOperation();
    return fail(500, "register_failed", "이미지를 등록하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  }

  const sortOrder = Math.max(-1, ...(links ?? []).filter((l) => l.section_key === sectionKey).map((l) => l.sort_order)) + 1;
  const { data: link, error: linkError } = await supabase
    .from("project_asset")
    .insert({ owner_id: user.id, project_id: projectId, asset_id: assetId, section_key: sectionKey, sort_order: sortOrder })
    .select("id")
    .single();
  if (linkError) {
    // 파일과 asset만 남지 않도록 방금 만든 것을 되돌린다. 이 정리까지 실패하면 이후 서버 정리 작업(D6) 대상이다.
    await supabase.from("asset").delete().eq("id", assetId);
    await supabase.storage.from("portfolio-assets").remove([storagePath]);
    await releaseOperation();
    return fail(500, "register_failed", "이미지를 붙이지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  }

  const result = { id: link.id, asset_id: assetId, mime: image.mime, bytes: image.bytes, width: image.width, height: image.height };
  // 처음 결과를 저장해 두면, 응답이 끊겨 다시 보낸 같은 번호의 요청에 그대로 돌려줄 수 있다
  if (operationId) await supabase.from("client_operation").update({ result }).eq("operation_id", operationId);
  return ok(result, { status: 201 });
}
