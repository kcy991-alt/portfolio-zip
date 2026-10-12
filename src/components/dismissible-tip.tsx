"use client";

import { useState } from "react";

export function DismissibleTip() {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div className="mb-6 flex items-start justify-between gap-3 rounded-card bg-accent-soft p-4">
      <div>
        <p className="font-semibold">
          폴더별로 프로젝트를 정리해 보세요 <span className="ml-1 inline-block whitespace-nowrap rounded-full bg-panel px-2 py-0.5 text-xs font-medium text-accent">안내</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          인턴, 동아리, 교육 등 경험 유형에 따라 폴더를 만들고 프로젝트를 정리할 수 있어요. 폴더를 선택하지 않으면 ‘미분류’에 저장돼요.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="안내 닫기"
        className="min-h-11 min-w-11 shrink-0 rounded-control text-muted hover:bg-panel hover:text-ink"
      >
        ✕
      </button>
    </div>
  );
}
