"use client";

import { useEffect, useRef, useState } from "react";
import { draftToAnswers, mergeDraft } from "@/lib/ai/draft-merge";
import { buildCopyPrompt, parsePastedDraft } from "@/lib/ai/user-prompt";
import { emptyProjectAnswers, type ProjectAnswers } from "@/lib/validation/project-answers";
import { STEPS } from "@/templates/pm-v1";
import { Modal } from "./modal";

type Message = { tone: "ok" | "info"; text: string };

const stepLabels = (sections: string[]) =>
  STEPS.filter((s) => s.sections.some((k) => sections.includes(k)))
    .map((s) => s.label)
    .join(" · ");

const PASTE_ERROR = {
  empty: "붙여넣은 내용이 없어요. AI가 작성한 결과를 복사해 붙여넣어 주세요.",
  not_json: "결과(JSON)를 찾지 못했어요. AI에게 “JSON 코드블록 하나만 다시 출력해 줘”라고 요청한 뒤 다시 붙여넣어 주세요.",
  wrong_shape: "지침과 다른 형식이에요. 1단계에서 복사한 지침을 그대로 AI에 보내고, 받은 결과를 통째로 붙여넣어 주세요.",
} as const;

/**
 * 기획서·PRD로 10단계 초안 채우기. 사용자가 이 서비스가 만든 지침을 자기 AI(ChatGPT·Claude 등)에 붙여 넣고 PDF를 직접 첨부해서
 * 받은 결과(JSON)를 다시 붙여 넣으면, 사용자가 쓴 칸은 그대로 두고 빈 칸만 채운다.
 * 이 서비스는 문서를 받지 않고 AI를 부르지도 않는다(서버·API 키·요금이 없다). 로그인 없이 써 보는 화면에서도 쓸 수 있다.
 */
export function AiDraftImport({ answers, onApply }: { answers: ProjectAnswers; onApply: (next: ProjectAnswers) => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"idle" | "ok" | "failed">("idle");
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // 붙여 넣는 사이에 사용자가 쓴 내용 위에 합쳐야 하므로, 누르는 순간의 최신 답변을 쓴다
  const latest = useRef(answers);
  useEffect(() => {
    latest.current = answers;
  }, [answers]);

  const prompt = buildCopyPrompt();

  const close = () => {
    setOpen(false);
    setCopied("idle");
    setError(null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied("ok");
    } catch {
      // 복사 권한이 없으면 지침을 직접 선택해서 복사하도록 안내한다
      setCopied("failed");
      promptRef.current?.select();
    }
  };

  const fill = () => {
    const parsed = parsePastedDraft(pasted);
    if (!parsed.ok) {
      setError(PASTE_ERROR[parsed.reason]);
      return;
    }
    const merged = mergeDraft(latest.current, draftToAnswers(parsed.draft));
    setPasted("");
    close();
    if (merged.filledCount === 0) {
      // 붙여넣은 결과에 가져올 내용이 아예 없었는지, 채울 빈 항목이 없었는지 구분해서 알린다
      const hasContent = mergeDraft(emptyProjectAnswers(), draftToAnswers(parsed.draft)).filledCount > 0;
      setMessage({
        tone: "info",
        text: hasContent
          ? "채울 수 있는 빈 항목이 없어요. 기존 작성 내용은 그대로 유지했어요."
          : "AI 결과에서 가져올 내용을 찾지 못했어요. 기획서에 내용이 있는지 확인하고, 지침을 다시 보내 새 결과를 붙여넣어 주세요.",
      });
      return;
    }
    onApply(merged.answers);
    setMessage({
      tone: "ok",
      text: `${merged.filledCount}개 항목에 초안을 채웠어요 (${stepLabels(merged.filledSections)}). 내용을 확인하고 수정해 주세요.`,
    });
  };

  return (
    <div className="rounded-card border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-keep font-semibold">작성해 둔 기획서가 있나요?</p>
          <p className="mt-0.5 break-keep text-pretty text-sm text-muted">기획서나 PRD에서 핵심 내용을 추출해 포트폴리오 10단계의 초안을 빠르게 완성해 보세요.</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-control border border-accent px-4 text-sm font-medium text-accent hover:bg-accent-soft">
          AI로 초안 만들기
        </button>
      </div>

      {message && (
        <p role="status" className={`mt-3 text-sm ${message.tone === "ok" ? "text-accent" : "text-muted"}`}>
          {message.text}
        </p>
      )}

      {open && (
        <Modal title="AI로 포트폴리오 초안 만들기" description="기존 기획서나 PRD를 활용해 포트폴리오 10단계의 초안을 만들어 보세요. 3단계만 따라 하면 돼요." wide onClose={close}>
          <ol className="flex flex-col gap-5 text-sm">
            <li>
              <p className="font-semibold">1. AI 분석 지침 복사하기</p>
              <p className="mt-1 text-muted">AI가 기획서에서 필요한 내용만 추출할 수 있도록 지침을 복사해 주세요.</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button type="button" data-autofocus onClick={() => void copy()} className="min-h-11 rounded-control bg-accent px-4 font-semibold text-white hover:bg-accent-hover">
                  지침 복사하기
                </button>
                {copied === "ok" && (
                  <span role="status" className="text-accent">
                    복사했어요
                  </span>
                )}
                {copied === "failed" && (
                  <span role="status" className="text-danger">
                    복사하지 못했어요. 아래 지침을 직접 선택해서 복사해 주세요.
                  </span>
                )}
              </div>
              <details className="mt-2" open={copied === "failed"}>
                <summary className="cursor-pointer text-muted">지침 미리보기</summary>
                <textarea ref={promptRef} readOnly value={prompt} rows={8} aria-label="AI에게 붙여 넣을 지침" className="mt-2 w-full rounded-control border border-line bg-canvas p-2 text-xs" />
              </details>
            </li>
            <li>
              <p className="font-semibold">2. AI에 기획서와 지침 보내기</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                <li>ChatGPT나 Claude에 복사한 지침을 붙여넣고, 분석할 기획서 파일을 첨부해 주세요.</li>
                <li>개인정보나 회사 내부 정보가 있다면 첨부하기 전에 가려 주세요.</li>
              </ul>
            </li>
            <li>
              <label htmlFor="ai-paste" className="font-semibold">
                3. AI 분석 결과 붙여넣기
              </label>
              <p className="mt-1 text-muted">AI가 작성한 결과를 복사해 아래에 붙여넣어 주세요. 내용을 확인한 후 비어 있는 항목에 초안이 입력돼요.</p>
              <textarea
                id="ai-paste"
                value={pasted}
                onChange={(e) => {
                  setPasted(e.target.value);
                  setError(null);
                }}
                rows={7}
                placeholder="AI가 작성한 JSON 결과를 여기에 붙여넣어 주세요. (코드블록도 가능해요.)"
                aria-invalid={error ? true : undefined}
                className="mt-2 w-full rounded-control border border-line p-2 text-xs"
              />
              {error && (
                <p role="alert" className="mt-1 text-danger">
                  {error}
                </p>
              )}
            </li>
          </ol>
          <p className="mt-5 text-sm text-muted">이미 작성한 내용은 유지하고, 비어 있는 항목만 채워요.</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row-reverse">
            <button type="button" onClick={fill} className="min-h-12 flex-1 rounded-control bg-accent px-4 font-semibold text-white hover:bg-accent-hover">
              빈 항목에 초안 채우기
            </button>
            <button type="button" onClick={close} className="min-h-12 flex-1 rounded-control border border-line px-4 hover:bg-canvas">
              취소
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
