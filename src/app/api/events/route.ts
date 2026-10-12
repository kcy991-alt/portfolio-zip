import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, parseBody } from "@/lib/api/server";

// 허용한 이벤트만 기록한다. 내용(문장)은 받지 않고 이름과 대상 id만 남긴다.
const bodySchema = z.object({
  name: z.enum(["preview_opened", "print_requested"]),
  object_id: z.uuid().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await getAuthed(request);
  if ("response" in auth) return auth.response;
  const body = await parseBody(request, bodySchema);
  if ("response" in body) return body.response;

  const { error } = await auth.supabase
    .from("product_event")
    .insert({ owner_id: auth.user.id, name: body.data.name, object_id: body.data.object_id ?? null });
  if (error) return fail(500, "event_failed", "기록하지 못했어요.");
  return ok({ recorded: true }, { status: 201 });
}
