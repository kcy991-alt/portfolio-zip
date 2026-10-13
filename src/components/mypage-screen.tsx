"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SaveStatusChip } from "@/components/app-motion";
import { useAuth } from "@/components/auth-context";
import { GatedButton } from "@/components/gated-button";
import { BasicInfoForm, ProfileForm } from "@/components/portfolio-forms";
import { useWorkspace } from "@/components/workspace-data";
import { api, ApiError } from "@/lib/api/client";
import { Autosaver, type SaveResult, type SaveStatus } from "@/lib/autosave";
import type { MyProfile } from "@/lib/validation/portfolio";

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: "자동 저장됨",
  dirty: "저장 대기 중…",
  saving: "저장 중…",
  saved: "자동 저장됨",
  error: "저장 실패",
  conflict: "저장 멈춤 · 다른 곳에서 수정됨",
};

const intro = (
  <p className="break-keep text-pretty text-sm leading-relaxed text-muted">
    이름·연락처와 소개·교육·경력·자격증·도구를 여기에 한 번만 적어 두면, 포트폴리오에서 <strong className="whitespace-nowrap text-ink">&lsquo;마이페이지에서 불러오기&rsquo;</strong>로 바로 넣을 수 있어요. 지원 직무는 포트폴리오마다 달라서 표지에서 따로 적어요.
  </p>
);

/** 로그인한 사용자: 서버에 자동 저장한다 */
function RealMyPage() {
  const [loaded, setLoaded] = useState<{ profile: MyProfile; revision: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [round, setRound] = useState(0); // 최신 버전을 다시 열 때 올린다

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setLoaded(await api<{ profile: MyProfile; revision: number }>("/api/me/profile"));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "불러오지 못했어요.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 화면을 열면 서버에서 저장본을 가져온다
    void load();
  }, [load, round]);

  if (loadError) {
    return (
      <div role="alert" className="rounded-card border border-line bg-panel p-4">
        <p className="text-danger">{loadError}</p>
        <button type="button" onClick={() => setRound((n) => n + 1)} className="mt-3 min-h-11 rounded-control border border-line px-4 hover:bg-canvas">
          다시 시도
        </button>
      </div>
    );
  }
  if (!loaded) return <p className="text-muted">불러오는 중이에요…</p>;
  return (
    <RealEditor
      key={round}
      initial={loaded}
      onReload={() => {
        setLoaded(null);
        setRound((n) => n + 1);
      }}
    />
  );
}

function RealEditor({ initial, onReload }: { initial: { profile: MyProfile; revision: number }; onReload: () => void }) {
  const [profile, setProfile] = useState<MyProfile>(initial.profile);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [message, setMessage] = useState<string | null>(null);
  const saver = useRef<Autosaver<MyProfile> | null>(null);

  useEffect(() => {
    const instance = new Autosaver<MyProfile>({
      initialRevision: initial.revision,
      onStatus: setStatus,
      save: async (payload, expectedRevision): Promise<SaveResult> => {
        try {
          const data = await api<{ revision: number }>("/api/me/profile", { method: "PUT", body: { expected_revision: expectedRevision, profile: payload } });
          setMessage(null);
          return { ok: true, revision: data.revision };
        } catch (e) {
          setMessage(e instanceof ApiError && e.status === 400 ? e.message : null);
          return { ok: false, kind: e instanceof ApiError && e.status === 409 ? "conflict" : "error" };
        }
      },
    });
    saver.current = instance;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (instance.hasUnsaved) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      void instance.flush(); // 화면을 떠날 때 마지막 입력을 저장해 본다
      instance.dispose();
      saver.current = null;
    };
  }, [initial.revision]);

  const change = (next: MyProfile) => {
    setProfile(next);
    saver.current?.change(next);
  };

  const bad = status === "error" || status === "conflict";
  return (
    <div className="flex flex-col gap-4" onBlurCapture={() => void saver.current?.flush()}>
      <div className="flex flex-wrap items-center gap-2">
        <SaveStatusChip
          statusKey={status}
          kind={status === "saved" || status === "idle" ? "saved" : bad ? "error" : "neutral"}
          className={`rounded px-2 py-1 text-sm ${bad ? "bg-danger/5 text-danger" : "bg-canvas text-muted"}`}
        >
          {STATUS_TEXT[status]}
          {status === "error" && (
            <button type="button" onClick={() => void saver.current?.retry()} className="ml-2 font-medium underline underline-offset-2">
              다시 시도
            </button>
          )}
        </SaveStatusChip>
      </div>
      {status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {message ? (
            <>
              입력한 내용 중 확인이 필요한 곳이 있어서 저장하지 못했어요: <strong>{message}</strong>
            </>
          ) : (
            <>저장하지 못했어요. 입력한 내용은 이 화면에 그대로 있어요. 연결을 확인하고 &lsquo;다시 시도&rsquo;를 눌러 주세요.</>
          )}
        </p>
      )}
      {status === "conflict" && (
        <div role="alert" className="rounded-card border border-danger/30 bg-danger/5 p-3 text-sm">
          <p>다른 탭이나 기기에서 먼저 저장해서 지금 화면은 저장을 멈췄어요. 최신 내용을 열면 지금 입력한 내용은 사라져요.</p>
          <button type="button" onClick={onReload} className="mt-2 min-h-11 rounded-control bg-accent px-4 font-medium text-white hover:bg-accent-hover">
            최신 버전 열기
          </button>
        </div>
      )}
      <BasicInfoForm value={profile} onChange={change} />
      <ProfileForm profile={profile} onChange={(p) => change({ ...profile, ...p })} />
    </div>
  );
}

/** 로그인하지 않은 체험: 같은 화면을 쓰되 브라우저 메모리에만 두고 저장하지 않는다 */
function LocalMyPage() {
  const { localMyProfile, setLocalMyProfile } = useWorkspace();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span role="status" className="rounded bg-canvas px-2 py-1 text-sm text-muted">
          체험 중 · 저장되지 않아요
        </span>
        <GatedButton
          label="로그인하고 저장"
          reason="마이페이지를 보관하려면 로그인해야 해요."
          className="min-h-11 rounded-control bg-accent px-4 font-semibold text-white hover:bg-accent-hover"
          disabledClassName="min-h-11 cursor-not-allowed rounded-control bg-line px-4 text-muted"
        />
      </div>
      <BasicInfoForm value={localMyProfile} onChange={setLocalMyProfile} />
      <ProfileForm profile={localMyProfile} onChange={(p) => setLocalMyProfile({ ...localMyProfile, ...p })} />
    </div>
  );
}

export function MyPageScreen() {
  const { status } = useAuth();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 xl:py-8">
      <h1 className="text-xl font-bold">마이페이지</h1>
      {intro}
      {status === "loading" ? <p className="text-muted">불러오는 중이에요…</p> : status === "signedIn" ? <RealMyPage /> : <LocalMyPage />}
    </main>
  );
}
