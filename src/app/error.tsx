"use client";

import Link from "next/link";
import { useEffect } from "react";

// 예상하지 못한 오류가 나도 빈 화면 대신 안내와 다시 시도 버튼을 보여 준다. 오류 내용(입력한 글 등)은 화면에 내지 않는다.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[ui_error]", error.digest ?? error.name);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-xl font-bold">문제가 생겼어요</h1>
      <p className="text-muted" role="alert">
        화면을 표시하지 못했어요. 저장해 둔 내용은 그대로 있어요. 다시 시도해도 안 되면 새로고침해 주세요.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={reset} className="min-h-11 rounded-control bg-accent px-4 font-semibold text-white hover:bg-accent-hover">
          다시 시도
        </button>
        <Link href="/workspace" className="inline-flex min-h-11 items-center rounded-control border border-line px-4 hover:bg-canvas">
          프로젝트 아카이브로
        </Link>
      </div>
    </main>
  );
}
