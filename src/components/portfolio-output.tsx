"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import type { PortfolioDoc } from "@/lib/portfolio/model";
import { buildOutputPages, paginateAll, type Atom, type FitFn, type HeroCard, type IntroHero, type PhysicalPage } from "@/lib/portfolio/output";

// 출력 페이지의 크기와 배치 (spec 9.1). 설계 캔버스는 1280×720px(16:9)이고, 인쇄할 때는 320×180mm로 줄여서 찍는다.
export const CANVAS_W = 1280;
export const CANVAS_H = 720;
const HEADER_H = 92;
const FOOTER_H = 44;
export const BODY_H = CANVAS_H - HEADER_H - FOOTER_H;
const BODY_PAD = 44;

// 이미지는 구역 안에서 높이 240px을 넘지 않는다. 비율은 유지하고 자르지 않는다 (spec 9.2).
const IMAGE_MAX_H = 240;

const ACCENT = "#315be8";

/** 편집 화면에서 지금 작성 중인 구역을 알리는 표시. 출력(미리보기·PDF)에서는 activeZone을 넘기지 않으므로 나타나지 않는다. */
const zoneProps = (zone: string | undefined, activeZone: string | null | undefined) => {
  const on = Boolean(zone && activeZone && zone === activeZone);
  return { "data-zone": zone, "data-zone-active": on ? "true" : undefined, className: on ? " zone-active" : "" };
};

function AtomView({ atom, activeZone }: { atom: Atom; activeZone?: string | null }) {
  const zp = zoneProps(atom.zone, activeZone);
  switch (atom.kind) {
    case "title":
      return (
        <h2 data-zone={zp["data-zone"]} data-zone-active={zp["data-zone-active"]} className={`break-after-avoid text-[34px] font-bold leading-tight${zp.className}`}>
          {atom.text}
        </h2>
      );
    case "zoneTitle":
      // 구역 제목: 파란 막대 + 굵은 글씨
      return (
        <h3 data-zone={zp["data-zone"]} data-zone-active={zp["data-zone-active"]} className={`mt-3 flex break-after-avoid items-center gap-2.5 text-[21px] font-bold text-[#20242d]${zp.className}`}>
          <span aria-hidden className="h-[22px] w-[6px] shrink-0 rounded-full" style={{ background: ACCENT }} />
          {atom.text}
        </h3>
      );
    case "subtitle":
      return (
        <h3 data-zone={zp["data-zone"]} data-zone-active={zp["data-zone-active"]} className={`mt-3 flex break-after-avoid items-center gap-2.5 text-[22px] font-bold${zp.className}`}>
          <span aria-hidden className="h-[22px] w-[6px] shrink-0 rounded-full" style={{ background: ACCENT }} />
          {atom.text}
        </h3>
      );
    case "badge":
      return (
        <p data-zone={zp["data-zone"]} data-zone-active={zp["data-zone-active"]} className={`break-inside-avoid${zp.className}`}>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#315be8]/30 bg-[#eef3ff] px-4 py-1.5 text-[17px] font-semibold text-[#315be8]">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: ACCENT }} />
            {atom.text}
          </span>
        </p>
      );
    case "tags":
      return (
        <ul data-zone={zp["data-zone"]} data-zone-active={zp["data-zone-active"]} className={`flex break-inside-avoid flex-wrap gap-2${zp.className}`}>
          {atom.items.map((t, i) => (
            <li key={i} className="rounded-full bg-[#eef3ff] px-4 py-1 text-[16px] font-medium text-[#315be8]">
              {t}
            </li>
          ))}
        </ul>
      );
    case "bullet": {
      // 항목 하나가 카드 하나. 이름표(label)가 있으면 파란 제목, 없으면 첫 줄을 굵은 제목으로 쓴다.
      const lines = atom.text.split("\n");
      const heading = atom.label ?? lines[0];
      const body = atom.label ? atom.text : lines.slice(1).join("\n");
      return (
        <div data-zone={zp["data-zone"]} data-zone-active={zp["data-zone-active"]} className={`break-inside-avoid rounded-xl border border-[#e6ebf7] bg-[#f7f9fe] px-4 py-3${zp.className}`}>
          {heading && <p className={`text-[17px] font-bold leading-snug ${atom.label ? "text-[#315be8]" : "text-[#20242d]"}`}>{heading}</p>}
          {body && <p className="mt-1 whitespace-pre-wrap text-[17px] leading-[1.55] text-[#3a4150]">{body}</p>}
        </div>
      );
    }
    case "image":
      return (
        <figure data-zone={zp["data-zone"]} data-zone-active={zp["data-zone-active"]} className={`break-inside-avoid${zp.className}`}>
          {/* 크기를 미리 알고 있어서 불러오기 전에도 자리가 정해진다. 서명 주소 이미지라 next/image 최적화를 쓰지 않는다 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={atom.url ?? undefined}
            alt={atom.decorative ? "" : atom.alt}
            width={atom.width}
            height={atom.height}
            data-image-id={atom.imageId}
            className="rounded-xl border border-[#e2e6ec]"
            style={{ maxHeight: IMAGE_MAX_H, maxWidth: "100%", width: "auto", height: "auto", objectFit: "contain" }}
          />
          {atom.caption && <figcaption className="mt-1 text-[14px] text-[#626b79]">{atom.caption}</figcaption>}
        </figure>
      );
    case "text":
    default:
      if (atom.callout) {
        // 강조 상자: 가장 중요한 한 문장(결과 요약)
        return (
          <p data-zone={zp["data-zone"]} data-zone-active={zp["data-zone-active"]} className={`break-inside-avoid whitespace-pre-wrap rounded-2xl border-l-[6px] bg-[#f0f4ff] px-5 py-4 text-[21px] font-semibold leading-snug${zp.className}`} style={{ borderColor: ACCENT }}>
            {atom.text}
          </p>
        );
      }
      return (
        <p data-zone={zp["data-zone"]} data-zone-active={zp["data-zone-active"]} className={`break-inside-avoid whitespace-pre-wrap text-[18px] leading-[1.6] ${atom.emphasis ? "font-semibold" : ""} ${atom.muted ? "text-[#626b79]" : ""}${zp.className}`}>
          {atom.label && <strong className="mr-1.5 text-[16px] font-semibold text-[#315be8]">{atom.label}</strong>}
          {atom.text}
        </p>
      );
  }
}

type IconKind = HeroCard["kind"] | "goal" | "mail" | "link";

const ICON_PATH: Record<IconKind, React.ReactNode> = {
  period: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  role: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </>
  ),
  type: (
    <>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  goal: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />
    </>
  ),
};

/** 장식용 아이콘(글자로 이미 같은 뜻을 전하므로 화면 읽기 프로그램에서는 숨긴다) */
function HeroIcon({ kind, size = 44 }: { kind: IconKind; size?: number }) {
  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full bg-[#f1f4fb] text-[#315be8]" style={{ width: size, height: size }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {ICON_PATH[kind]}
      </svg>
    </span>
  );
}

/** 프로젝트 소개 첫 장의 위쪽: 제목(+목표), 대표 이미지, 정보 카드, 한 줄 소개 */
function HeroTop({ hero, activeZone }: { hero: IntroHero; activeZone?: string | null }) {
  const z = (zone: string) => zoneProps(zone, activeZone);
  const attrs = (zone: string) => ({ "data-zone": zone, "data-zone-active": z(zone)["data-zone-active"] });
  return (
    <>
      <div className="flex items-start justify-between gap-8">
        <div className="min-w-0 flex-1">
          <div {...attrs("프로젝트 정보")} className={z("프로젝트 정보").className.trim() || undefined}>
            <span className="inline-block rounded-full bg-[#eef3ff] px-4 py-1.5 text-[16px] font-semibold text-[#315be8]">{hero.pill}</span>
            <p className="mt-4 text-[42px] font-bold leading-[1.2]">{hero.title}</p>
          </div>
          {hero.goal && (
            <p {...attrs("목표·검증 지표")} className={`mt-1 text-[28px] font-bold leading-[1.3] text-[#315be8]${z("목표·검증 지표").className}`}>
              {hero.goal}
            </p>
          )}
        </div>
        {hero.image?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero.image.url}
            alt={hero.image.decorative ? "" : hero.image.alt}
            width={hero.image.width}
            height={hero.image.height}
            data-image-id={hero.image.imageId}
            {...attrs("대표 이미지")}
            className={`shrink-0 rounded-2xl border border-[#e2e6ec] bg-white object-contain${z("대표 이미지").className}`}
            style={{ maxWidth: 300, maxHeight: 190, width: "auto", height: "auto" }}
          />
        )}
      </div>

      {hero.cards.length > 0 && (
        <div className="mt-5 grid border-t border-[#e2e6ec] pt-4" style={{ gridTemplateColumns: `repeat(${hero.cards.length}, minmax(0, 1fr))` }}>
          {hero.cards.map((c, i) => (
            <div key={c.kind} {...attrs(c.kind === "role" ? "역할" : "프로젝트 정보")} className={`flex items-start gap-3 px-4 ${i === 0 ? "pl-0" : "border-l border-[#e2e6ec]"}${z(c.kind === "role" ? "역할" : "프로젝트 정보").className}`}>
              <HeroIcon kind={c.kind} />
              <div className="min-w-0">
                <p className="text-[15px] text-[#626b79]">{c.label}</p>
                <p className="text-[19px] font-semibold leading-snug">{c.value}</p>
                {c.sub && <p className="text-[15px] text-[#626b79]">{c.sub}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {hero.oneLine && (
        <div {...attrs("개요·선정 이유")} className={`mt-5 flex items-start gap-4 rounded-2xl bg-[#f0f4ff] px-6 py-4${z("개요·선정 이유").className}`}>
          <HeroIcon kind="goal" size={40} />
          <div className="min-w-0">
            <p className="text-[16px] font-semibold text-[#315be8]">한 줄 소개</p>
            <p className="mt-0.5 text-[22px] font-medium leading-snug">{hero.oneLine}</p>
          </div>
        </div>
      )}
    </>
  );
}

/** 페이지 한 장. 화면 미리보기·전체 미리보기·인쇄·높이 재기가 모두 이 컴포넌트를 쓴다(spec 9.2: 같은 렌더러). */
export function PageFrame({ page, total, bodyRef, activeZone }: { page: PhysicalPage; total: number; bodyRef?: React.Ref<HTMLDivElement>; activeZone?: string | null }) {
  const cover = page.cover;
  const cz = (zone: string) => ({ "data-zone": zone, "data-zone-active": zoneProps(zone, activeZone)["data-zone-active"] });
  const czc = (zone: string) => zoneProps(zone, activeZone).className;
  return (
    <div className="relative overflow-hidden bg-white text-[#20242d]" style={{ width: CANVAS_W, height: CANVAS_H }}>
      {cover ? (
        // 표지: 은은한 색 번짐 배경 위에 직무·이름·소개를 크게
        <div className="relative h-full overflow-hidden" style={{ background: "linear-gradient(135deg,#f1f5ff 0%,#ffffff 58%)" }}>
          <div aria-hidden className="absolute" style={{ right: -150, top: -170, width: 580, height: 580, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #c9d6ff 0%, #e6dcff 55%, rgba(255,255,255,0) 72%)" }} />
          <div aria-hidden className="absolute" style={{ left: -140, bottom: -220, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle at 60% 40%, #cfeaff 0%, rgba(255,255,255,0) 70%)" }} />
          <div aria-hidden className="absolute" style={{ right: 130, bottom: 96, width: 220, height: 220, borderRadius: "50%", border: "2px solid rgba(49,91,232,0.16)" }} />
          <div className="absolute inset-0 flex flex-col justify-center gap-6 px-[96px]">
            {cover.targetRole && (
              <span {...cz("cover:targetRole")} className={`inline-block self-start rounded-full border border-[#dbe4ff] bg-white/80 px-5 py-2 text-[22px] font-semibold text-[#315be8]${czc("cover:targetRole")}`}>
                {cover.targetRole}
              </span>
            )}
            <p {...cz("cover:name")} className={`text-[76px] font-bold leading-[1.1]${czc("cover:name")}`}>{cover.name}</p>
            <span aria-hidden className="block h-[8px] w-[96px] rounded-full" style={{ background: ACCENT }} />
            {cover.tagline && (
              <p {...cz("cover:tagline")} className={`max-w-[780px] text-[30px] leading-snug text-[#3a4150]${czc("cover:tagline")}`}>
                {cover.tagline}
              </p>
            )}
            {(cover.email || cover.link) && (
              <div {...cz("cover:contact")} className={`mt-4 flex flex-col gap-3 text-[22px] text-[#4a5262]${czc("cover:contact")}`}>
                {cover.email && (
                  <p className="flex items-center gap-3">
                    <HeroIcon kind="mail" size={40} />
                    {cover.email}
                  </p>
                )}
                {cover.link && (
                  <p className="flex items-center gap-3 break-all">
                    <HeroIcon kind="link" size={40} />
                    {cover.link}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : page.hero ? (
        <>
          {/* 프로젝트 소개 첫 장: 위쪽 영역 아래에 남은 자리에 나머지 내용이 두 단으로 흐른다 */}
          <div className="absolute inset-x-0 top-0 flex flex-col" style={{ bottom: FOOTER_H, padding: "36px 56px 0" }}>
            <HeroTop hero={page.hero} activeZone={activeZone} />
            <div ref={bodyRef} data-page-body style={{ flex: "1 1 0", minHeight: 0, columnCount: 2, columnGap: 40, columnFill: "auto", overflow: "hidden", marginTop: 18 }}>
              <div className="flex flex-col gap-2">
                {page.atoms.map((a) => (
                  <AtomView key={a.id} atom={a} activeZone={activeZone} />
                ))}
              </div>
            </div>
          </div>
          <footer className="absolute bottom-0 left-0 right-0 flex items-center justify-center text-[16px] text-[#626b79]" style={{ height: FOOTER_H }}>
            {page.pageNumber} / {total}
          </footer>
        </>
      ) : (
        <>
          <header className="flex items-center justify-between gap-6 px-[44px]" style={{ height: HEADER_H, borderBottom: "1px solid #e8ebf2", background: "linear-gradient(180deg,#f9faff 0%,#ffffff 100%)" }}>
            <div className="flex min-w-0 items-center gap-4">
              {page.type.startsWith("project_") && page.headerSub && (
                <span className="shrink-0 rounded-full bg-[#eef3ff] px-4 py-1.5 text-[16px] font-semibold text-[#315be8]">프로젝트 {page.headerSub}</span>
              )}
              <p className="truncate text-[30px] font-bold leading-tight">{page.headerTitle}</p>
            </div>
            {page.continuationIndex > 0 && <span className="shrink-0 rounded-full bg-[#f1f4fb] px-3 py-1 text-[15px] text-[#626b79]">이어짐 {page.continuationIndex + 1}</span>}
          </header>
          {/* 두 단으로 흐르게 하고, 넘치면 오른쪽으로 삐져나오므로 그것으로 높이를 잰다. 조각은 단 사이에서 쪼개지지 않는다. */}
          <div
            ref={bodyRef}
            data-page-body
            style={{ height: BODY_H, columnCount: 2, columnGap: 44, columnFill: "auto", padding: `24px ${BODY_PAD}px 0`, overflow: "hidden" }}
          >
            <div className="flex flex-col gap-2">
              {page.atoms.map((a) => (
                <AtomView key={a.id} atom={a} activeZone={activeZone} />
              ))}
            </div>
          </div>
          <footer className="absolute bottom-0 left-0 right-0 flex items-center justify-center text-[16px] text-[#626b79]" style={{ height: FOOTER_H }}>
            {page.pageNumber} / {total}
          </footer>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 실제 높이를 재서 페이지 나누기
// ---------------------------------------------------------------------------

export type Pagination = {
  status: "measuring" | "ready";
  pages: PhysicalPage[];
  /** 불러오지 못한 이미지(제작본 이미지 id) */
  failedImages: string[];
};

const fakePage = (atoms: Atom[], hero?: IntroHero | null): PhysicalPage => ({ key: "measure", logicalId: "measure", type: "project_intro", headerTitle: "측정", headerSub: "", continuationIndex: 0, atoms, overflow: false, pageNumber: 1, ...(hero ? { hero } : {}) });

/** 그려 본 뒤 내용이 칸 밖으로 삐져나왔는지로 "한 페이지에 들어가는가"를 판단한다 */
function createFits(root: ReturnType<typeof createRoot>, host: HTMLElement, isCancelled: () => boolean): FitFn {
  return (atoms, hero) => {
    // 화면을 떠났거나 내용이 다시 바뀌어 이 계산이 취소되었으면 더 그리지 않는다(이미 닫힌 틀에 그리면 오류가 난다)
    if (isCancelled()) return true;
    flushSync(() => root.render(<PageFrame page={fakePage(atoms, hero)} total={1} />));
    const body = host.querySelector<HTMLElement>("[data-page-body]");
    if (!body) return true;
    // 내용이 세로로 넘치면 둘째 단 아래로, 둘째 단도 넘치면 셋째 단(오른쪽 밖)으로 흐른다. 오른쪽으로 흐르거나 세로 스크롤이 생기면 넘친 것이다.
    return body.scrollWidth <= body.clientWidth + 1 && body.scrollHeight <= body.clientHeight + 1;
  };
}

function loadImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/**
 * 제작본을 출력 페이지로 나눈다. 글꼴이 다 불러와진 뒤에 높이를 다시 재서 결과가 흔들리지 않게 하고,
 * 이미지는 실제로 불러와 보고 실패한 것을 알려 준다 (spec 9.2).
 */
export function usePagination(doc: PortfolioDoc | null): Pagination {
  const [result, setResult] = useState<Pagination>({ status: "measuring", pages: [], failedImages: [] });
  const hostRef = useRef<HTMLDivElement | null>(null);

  // 문서가 바뀌면 다시 잰다. 내용(JSON)이 같으면 같은 결과를 쓴다.
  const key = useMemo(() => (doc ? JSON.stringify([doc.cover, doc.summary, doc.profile, doc.projects, doc.pages]) : ""), [doc]);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    const host = document.createElement("div");
    // 화면 밖에서 실제 크기로 그린다(보이지 않지만 레이아웃은 계산된다)
    host.style.cssText = `position:fixed;left:-20000px;top:0;width:${CANVAS_W}px;height:${CANVAS_H}px;visibility:hidden;pointer-events:none`;
    document.body.appendChild(host);
    hostRef.current = host;
    const root = createRoot(host);

    (async () => {
      const logical = buildOutputPages(doc);
      const fits = createFits(root, host, () => cancelled);

      // 1차: 지금 글꼴로 재고, 글꼴이 다 불러와지면 다시 잰다
      await document.fonts.ready;
      if (cancelled) return;
      let pages = paginateAll(logical, fits);
      await document.fonts.ready;
      if (cancelled) return;
      pages = paginateAll(logical, fits);

      const imageAtoms = pages.flatMap((p) => p.atoms).filter((a): a is Extract<Atom, { kind: "image" }> => a.kind === "image");
      const heroImages = pages.flatMap((p) => (p.hero?.image ? [p.hero.image] : []));
      const checks = await Promise.all([...imageAtoms, ...heroImages].map(async (a) => ({ id: a.imageId, ok: a.url ? await loadImage(a.url) : false })));
      if (cancelled) return;
      setResult({ status: "ready", pages, failedImages: checks.filter((c) => !c.ok).map((c) => c.id) });
    })();

    return () => {
      cancelled = true;
      // 렌더링 중에 정리하면 경고가 나므로 다음 틱에 정리한다
      setTimeout(() => {
        root.unmount();
        host.remove();
      }, 0);
    };
    // key가 doc의 내용을 대표한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return doc ? result : { status: "measuring", pages: [], failedImages: [] };
}

/** 1280×720 캔버스를 넓이에 맞춰 줄여서 보여 준다 */
export function ScaledPage({ page, total, activeZone }: { page: PhysicalPage; total: number; activeZone?: string | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / CANVAS_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} data-scaled-page className="w-full overflow-hidden rounded-card border border-line shadow-card" style={{ aspectRatio: "16 / 9" }}>
      <div style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <PageFrame page={page} total={total} activeZone={activeZone} />
      </div>
    </div>
  );
}
