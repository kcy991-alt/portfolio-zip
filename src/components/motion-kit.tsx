"use client";

import { animate, motion, MotionConfig, useInView, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { useEffect, useRef, useState } from "react";

// 랜딩 페이지의 움직임 도구 모음. 컴퓨터에서 "움직임 줄이기"를 켠 사람에게는 모든 움직임을 끈다.

/** 앱 전체 설정: 시스템의 "움직임 줄이기"를 따른다 */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

type RevealTag = "div" | "p" | "li" | "h2" | "h3" | "section" | "ul" | "ol";

/**
 * 화면에 들어올 때 아래에서 살짝 올라오며 나타난다(한 번만).
 * delay로 차례(스태거)를 만든다. 움직임 줄이기를 켠 사용자에게는 그냥 보인다.
 */
export function Reveal({
  as = "div",
  delay = 0,
  y = 24,
  className,
  children,
  ...rest
}: {
  as?: RevealTag;
  delay?: number;
  y?: number;
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  const reduce = useReducedMotion();
  const Tag = motion[as] as React.ElementType;
  if (reduce) {
    const Plain = as as React.ElementType;
    return (
      <Plain className={className} {...rest}>
        {children}
      </Plain>
    );
  }
  return (
    <Tag
      data-reveal
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * 숫자가 0에서 올라가며 목표값에서 멈춘다. 화면에 들어올 때 한 번만 움직인다.
 * 처음 그릴 때(서버·움직임 줄이기)에는 처음부터 목표값을 보여 준다. 화면 읽기 프로그램에는 항상 목표값을 읽어 준다.
 */
export function CountUp({ to, decimals = 0, suffix = "", className }: { to: number; decimals?: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const final = `${to.toFixed(decimals)}${suffix}`;
  const [shown, setShown] = useState(final);
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });

  // 화면에 들어오면 0에서 목표값까지 올라간다(한 번만)
  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, to, {
      duration: 1.3,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(`${v.toFixed(decimals)}${suffix}`),
      onComplete: () => setShown(final),
    });
    return () => controls.stop();
  }, [inView, reduce, to, decimals, suffix, final]);

  return (
    <span ref={ref} className={className}>
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{final}</span>
    </span>
  );
}

/** 위쪽 메뉴 바: 스크롤하면 그림자가 생기고 유리 느낌이 진해진다 */
export function GlassHeader({ children }: { children: React.ReactNode }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 8));
  return (
    <header className={`glass-nav sticky top-0 z-30 border-b transition-shadow duration-300 ${scrolled ? "is-scrolled" : ""}`}>{children}</header>
  );
}
