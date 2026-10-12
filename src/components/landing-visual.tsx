"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { PhysicalPage } from "@/lib/portfolio/output";
import { STEPS } from "@/templates/pm-v1";
import { SECTION_FORMS } from "@/templates/pm-v1/fields";
import { CANVAS_H, CANVAS_W, PageFrame } from "./portfolio-output";

// 첫 화면 오른쪽 그림: 뒤에는 질문에 답하는 화면, 앞에는 "완성되면 이런 포트폴리오 페이지가 나와요".
// 앞의 페이지는 실제 PDF 출력과 같은 렌더러(PageFrame)로 그린 한 장이고, 잘리지 않게 통째로 보여 준다.
// 내용은 모두 예시다. 성과 숫자는 결과가 아니라 목표로만 쓴다(제품의 출력 규칙과 같다).

const DESIGN_W = 640;
const DESIGN_H = 470;
// 앞의 포트폴리오 페이지 카드 너비. 페이지는 이 안에 한 장이 통째로 들어가도록 줄여서 그린다(잘리지 않는다).
const CARD_W = 470;
const PAGE_SCALE = (CARD_W - 4) / CANVAS_W; // 테두리 2px씩 제외

const base = { continuationIndex: 0, overflow: false, logicalId: "landing" };

const samplePage: PhysicalPage = {
  ...base,
  key: "landing-intro",
  type: "project_intro",
  headerTitle: "신규 사용자 온보딩 개선",
  headerSub: "소개",
  pageNumber: 4,
  // 위쪽 영역(제목·목표·정보 카드·한 줄 소개)은 실제 출력과 같은 모양이다. 성과 숫자는 결과가 아니라 목표로만 적는다.
  hero: {
    pill: "프로젝트 소개",
    title: "신규 사용자 온보딩 개선",
    goal: "첫 설정 완료율 · 기준 42% → 목표 55%",
    oneLine: "회원가입 이후 온보딩 과정을 개선해 신규 사용자의 첫 이용을 돕는 프로젝트",
    cards: [
      { kind: "period", label: "프로젝트 기간", value: "2026-03 ~ 2026-06" },
      { kind: "role", label: "주요 역할", value: "서비스 기획" },
      { kind: "type", label: "프로젝트 유형", value: "실제 업무", sub: "기획 2명, 디자이너 1명, 개발자 2명" },
    ],
    image: null,
  },
  atoms: [
    { id: "i3", kind: "zoneTitle", text: "개요" },
    { id: "i5", kind: "text", text: "회원가입 이후 온보딩 과정을 개선해 신규 사용자의 서비스 적응을 지원" },
    { id: "i6", kind: "text", label: "선정 이유", text: "신규 사용자의 초기 이탈 원인을 파악하고 첫 이용 경험을 개선하고자 시작" },
    { id: "i7", kind: "zoneTitle", text: "역할" },
    { id: "i9", kind: "text", text: "사용자 인터뷰 설계, 온보딩 화면 기획. 디자이너와 주 1회 화면 검토, 개발자와 구현 범위 조율" },
  ],
};

function QuestionWindow() {
  const problem = STEPS[2];
  const placeholder = SECTION_FORMS.problem.fields.find((f) => f.name === "phenomenon")?.placeholder ?? "";
  return (
    <div className="absolute left-0 top-0 overflow-hidden rounded-[14px] border border-white/70 bg-white/80 shadow-modal backdrop-blur-md" style={{ width: 520, height: 370 }} aria-hidden="true">
      <div className="flex h-7 items-center gap-1.5 border-b border-line bg-canvas px-3">
        <span className="h-2 w-2 rounded-full bg-line" />
        <span className="h-2 w-2 rounded-full bg-line" />
        <span className="h-2 w-2 rounded-full bg-line" />
      </div>
      <div className="flex" style={{ height: 342 }}>
        <ol className="w-[150px] shrink-0 border-r border-line bg-canvas py-3 text-[11px]">
          {STEPS.map((s) => (
            <li key={s.key} className={`flex items-center gap-2 px-3 py-[5px] ${s.order === 3 ? "bg-accent-soft font-semibold text-accent" : "text-muted"}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${s.order === 3 ? "bg-accent text-white" : "bg-line text-ink"}`}>{s.order}</span>
              <span className="truncate">{s.label}</span>
            </li>
          ))}
        </ol>
        <div className="flex-1 p-4">
          <p className="text-[10px] text-muted">3 / 10 · 질문에 답하기</p>
          <div className="mt-1 h-1 overflow-hidden rounded bg-line">
            <div className="h-full w-[30%] bg-accent" />
          </div>
          <p className="mt-3 text-[15px] font-bold">{problem.label}</p>
          <ul className="mt-1 list-disc pl-4 text-[11px] text-muted">
            {problem.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] font-semibold">어떤 현상인가요?</p>
          <div className="mt-1 h-[74px] rounded-control border border-line px-2.5 py-2 text-[11px] leading-[1.5] text-muted">{placeholder}</div>
          <p className="mt-1 text-[10px] text-muted">회색 글씨는 예시이고 저장되지 않아요.</p>
          <div className="mt-3 flex justify-between text-[11px]">
            <span className="rounded-control border border-line px-3 py-1.5 text-muted">이전 단계</span>
            <span className="rounded-control bg-accent px-3 py-1.5 font-semibold text-white">다음 단계</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 1280×720 페이지 한 장을 카드 안에 통째로 보여 준다 */
function PageCard() {
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-white">
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${PAGE_SCALE})` }}>
        <PageFrame page={samplePage} total={7} />
      </div>
    </div>
  );
}

/** 640×470 크기로 그려 두고 칸 너비에 맞춰 줄여서 보여 준다 */
export function LandingVisual() {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / DESIGN_W));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <figure className="w-full min-w-0">
      <p className="sr-only">질문에 답하는 화면과, 답한 내용으로 만들어진 포트폴리오 PDF 페이지 예시입니다.</p>
      <div ref={box} className="w-full overflow-hidden" style={{ height: DESIGN_H * scale }} aria-hidden="true">
        <div className="relative origin-top-left" style={{ width: DESIGN_W, height: DESIGN_H, transform: `scale(${scale})` }}>
          <QuestionWindow />
          <div className="absolute overflow-hidden rounded-[18px] border-2 border-white/80 bg-white shadow-modal" style={{ left: 170, top: 190, width: CARD_W }}>
            <PageCard />
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-center text-xs text-muted">질문에 답하면 포트폴리오 페이지가 만들어져요 · 예시 화면</figcaption>
    </figure>
  );
}
