"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { startGoogleSignIn } from "@/lib/auth/google";

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.1 7-10.2 7-17.6Z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1Z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48Z" />
    </svg>
  );
}

const ERRORS: Record<string, string> = {
  cancelled: "로그인을 취소했거나 완료하지 못했어요. 다시 시도해 주세요.",
  failed: "로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
};

export function AuthCard() {
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const errorKey = params.get("error");
  const message = startError ?? (errorKey ? (ERRORS[errorKey] ?? ERRORS.failed) : null);

  const signIn = async () => {
    setLoading(true);
    setStartError(null);
    const { error } = await startGoogleSignIn();
    // 성공하면 Google 화면으로 이동하므로 여기까지 오는 경우는 시작에 실패했을 때뿐이다.
    if (error) {
      setStartError(error);
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 w-full max-w-md rounded-card border border-line bg-panel p-6 shadow-card sm:p-8">
      <h1 className="text-balance break-keep text-[24px] font-bold leading-[34px] sm:text-[28px] sm:leading-[38px]">portfolio_zip에 오신 것을 환영해요</h1>
      <p className="mt-2 text-balance break-keep text-muted">흩어진 경험을 기록하고, 나만의 포트폴리오로 완성해 보세요.</p>

      <div role="note" className="mt-5 rounded-control bg-accent-soft p-4">
        <p className="font-bold text-accent">현재 테스트 운영 중이에요</p>
        <p className="mt-1 break-keep text-sm leading-6 text-ink/80">일부 계정에서만 로그인할 수 있어요. 로그인하면 작성한 내용이 저장돼요.</p>
      </div>

      {message && (
        <p role="alert" className="mt-4 rounded-control border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {message}
        </p>
      )}

      <button
        type="button"
        onClick={signIn}
        disabled={loading}
        className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-control border border-ink/30 bg-panel px-4 font-semibold shadow-card hover:border-accent hover:shadow-card-hover disabled:cursor-wait disabled:text-muted"
      >
        <GoogleMark />
        {loading ? "Google로 이동하는 중…" : "Google로 시작하기"}
      </button>

      <Link
        href="/workspace"
        className="mt-3 flex min-h-12 w-full items-center justify-center rounded-control border border-accent/40 px-4 font-medium text-accent hover:bg-accent-soft"
      >
        로그인 없이 체험하기
      </Link>

      <ul className="mt-6 space-y-2.5 break-keep text-sm leading-6 text-muted">
        <li>로그인 없이 기능을 체험할 수 있어요. 단, 작성한 내용은 저장되지 않아요.</li>
        <li>Google 계정으로 간편하게 로그인해요. 별도 비밀번호는 필요하지 않으며, 이름과 이메일을 사용해요.</li>
        <li>
          자세한 내용은{" "}
          <Link href="/privacy" className="font-medium text-accent underline underline-offset-2">
            개인정보 처리 안내
          </Link>
          에서 확인할 수 있어요.
        </li>
      </ul>
    </div>
  );
}
