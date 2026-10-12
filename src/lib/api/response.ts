import { NextResponse } from "next/server";

// spec 11장: 성공은 { data }, 실패는 { error: { code, message, fieldErrors? } }
export function ok<T>(data: T, init?: { status?: number }) {
  return NextResponse.json({ data }, { status: init?.status ?? 200 });
}

type Extra = { fieldErrors?: Record<string, string[] | undefined>; [key: string]: unknown };

export function fail(status: 400 | 401 | 404 | 409 | 413 | 415 | 429 | 500, code: string, message: string, extra?: Extra) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}
