"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef } from "react";

/** 가운데 창. Esc와 바깥 클릭으로 닫히고, 열리면 첫 입력 칸(없으면 창)에 포커스가 간다. */
export function Modal({
  title,
  description,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  /** 페이지 미리보기처럼 넓은 내용을 담는 창 */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // 창이 열릴 때의 포커스 위치를 기억해 두었다가 닫으면 돌려준다
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => opener.current?.focus();
  }, []);

  useEffect(() => {
    const first = panel.current?.querySelector<HTMLElement>("input, select, textarea, button[data-autofocus]");
    (first ?? panel.current)?.focus();
  }, []);

  useEffect(() => {
    const focusable = () =>
      Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      // 창 밖으로 Tab이 빠져나가지 않게 가둔다
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return e.preventDefault();
      const active = document.activeElement;
      if (e.shiftKey && (active === items[0] || active === panel.current)) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (!e.shiftKey && active === items[items.length - 1]) {
        e.preventDefault();
        items[0].focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {/* 배경은 부드럽게 어두워지고, 창은 살짝 떠오르며 나타난다. 닫을 때는 반대로 사라진다(상위에서 AnimatePresence로 감싼 경우). */}
      <motion.button
        type="button"
        aria-label="닫기"
        tabIndex={-1}
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        ref={panel}
        tabIndex={-1}
        initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-card bg-panel p-6 shadow-modal outline-none ${wide ? "max-w-4xl" : "max-w-lg"}`}
      >
        <h2 id={titleId} className="text-xl font-bold">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        <div className="mt-4">{children}</div>
      </motion.div>
    </div>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-control border border-line bg-panel px-3 text-base focus:border-accent focus:shadow-[0_0_0_2px_rgba(49,91,232,0.15)]";
