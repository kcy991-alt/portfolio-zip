import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/api";
import { fail } from "./response";
import { takeRateLimit, type RateBucket } from "./rate-limit";

/**
 * 로그인한 사용자와 그 사용자의 세션으로 동작하는 DB 클라이언트(RLS 적용)를 돌려준다. 로그인하지 않았으면 401 응답을 돌려준다.
 * 요청을 넘기면 읽기(GET)가 아닌 요청에 일반 쓰기 한도(분당 120회)를 적용한다. 업로드처럼 따로 센다면 bucket을 지정한다.
 */
export async function getAuthed(request?: NextRequest, bucket?: RateBucket) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { response: fail(401, "unauthorized", "로그인이 필요해요.") } as const;
  const limitBucket = bucket ?? (request && request.method !== "GET" ? "write" : null);
  if (limitBucket) {
    const limited = await takeRateLimit(supabase, limitBucket);
    if (limited) return { response: limited } as const;
  }
  return { supabase, user: data.user } as const;
}

/** 요청 본문을 JSON으로 읽고 검사한다. 문제가 있으면 400 응답을 돌려준다. */
export async function parseBody<T extends z.ZodType>(request: NextRequest, schema: T) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { response: fail(400, "invalid_body", "요청 형식이 올바르지 않아요.") } as const;
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    // 어느 항목이 왜 거절됐는지 서버 기록에 남긴다. 입력한 값(내용)은 기록하지 않고 위치와 사유만 남긴다.
    console.warn(
      "[validation_failed]",
      request.method,
      request.nextUrl.pathname,
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
    const { fieldErrors, formErrors } = z.flattenError(parsed.error);
    const first = formErrors[0] ?? Object.values(fieldErrors).flat()[0] ?? "입력한 내용을 확인해 주세요.";
    return { response: fail(400, "validation_failed", String(first), { fieldErrors }) } as const;
  }
  return { data: parsed.data as z.infer<T> } as const;
}

/** 경로의 id가 UUID가 아니면 404로 답한다(존재 여부를 알려 주지 않는다). */
export function isUuid(value: string) {
  return uuidSchema.safeParse(value).success;
}

export const notFound = (what: string) => fail(404, "not_found", `${what}을(를) 찾을 수 없어요.`);
