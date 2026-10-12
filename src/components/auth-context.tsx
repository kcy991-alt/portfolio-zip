"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { startGoogleSignIn } from "@/lib/auth/google";
import { createClient } from "@/lib/supabase/client";

type AuthState = { status: "loading" | "guest" | "signedIn"; email: string | null };

type Ctx = AuthState & {
  /** 저장이 필요한 동작 앞에서 부른다. 로그인했으면 true, 아니면 로그인 안내 창을 열고 false를 돌려준다. */
  requireLogin: (reason: string) => boolean;
};

const AuthContext = createContext<Ctx>({ status: "loading", email: null, requireLogin: () => false });

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * 화면 표시용 로그인 상태. 보안 판단에는 쓰지 않는다 — 데이터 접근은 서버 API와 DB(RLS)가 다시 검사한다.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", email: null });
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const apply = (email: string | null | undefined, signedIn: boolean) =>
      setState({ status: signedIn ? "signedIn" : "guest", email: email ?? null });

    supabase.auth.getSession().then(({ data }) => apply(data.session?.user.email, Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user.email, Boolean(session)));
    return () => sub.subscription.unsubscribe();
  }, []);

  const requireLogin = useCallback(
    (why: string) => {
      if (state.status === "signedIn") return true;
      setReason(why);
      return false;
    },
    [state.status],
  );

  return (
    <AuthContext.Provider value={{ ...state, requireLogin }}>
      {children}
      {reason && <LoginPrompt reason={reason} onClose={() => setReason(null)} />}
    </AuthContext.Provider>
  );
}

function LoginPrompt({ reason, onClose }: { reason: string; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const login = async () => {
    setLoading(true);
    const { error: e } = await startGoogleSignIn();
    if (e) {
      setError(e);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="login-prompt-title">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-card bg-panel p-6 shadow-modal">
        <h2 id="login-prompt-title" className="text-xl font-bold">
          저장하려면 로그인이 필요해요
        </h2>
        <p className="mt-2 text-muted">{reason}</p>
        <p className="mt-2 text-sm text-muted">지금 만든 내용은 저장되지 않아서 로그인 과정에서 사라져요. 로그인 없이 계속 써 보는 것도 괜찮아요.</p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            ref={primary}
            type="button"
            onClick={login}
            disabled={loading}
            className="min-h-12 flex-1 rounded-control bg-accent px-4 font-semibold text-white hover:bg-accent-hover disabled:cursor-wait disabled:bg-line disabled:text-muted"
          >
            {loading ? "Google로 이동하는 중…" : "Google로 로그인"}
          </button>
          <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-control border border-line px-4 hover:bg-canvas">
            계속 써 보기
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          <Link href="/privacy" className="underline underline-offset-2">
            개인정보 처리 안내
          </Link>
        </p>
      </div>
    </div>
  );
}
