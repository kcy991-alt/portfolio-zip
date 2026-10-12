"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-context";

/** 사이드바 아래의 계정 표시. 로그인했으면 이메일과 로그아웃, 아니면 둘러보는 중임을 알리고 로그인 링크를 보여 준다. */
export function AccountBox() {
  const { status, email } = useAuth();

  return (
    <div className="mt-auto border-t border-line pt-4 text-sm">
      {status === "signedIn" ? (
        <>
          <p className="truncate text-muted" title={email ?? undefined}>
            {email ?? "로그인했어요"}
          </p>
          <form action="/auth/signout" method="post" className="mt-2">
            <button type="submit" className="min-h-11 w-full rounded-control border border-line px-3 text-left hover:bg-canvas">
              로그아웃
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="text-muted">{status === "loading" ? "확인하는 중…" : "로그인 없이 써 보는 중 · 저장되지 않아요"}</p>
          <Link
            href="/auth"
            className="mt-2 flex min-h-11 items-center rounded-control bg-accent-soft px-3 font-medium text-accent hover:bg-accent-soft-hover"
          >
            로그인하고 저장하기
          </Link>
        </>
      )}
    </div>
  );
}
