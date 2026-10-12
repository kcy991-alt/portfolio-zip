"use client";

import Link from "next/link";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// 환영 안내 3장. 문구는 docs/decisions.md의 확정본을 따른다. 움직임은 은은하게 두고, "움직임 줄이기"를 켠 사용자에게는 모두 끈다.

const EASE = [0.22, 1, 0.36, 1] as const;
const MotionLink = motion.create(Link);

/** 그림 안의 요소가 차례로 나타난다 */
function Pop({ delay = 0, x = 0, y = 10, className, children }: { delay?: number; x?: number; y?: number; className?: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} initial={{ opacity: 0, x, y }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ duration: 0.38, delay, ease: EASE }}>
      {children}
    </motion.div>
  );
}

/** 체크 표시가 톡 하고 나타난다 */
function Check({ delay, picked }: { delay: number; picked: boolean }) {
  const reduce = useReducedMotion();
  const base = "flex size-4 shrink-0 items-center justify-center rounded text-[10px]";
  if (!picked) return <span aria-hidden className={`${base} border border-line`} />;
  if (reduce) return <span aria-hidden className={`${base} bg-accent text-white`}>✓</span>;
  return (
    <span aria-hidden className={`${base} border border-line`}>
      <motion.span
        className="flex size-4 items-center justify-center rounded bg-accent text-white"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 18, delay }}
      >
        ✓
      </motion.span>
    </span>
  );
}

/** 입력한 항목이 들어갈 자리가 "켜지는" 모습: 테두리가 한 번 빛난다 */
function Highlight({ delay, className, children }: { delay: number; className: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1, boxShadow: ["0 0 0 0 rgba(49,91,232,0)", "0 0 0 7px rgba(49,91,232,0.22)", "0 0 0 0 rgba(49,91,232,0)"] }}
      transition={{ opacity: { duration: 0.3, delay }, scale: { duration: 0.3, delay, ease: EASE }, boxShadow: { duration: 0.9, delay: delay + 0.25 } }}
    >
      {children}
    </motion.div>
  );
}

const STEPS = [
  {
    tag: "경험 모으기",
    title: "폴더로 분류하고,\n프로젝트로 기록해요",
    body: "회사, 인턴, 동아리 등 경험 유형별로 폴더를 만들고, 그 안에 프로젝트를 기록해 보세요. 폴더를 지정하지 않은 프로젝트는 ‘미분류’에 자동으로 모여요.",
    visual: (
      <div className="grid gap-2 text-sm">
        <Pop delay={0.1} className="rounded-control bg-accent p-3 text-white">
          <p className="text-xs text-white/80">폴더</p>
          <p className="font-semibold">A회사 · 기획 인턴</p>
        </Pop>
        <Pop delay={0.3} x={-10} y={0} className="ml-4 rounded-control border border-line bg-panel p-3">
          <p className="text-xs text-muted">프로젝트 1</p>
          <p className="font-medium">신규 사용자 온보딩 개선</p>
        </Pop>
        <Pop delay={0.45} x={-10} y={0} className="ml-4 rounded-control border border-line bg-panel p-3">
          <p className="text-xs text-muted">프로젝트 2</p>
          <p className="font-medium">사용자 인터뷰 및 분석</p>
        </Pop>
      </div>
    ),
  },
  {
    tag: "질문에 답하기",
    title: "질문에 답하며\n포트폴리오를 채워가요",
    body: "10단계 질문 중 하나를 선택하면 포트폴리오에서 해당 내용이 들어갈 위치를 미리 보여줘요. 원하는 순서대로 자유롭게 작성해 보세요.",
    visual: (
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <Pop delay={0.1} className="rounded-control border border-line bg-panel p-3">
          <p className="text-xs text-muted">3/10 · 문제 정의</p>
          <p className="mt-1 font-medium">어떤 현상이 누구에게 발생했나요?</p>
        </Pop>
        <Highlight delay={0.35} className="rounded-control border-2 border-accent bg-accent-soft p-3">
          <p className="font-medium">포트폴리오 미리보기 · 문제 정의</p>
        </Highlight>
      </div>
    ),
  },
  {
    tag: "포트폴리오 만들기",
    title: "필요한 프로젝트만 골라\n포트폴리오를 만들어요",
    body: "기록한 프로젝트 중 지원할 곳에 맞는 경험을 선택해 보세요. 원본은 그대로 유지되니 자유롭게 수정할 수 있어요. 표지를 추가하고 PDF로 저장하면 완성이에요.",
    visual: (
      <div className="grid items-center gap-2 text-sm sm:grid-cols-[1fr_auto_1fr]">
        <div className="grid gap-2">
          <p className="text-xs font-medium text-muted">프로젝트 아카이브</p>
          {[
            { name: "신규 사용자 온보딩 개선", picked: true, check: 0.45 },
            { name: "사용자 인터뷰 및 분석", picked: true, check: 0.6 },
            { name: "구매 전환율 개선", picked: false, check: 0 },
          ].map((p, i) => (
            <Pop key={p.name} delay={0.1 + i * 0.1} className={`flex items-center gap-2 rounded-control border p-3 ${p.picked ? "border-accent bg-panel font-medium" : "border-line bg-panel text-muted"}`}>
              <Check delay={p.check} picked={p.picked} />
              {p.name}
            </Pop>
          ))}
        </div>
        <Pop delay={0.75} x={-8} y={0} className="text-center text-xl font-bold text-accent">
          <span aria-hidden className="sm:hidden">↓</span>
          <span aria-hidden className="hidden sm:inline">→</span>
        </Pop>
        <div className="grid gap-2">
          <p className="text-xs font-medium text-muted">내 포트폴리오</p>
          {["표지", "신규 사용자 온보딩 개선", "사용자 인터뷰 및 분석"].map((t, i) => (
            <Pop key={t} delay={0.85 + i * 0.12} className={`rounded-control p-3 ${i === 0 ? "bg-accent font-semibold text-white" : "border border-line bg-panel"}`}>
              {t}
            </Pop>
          ))}
        </div>
      </div>
    ),
  },
];

/** 안쪽 내용의 높이가 바뀌면 바깥 높이가 부드럽게 따라간다 */
function AutoHeight({ children }: { children: React.ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <motion.div animate={{ height }} transition={{ duration: reduce ? 0 : 0.3, ease: EASE }} style={{ overflow: "hidden" }}>
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

export function WelcomeSteps() {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(0); // 1: 다음(오른쪽에서 들어옴), -1: 이전(왼쪽에서 들어옴), 0: 처음
  const reduce = useReducedMotion();
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const go = (next: number) => {
    setDir(next > i ? 1 : -1);
    setI(next);
  };

  const slide = {
    enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * 36 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * -36 }),
  };

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        role="dialog"
        aria-label="처음 오신 분을 위한 안내"
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="w-full max-w-xl overflow-hidden rounded-card border border-line bg-panel shadow-modal"
      >
        <div className="flex items-center justify-between gap-3 p-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5" aria-hidden>
              {STEPS.map((_, n) => (
                <motion.span
                  key={n}
                  className="h-1.5 rounded-full"
                  initial={false}
                  animate={{ width: n === i ? 24 : 6, backgroundColor: n === i ? "#315be8" : "#e2e6ec" }}
                  transition={{ duration: 0.3, ease: EASE }}
                />
              ))}
            </div>
            <p className="text-sm text-muted" aria-live="polite">
              <strong className="text-accent">
                {i + 1} / {STEPS.length}
              </strong>{" "}
              · <motion.span key={i} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>{step.tag}</motion.span>
            </p>
          </div>
        </div>

        <AutoHeight>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={i} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.22, ease: "easeOut" }} className="p-6">
              <div className="rounded-card bg-accent-soft/60 p-4">{step.visual}</div>
              <h1 className="mt-6 whitespace-pre-line text-[22px] font-bold leading-[30px] sm:text-[28px] sm:leading-[38px]">{step.title}</h1>
              <p className="mt-3 text-muted">{step.body}</p>
            </motion.div>
          </AnimatePresence>
        </AutoHeight>

        <div className="flex items-center justify-between gap-3 bg-canvas px-6 py-4">
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button type="button" onClick={() => go(i - 1)} className="min-h-11 rounded-control px-3 text-sm text-muted hover:text-ink">
                이전
              </button>
            )}
            <Link href="/workspace" className="inline-flex min-h-11 items-center rounded-control px-3 text-sm text-muted hover:text-ink">
              건너뛰기
            </Link>
          </div>
          {last ? (
            <MotionLink
              href="/workspace"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              className="inline-flex min-h-12 items-center rounded-control bg-accent px-5 font-semibold text-white hover:bg-accent-hover"
            >
              시작하기
            </MotionLink>
          ) : (
            <motion.button
              type="button"
              onClick={() => go(i + 1)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              className="min-h-12 rounded-control bg-accent px-5 font-semibold text-white hover:bg-accent-hover"
            >
              다음
            </motion.button>
          )}
        </div>
      </motion.div>
    </MotionConfig>
  );
}
