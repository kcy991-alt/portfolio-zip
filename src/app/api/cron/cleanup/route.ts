import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCleanup } from "@/lib/storage/server-cleanup";

// Vercel Cron이 하루 한 번 부른다. CRON_SECRET을 설정해 두면 Vercel이 "Authorization: Bearer <값>"을 붙여 준다.
function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return fail(401, "unauthorized", "허용되지 않은 요청이에요.");
  const admin = createAdminClient();
  if (!admin) return fail(500, "not_configured", "서버 설정이 필요해요.");
  const report = await runCleanup(admin);
  console.info("[cleanup]", JSON.stringify(report)); // 개수만 기록한다
  return ok(report);
}
