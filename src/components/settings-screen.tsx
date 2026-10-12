"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import { startGoogleReauth } from "@/lib/auth/google";
import { useAuth } from "./auth-context";
import { Modal } from "./modal";

type Usage = { used: number; limit: number };
type Job = { status: "pending" | "running" | "done" | "failed"; retry_count: number; updated_at: string } | null;

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;
const dangerBtn = "inline-flex min-h-11 items-center rounded-control bg-danger px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";
const subBtn = "inline-flex min-h-11 items-center rounded-control border border-line px-4 hover:bg-canvas";

function DeleteAccount({ reauthed }: { reauthed: boolean }) {
  const [open, setOpen] = useState(reauthed);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needReauth, setNeedReauth] = useState(false);
  const [done, setDone] = useState(false);
  const [job, setJob] = useState<Job>(null);

  useEffect(() => {
    api<{ job: Job }>("/api/account/deletion")
      .then((r) => setJob(r.job))
      .catch(() => {});
  }, []);

  const reauth = async () => {
    setBusy(true);
    const r = await startGoogleReauth();
    if (r.error) {
      setError(r.error);
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/account/deletion", { method: "POST", body: { confirm: true } });
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.code === "reauth_required") setNeedReauth(true);
      else setError(e instanceof Error ? e.message : "계정을 지우지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <section className="rounded-card border border-line bg-panel p-4" aria-live="polite">
        <h2 className="font-bold">계정을 지웠어요</h2>
        <p className="mt-1 text-sm text-muted">저장했던 프로젝트, 포트폴리오, 이미지를 모두 지웠어요. 이용해 주셔서 고마워요.</p>
        {/* 로그인 정보가 사라졌으니 화면을 완전히 새로 불러온다 */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className={`${subBtn} mt-3`}>
          처음 화면으로
        </a>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-danger/40 bg-panel p-4">
      <h2 className="font-bold">계정 삭제</h2>
      <p className="mt-1 text-sm text-muted">계정을 지우면 프로젝트, 포트폴리오, 올린 이미지가 모두 지워지고 되돌릴 수 없어요. 휴지통의 항목도 함께 지워져요.</p>
      {job?.status === "failed" && (
        <p role="alert" className="mt-2 text-sm text-danger">
          이전에 요청한 계정 삭제가 끝나지 않았어요. 아래 버튼으로 다시 시도하면 남은 부분을 이어서 지워요.
        </p>
      )}
      <button type="button" onClick={() => setOpen(true)} className={`${dangerBtn} mt-3`}>
        {job?.status === "failed" ? "계정 삭제 다시 시도" : "계정 삭제"}
      </button>

      {open && (
        <Modal title="계정을 지울까요?" description="지운 데이터는 되돌릴 수 없어요." onClose={() => !busy && setOpen(false)}>
          {reauthed && !needReauth ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                Google 확인이 끝났어요. 계속하려면 아래 칸에 <strong>삭제</strong>라고 입력하세요.
              </p>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                aria-label="확인 문구 입력"
                className="min-h-11 rounded-control border border-line px-3"
                autoComplete="off"
              />
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} disabled={busy} className={subBtn}>
                  취소
                </button>
                <button type="button" onClick={confirm} disabled={busy || typed.trim() !== "삭제"} className={dangerBtn}>
                  {busy ? "지우는 중…" : "영구 삭제"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                {needReauth ? "확인한 지 시간이 지났어요. " : ""}본인 확인을 위해 Google로 한 번 더 로그인합니다. 확인이 끝나면 이 화면으로 돌아와요.
              </p>
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} disabled={busy} className={subBtn}>
                  취소
                </button>
                <button type="button" onClick={reauth} disabled={busy} className={dangerBtn}>
                  Google로 확인하기
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}

export function SettingsScreen() {
  const { status, email } = useAuth();
  const reauthed = useSearchParams().get("reauth") === "1";
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    if (status !== "signedIn") return;
    api<Usage>("/api/account/usage")
      .then(setUsage)
      .catch(() => {});
  }, [status]);

  if (status === "loading") return <p className="p-4 text-muted">확인하는 중이에요…</p>;
  if (status === "guest") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <h1 className="text-xl font-bold">로그인하면 쓸 수 있어요</h1>
        <p className="text-muted">설정은 계정이 있어야 볼 수 있어요. 로그인 없이 써 본 내용은 저장되지 않아요.</p>
        <Link href="/auth" className="inline-flex min-h-11 items-center rounded-control bg-accent px-4 font-semibold text-white hover:bg-accent-hover">
          로그인하기
        </Link>
      </main>
    );
  }

  const pct = usage ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">설정</h1>

      <section className="rounded-card border border-line bg-panel p-4">
        <h2 className="font-bold">계정</h2>
        <p className="mt-1 text-sm text-muted">Google 계정으로 로그인했어요.</p>
        <p className="mt-1 break-all">{email}</p>
        <form action="/auth/signout" method="post" className="mt-3">
          <button type="submit" className={subBtn}>
            로그아웃
          </button>
        </form>
      </section>

      <section className="rounded-card border border-line bg-panel p-4">
        <h2 className="font-bold">저장 용량</h2>
        {usage ? (
          <>
            <p className="mt-1 text-sm">
              이미지 {mb(usage.used)} / {mb(usage.limit)} 사용 중
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded bg-canvas" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="저장 용량 사용률">
              <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted">글 내용은 용량에 포함되지 않아요. 쓰지 않는 이미지를 지우면 공간이 돌아와요.</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">불러오는 중이에요…</p>
        )}
      </section>

      <DeleteAccount reauthed={reauthed} />
    </main>
  );
}
