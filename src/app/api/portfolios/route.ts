import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, parseBody } from "@/lib/api/server";
import { createPortfolioBodySchema } from "@/lib/validation/portfolio";

// 제작본 목록(S04). 프로젝트 개수를 함께 준다.
export async function GET() {
  const auth = await getAuthed();
  if ("response" in auth) return auth.response;

  const { data, error } = await auth.supabase
    .from("portfolio")
    .select("id, title, revision, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) return fail(500, "list_failed", "포트폴리오를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");

  const ids = (data ?? []).map((p) => p.id);
  const { data: copies } = ids.length ? await auth.supabase.from("portfolio_project").select("portfolio_id").in("portfolio_id", ids) : { data: [] };
  const counts = new Map<string, number>();
  for (const c of copies ?? []) counts.set(c.portfolio_id, (counts.get(c.portfolio_id) ?? 0) + 1);

  return ok((data ?? []).map((p) => ({ ...p, project_count: counts.get(p.id) ?? 0 })));
}

// 제작본을 만들고 표지·Summary·프로필 페이지를 함께 만든다 (DB 함수가 한 번에 처리)
export async function POST(request: NextRequest) {
  const auth = await getAuthed(request);
  if ("response" in auth) return auth.response;
  const body = await parseBody(request, createPortfolioBodySchema);
  if ("response" in body) return body.response;

  const { data, error } = await auth.supabase.rpc("create_portfolio", { p_title: body.data.title });
  if (error || !data) return fail(500, "create_failed", "포트폴리오를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  return ok({ id: data as string, title: body.data.title }, { status: 201 });
}
