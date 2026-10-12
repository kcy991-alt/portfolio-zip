import { motion } from "motion/react";
import type { ReactNode } from "react";
import { IMAGE_ZONE, OUTPUT_ZONES, PAGE_LAYOUT, PAGE_ORDER, REPRESENTATIVE_ZONE, RESULT_STATUS_GUIDE, sectionsOfZone, type PageType } from "@/templates/pm-v1";
import { REPRESENTATIVE } from "@/lib/storage/asset-limits";
import { SECTION_FORMS } from "@/templates/pm-v1/fields";
import type { ProjectAnswers, SectionKey } from "@/lib/validation/project-answers";

function optionLabel(section: SectionKey, field: string, value: string | null | undefined): string {
  if (!value) return "";
  return SECTION_FORMS[section].fields.find((f) => f.name === field)?.options?.find((o) => o.value === value)?.label ?? "";
}

function Text({ children }: { children?: string }) {
  if (!children || children.trim() === "") return null;
  return <p className="whitespace-pre-wrap">{children}</p>;
}

/** 구역별 본문. 내용이 없으면 null을 돌려주며, 편집 미리보기에서는 빈 구역 윤곽만 보인다. */
function zoneBody(zone: string, a: ProjectAnswers, title: string): ReactNode | null {
  const has = (...v: (string | null | undefined)[]) => v.some((x) => x && x.trim() !== "");

  switch (zone) {
    case "프로젝트 정보": {
      const period =
        a.overview.startMonth || a.overview.endMonth || a.overview.ongoing
          ? `${a.overview.startMonth ?? ""} ~ ${a.overview.ongoing ? "진행 중" : (a.overview.endMonth ?? "")}`
          : "";
      const type = optionLabel("overview", "projectType", a.overview.projectType);
      const status = optionLabel("execution", "status", a.execution.status);
      if (!has(title, period, type, status)) return null;
      return (
        <>
          <p className="text-base font-bold">{title}</p>
          <p className="text-muted">{[period, type, status].filter(Boolean).join(" · ")}</p>
        </>
      );
    }
    case "개요·선정 이유":
      if (!has(a.overview.oneLine, a.overview.context, a.overview.purpose)) return null;
      return (
        <>
          <Text>{a.overview.oneLine}</Text>
          <Text>{a.overview.context}</Text>
          <Text>{a.overview.purpose}</Text>
        </>
      );
    case "역할":
      if (!has(a.role.title, a.role.responsibility)) return null;
      return (
        <>
          <p className="font-medium">{a.role.title}</p>
          <Text>{a.role.responsibility}</Text>
        </>
      );
    case "대표 이미지":
      return null;
    case "Problem":
      if (!has(a.problem.targetUser, a.problem.phenomenon, a.problem.importance)) return null;
      return (
        <>
          <Text>{a.problem.targetUser}</Text>
          <Text>{a.problem.phenomenon}</Text>
          <Text>{a.problem.importance}</Text>
        </>
      );
    case "Research & Evidence": {
      const items = a.evidence.filter((e) => has(e.kind, e.description));
      if (items.length === 0) return null;
      return (
        <ul className="list-disc pl-5">
          {items.map((e, i) => (
            <li key={i}>
              {e.kind && <strong>{e.kind}: </strong>}
              {e.description}
            </li>
          ))}
        </ul>
      );
    }
    case "Insight":
      if (!has(a.insight.pattern, a.insight.interpretation, a.insight.limitation)) return null;
      return (
        <>
          <Text>{a.insight.pattern}</Text>
          <Text>{a.insight.interpretation}</Text>
          <Text>{a.insight.limitation}</Text>
        </>
      );
    case "Hypothesis":
      if (!has(a.hypothesis.statement, a.hypothesis.expectedBehavior)) return null;
      return (
        <>
          <Text>{a.hypothesis.statement}</Text>
          <Text>{a.hypothesis.expectedBehavior}</Text>
        </>
      );
    case "Solution":
      return has(a.solution.selected) ? <Text>{a.solution.selected}</Text> : null;
    case "대안과 선택 이유":
      if (!has(a.solution.alternatives, a.solution.reason)) return null;
      return (
        <>
          <Text>{a.solution.alternatives}</Text>
          <Text>{a.solution.reason}</Text>
        </>
      );
    case "목표·검증 지표": {
      const items = a.metrics.filter((m) => has(m.name));
      if (items.length === 0) return null;
      return (
        <ul className="list-disc pl-5">
          {items.map((m, i) => (
            <li key={i}>
              {m.name}
              {m.target && ` — 목표 ${m.target}${m.unit}`}
              {m.measurementPlan && ` (${m.measurementPlan})`}
            </li>
          ))}
        </ul>
      );
    }
    case "Execution":
      if (!has(a.execution.steps, a.execution.collaboration)) return null;
      return (
        <>
          <Text>{a.execution.steps}</Text>
          <Text>{a.execution.collaboration}</Text>
        </>
      );
    case "Contribution": {
      const items = a.contribution.filter((c) => has(c.task));
      if (items.length === 0) return null;
      return (
        <ul className="list-disc pl-5">
          {items.map((c, i) => (
            <li key={i}>
              {c.task}
              {c.ownership && ` — ${optionLabel("contribution", "ownership", c.ownership)}`}
              {c.percentOptional !== null && ` (${c.percentOptional}%)`}
            </li>
          ))}
        </ul>
      );
    }
    case "Result": {
      const statusLabel = a.result.status ? RESULT_STATUS_GUIDE[a.result.status].outputLabel : null;
      if (!has(a.result.summary, a.result.facts, a.result.limits, a.result.nextValidation) && !a.result.status) return null;
      return (
        <>
          {statusLabel && (
            <p>
              <span className="rounded bg-canvas px-2 py-0.5 text-sm font-medium">{statusLabel}</span>
            </p>
          )}
          <Text>{a.result.summary}</Text>
          <Text>{a.result.facts}</Text>
          <Text>{a.result.limits}</Text>
          <Text>{a.result.nextValidation}</Text>
        </>
      );
    }
    case "Reflection":
      if (!has(a.reflection.learning, a.reflection.limitation, a.reflection.nextStep)) return null;
      return (
        <>
          <Text>{a.reflection.learning}</Text>
          <Text>{a.reflection.limitation}</Text>
          <Text>{a.reflection.nextStep}</Text>
        </>
      );
    default:
      return null;
  }
}

export type PreviewImage = {
  section_key: string;
  url: string | null;
  alt_text: string;
  caption: string;
  decorative: boolean;
  include_in_output: boolean;
};

export function pageOfSection(section: SectionKey): PageType {
  return OUTPUT_ZONES[section][0].page;
}

/**
 * 프로젝트 페이지 한 장을 구역별로 보여 준다. 경험 편집 화면과 포트폴리오 제작 화면이 같이 쓴다.
 * visibleSections가 있으면 그 섹션에서 오는 구역만 보인다(포트폴리오의 페이지별 "섹션 표시").
 */
export function ProjectPageView({
  title,
  answers,
  page,
  activeSection,
  activeZone,
  images = [],
  visibleSections,
}: {
  title: string;
  answers: ProjectAnswers;
  page: PageType;
  activeSection?: SectionKey;
  /** 지금 입력 중인 항목이 들어갈 구역. 있으면 이 구역만 강조한다(activeSection보다 우선). */
  activeZone?: string;
  images?: PreviewImage[];
  visibleSections?: string[];
}) {
  const layout = PAGE_LAYOUT[page];
  const activeZones = new Set(
    activeZone ? [activeZone] : activeSection ? OUTPUT_ZONES[activeSection].filter((z) => z.page === page).map((z) => z.zone) : [],
  );
  const zones = layout.zones.filter((zone) => !visibleSections || sectionsOfZone(page, zone).some((s) => visibleSections.includes(s)));

  return (
    <div className="grid gap-2.5 rounded-card border border-line bg-panel p-3 sm:grid-cols-2">
      {zones.map((zone) => {
        const body = zoneBody(zone, answers, title);
        // 이 구역에 붙인 이미지 (출력에 포함으로 표시한 것만 보여 준다)
        const zoneImages = images.filter(
          (i) =>
            i.include_in_output &&
            i.url &&
            (i.section_key === REPRESENTATIVE ? zone === REPRESENTATIVE_ZONE : IMAGE_ZONE[i.section_key as SectionKey] === zone),
        );
        const active = activeZones.has(zone);
        return (
          <section
            key={zone}
            aria-label={zone}
            className={`relative flex min-h-16 flex-col gap-1 rounded-control border p-2.5 text-[14px] ${
              active ? "border-transparent" : "border-dashed border-line"
            } ${zone === "프로젝트 정보" || zone === "Result" ? "sm:col-span-2" : ""}`}
          >
            {/* 파란 강조 틀은 구역 사이를 부드럽게 옮겨 다닌다(layoutId). 입력 칸을 옮겨도 눈이 따라갈 수 있다. */}
            {active && (
              <motion.span
                aria-hidden
                layoutId="active-zone-ring"
                className="pointer-events-none absolute -inset-px rounded-control border-2 border-accent bg-accent-soft"
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
              />
            )}
            <div className="relative flex items-center justify-between gap-2 text-[13px]">
              <h3 className="font-medium text-muted">{zone}</h3>
              {active && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: 0.08 }}
                  className="rounded bg-accent px-2 py-0.5 text-xs font-medium text-white"
                >
                  작성 위치
                </motion.span>
              )}
            </div>
            <div className="relative flex flex-col gap-1">{body}</div>
            {zoneImages.length > 0 && (
              <ul className="relative mt-1 flex flex-wrap gap-2">
                {zoneImages.map((img, index) => (
                  <li key={index} className="max-w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url!} alt={img.decorative ? "" : img.alt_text} className="max-h-24 max-w-full rounded object-contain" />
                    {img.caption && <p className="text-xs text-muted">{img.caption}</p>}
                  </li>
                ))}
              </ul>
            )}
            {!body && zoneImages.length === 0 && (
              <p className="relative text-[13px] text-muted">{zone === REPRESENTATIVE_ZONE ? "아직 대표 이미지가 없어요." : "작성한 내용이 여기에 표시돼요."}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function ProjectPagePreview({
  title,
  answers,
  activeZone,
  page,
  onPageChange,
  images = [],
  onCollapse,
}: {
  title: string;
  answers: ProjectAnswers;
  activeZone: string;
  page: PageType;
  onPageChange: (p: PageType) => void;
  images?: PreviewImage[];
  /** 있으면 "미리보기 접기" 버튼을 보여 준다(넓은 화면에서만 의미가 있다) */
  onCollapse?: () => void;
}) {
  const layout = PAGE_LAYOUT[page];
  const pageIndex = PAGE_ORDER.indexOf(page);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">포트폴리오 미리보기 · 프로젝트 {layout.title}</h2>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            disabled={pageIndex === 0}
            onClick={() => onPageChange(PAGE_ORDER[pageIndex - 1])}
            className="min-h-11 rounded-control border border-line px-3 disabled:text-muted"
          >
            이전
          </button>
          <span aria-live="polite">
            페이지 {pageIndex + 1} / {PAGE_ORDER.length}
          </span>
          <button
            type="button"
            disabled={pageIndex === PAGE_ORDER.length - 1}
            onClick={() => onPageChange(PAGE_ORDER[pageIndex + 1])}
            className="min-h-11 rounded-control border border-line px-3 disabled:text-muted"
          >
            다음
          </button>
        </div>
      </div>
      <ProjectPageView title={title} answers={answers} page={page} activeZone={activeZone} images={images} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">작성한 내용이 포트폴리오에 어떻게 배치될지 미리 확인할 수 있어요.</p>
        {onCollapse && (
          <button type="button" onClick={onCollapse} className="hidden min-h-11 items-center rounded-control border border-line px-3 text-sm hover:bg-canvas xl:inline-flex">
            미리보기 접기
          </button>
        )}
      </div>
    </div>
  );
}