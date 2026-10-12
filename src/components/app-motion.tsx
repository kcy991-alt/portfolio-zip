"use client";

import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react";

// 앱 안쪽 화면의 움직임. 글을 쓰는 화면이라 "방금 무슨 일이 있었는지 보여 주는" 짧은 움직임(0.2~0.3초)만 쓰고,
// 컴퓨터에서 "움직임 줄이기"를 켠 사용자에게는 모두 끈다.

const EASE = [0.22, 1, 0.36, 1] as const;

/** 앱 전체 설정: 시스템의 "움직임 줄이기"를 따른다 */
export function AppMotion({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** 조건부 안내 문구(오류 등). 나타날 때 부드럽게 펼쳐지고 사라질 때 접혀서 화면이 갑자기 흔들리지 않는다. */
export function AnimatedMessage({ show, children }: { show: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={reduce ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease: EASE }}
          style={{ overflow: "hidden" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * 저장 상태 표시. 상태가 바뀔 때 부드럽게 바뀌고, 저장되면 ✓가 톡 나타나며, 실패하면 한 번 흔들려서 놓치지 않게 한다.
 * kind: saved(저장됨) / error(실패·충돌) / neutral(저장 중·대기·체험)
 */
export function SaveStatusChip({
  kind,
  statusKey,
  className,
  children,
}: {
  kind: "saved" | "error" | "neutral";
  statusKey: string;
  className: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      key={statusKey}
      role="status"
      aria-live="polite"
      className={className}
      initial={reduce ? false : { opacity: 0, y: 4 }}
      animate={reduce ? { opacity: 1 } : kind === "error" ? { opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] } : { opacity: 1, y: 0, x: 0 }}
      transition={{ duration: kind === "error" ? 0.45 : 0.22, ease: EASE }}
    >
      {kind === "saved" && (
        <motion.span
          aria-hidden
          className="mr-1 inline-block text-accent"
          initial={reduce ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
        >
          ✓
        </motion.span>
      )}
      {children}
    </motion.span>
  );
}

/**
 * 목록의 한 줄. 새로 생기면 위에서 살짝 들어오며 잠깐 강조되고, 사라질 때는 접히며 아래 항목이 부드럽게 올라온다.
 * 목록을 AnimatePresence initial={false}로 감싸면 처음 불러올 때는 움직이지 않는다.
 */
export function ListRow({ className, children }: { className: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      layout={reduce ? false : "position"}
      initial={reduce ? false : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: 0, scale: 0.98 }}
      transition={{ duration: 0.25, ease: EASE }}
      style={{ overflow: "hidden" }}
    >
      <motion.div
        className={className}
        initial={reduce ? false : { backgroundColor: "#eef3ff" }}
        animate={{ backgroundColor: "#ffffff" }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </motion.li>
  );
}

export { AnimatePresence };
