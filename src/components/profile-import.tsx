"use client";

import Link from "next/link";
import { useState } from "react";
import { emptyProfile, profileSchema, type CoverBasics, type Cover, type Profile } from "@/lib/validation/portfolio";
import { Modal } from "./modal";
import { useWorkspace } from "./workspace-data";

const isEmpty = (p: Profile) => JSON.stringify(p) === JSON.stringify(emptyProfile());

/**
 * 마이페이지에 저장해 둔 프로필을 이 포트폴리오의 프로필로 복사한다.
 * 복사한 뒤에는 서로 독립이다: 여기서 고쳐도 마이페이지는 바뀌지 않는다(spec 5.3과 같은 원칙).
 */
export function ProfileImport({ current, onApply }: { current: Profile; onApply: (p: Profile) => void }) {
  const { fetchMyProfile } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Profile | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "info" | "error"; text: string; link?: boolean } | null>(null);

  const start = async () => {
    setBusy(true);
    setMessage(null);
    try {
      // 마이페이지에는 이름·이메일·링크도 있지만 여기서는 프로필 항목만 복사한다(나머지는 표지에서 불러온다)
      const mine = profileSchema.parse(await fetchMyProfile());
      if (isEmpty(mine)) {
        setMessage({ tone: "info", text: "마이페이지에 저장된 프로필이 없어요. 마이페이지에서 먼저 적어 주세요.", link: true });
      } else if (isEmpty(current)) {
        apply(mine);
      } else {
        setPending(mine); // 지금 쓴 내용이 바뀌므로 확인을 받는다
      }
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "불러오지 못했어요. 잠시 뒤 다시 시도해 주세요." });
    } finally {
      setBusy(false);
    }
  };

  const apply = (mine: Profile) => {
    onApply(mine);
    setPending(null);
    setMessage({ tone: "ok", text: "마이페이지 내용을 불러왔어요. 여기서 고쳐도 마이페이지는 바뀌지 않아요." });
  };

  return (
    <div className="rounded-card border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">자주 쓰는 소개·교육·경력·자격증·도구는 마이페이지에 한 번만 적어 두세요.</p>
        <button type="button" disabled={busy} onClick={() => void start()} className="min-h-11 rounded-control border border-accent px-4 text-sm font-medium text-accent hover:bg-accent-soft disabled:text-muted">
          {busy ? "불러오는 중…" : "마이페이지에서 불러오기"}
        </button>
      </div>
      {message && (
        <p role="status" className={`mt-2 text-sm ${message.tone === "error" ? "text-danger" : message.tone === "ok" ? "text-accent" : "text-muted"}`}>
          {message.text}
          {message.link && (
            <>
              {" "}
              <Link href="/mypage" className="font-medium underline underline-offset-2">
                마이페이지로 가기
              </Link>
            </>
          )}
        </p>
      )}

      {pending && (
        <Modal title="지금 프로필을 바꿀까요?" description="이 포트폴리오에 적어 둔 프로필이 마이페이지 내용으로 바뀌어요." onClose={() => setPending(null)}>
          <p className="text-sm text-muted">바꾸고 나면 지금 적은 소개·교육·경력·자격증·도구는 사라져요. 마이페이지는 그대로예요.</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
            <button type="button" data-autofocus onClick={() => apply(pending)} className="min-h-12 flex-1 rounded-control bg-accent px-4 font-semibold text-white hover:bg-accent-hover">
              불러와서 바꾸기
            </button>
            <button type="button" onClick={() => setPending(null)} className="min-h-12 flex-1 rounded-control border border-line px-4 hover:bg-canvas">
              취소
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * 마이페이지에 적어 둔 이름·이메일·링크를 이 포트폴리오의 표지로 복사한다. 복사한 뒤에는 서로 독립이다.
 * 연락처를 출력에 넣을지(includeContact)는 건드리지 않는다. 기본은 꺼짐이고 사용자가 직접 켠다.
 */
export function CoverImport({ cover, onApply }: { cover: Cover; onApply: (c: Cover) => void }) {
  const { fetchMyProfile } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<CoverBasics | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "info" | "error"; text: string; link?: boolean } | null>(null);

  // 마이페이지에 값이 있는 항목만 가져온다(비어 있는 항목으로 표지에 적어 둔 값을 지우지 않는다)
  const fromMine = (mine: CoverBasics): Partial<CoverBasics> => {
    const out: Partial<CoverBasics> = {};
    if (mine.name.trim()) out.name = mine.name;
    if (mine.email.trim()) out.email = mine.email;
    if (mine.link.trim()) out.link = mine.link;
    return out;
  };
  const differs = (patch: Partial<CoverBasics>) => (Object.keys(patch) as (keyof CoverBasics)[]).some((k) => cover[k].trim() !== "" && cover[k] !== patch[k]);

  const apply = (patch: Partial<CoverBasics>) => {
    onApply({ ...cover, ...patch });
    setPending(null);
    const hasContact = Boolean(patch.email || patch.link);
    setMessage({
      tone: "ok",
      text: hasContact && !cover.includeContact
        ? "마이페이지의 이름·연락처를 불러왔어요. 연락처는 \u2018출력에 포함\u2019을 켜야 포트폴리오에 나와요."
        : "마이페이지의 이름·연락처를 불러왔어요. 여기서 고쳐도 마이페이지는 바뀌지 않아요.",
    });
  };

  const start = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const patch = fromMine(await fetchMyProfile());
      if (Object.keys(patch).length === 0) {
        setMessage({ tone: "info", text: "마이페이지에 저장된 이름·연락처가 없어요. 마이페이지에서 먼저 적어 주세요.", link: true });
      } else if (differs(patch)) {
        setPending(patch as CoverBasics); // 지금 적은 값이 바뀌므로 확인을 받는다
      } else {
        apply(patch);
      }
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "불러오지 못했어요. 잠시 뒤 다시 시도해 주세요." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-card border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 break-keep text-pretty text-sm text-muted">이름·연락처는 마이페이지에 한 번만 적어 두세요.</p>
        <button type="button" disabled={busy} onClick={() => void start()} className="min-h-11 rounded-control border border-accent px-4 text-sm font-medium text-accent hover:bg-accent-soft disabled:text-muted">
          {busy ? "불러오는 중…" : "마이페이지에서 불러오기"}
        </button>
      </div>
      {message && (
        <p role="status" className={`mt-2 break-keep text-sm ${message.tone === "error" ? "text-danger" : message.tone === "ok" ? "text-accent" : "text-muted"}`}>
          {message.text}
          {message.link && (
            <>
              {" "}
              <Link href="/mypage" className="font-medium underline underline-offset-2">
                마이페이지로 가기
              </Link>
            </>
          )}
        </p>
      )}
      {pending && (
        <Modal title="지금 적은 이름·연락처를 바꿀까요?" description="이 포트폴리오 표지에 적어 둔 값이 마이페이지 내용으로 바뀌어요." onClose={() => setPending(null)}>
          <p className="text-sm text-muted">마이페이지에 값이 있는 항목만 바뀌고, 마이페이지는 그대로예요.</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
            <button type="button" data-autofocus onClick={() => apply(pending)} className="min-h-12 flex-1 rounded-control bg-accent px-4 font-semibold text-white hover:bg-accent-hover">
              불러와서 바꾸기
            </button>
            <button type="button" onClick={() => setPending(null)} className="min-h-12 flex-1 rounded-control border border-line px-4 hover:bg-canvas">
              취소
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
