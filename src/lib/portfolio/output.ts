// 포트폴리오 출력 (spec 9장). 제작본을 "페이지에 놓을 조각(atom)"으로 바꾸고, 실제 높이를 재서 페이지를 나누고, 출력 전 점검을 한다.
// 화면과 분리한 순수 로직이라 테스트할 수 있다. 높이를 재는 부분(브라우저)만 fits 함수로 주입한다.
import { hiddenSections, RESULT_STATUS_GUIDE, sectionsOfZone, PAGE_LAYOUT, REPRESENTATIVE_ZONE, type PageType } from "@/templates/pm-v1";
import { optionLabel } from "@/templates/pm-v1/fields";
import { REPRESENTATIVE } from "@/lib/storage/asset-limits";
import type { ProjectAnswers } from "@/lib/validation/project-answers";
import { orderedPages, PAGE_TYPE_LABEL, type PortfolioDoc, type PortfolioPageDoc, type PortfolioProjectDoc } from "./model";

// ---------------------------------------------------------------------------
// 1. 조각(atom): 페이지에 놓이는 가장 작은 단위. 문단·목록 항목·이미지 하나가 한 조각이다 (spec 9.2: 문단·항목 경계로만 나눈다)
// ---------------------------------------------------------------------------

export type Atom = (
  | { id: string; kind: "title"; text: string } // 프로젝트 이름 같은 큰 제목. 다음 조각과 붙어 다닌다.
  | { id: string; kind: "zoneTitle"; text: string } // 구역 제목. 다음 조각과 붙어 다닌다.
  | { id: string; kind: "subtitle"; text: string } // Summary 항목 제목. 다음 조각과 붙어 다닌다.
  | { id: string; kind: "text"; text: string; label?: string; emphasis?: boolean; muted?: boolean; callout?: boolean } // callout: 강조 상자(결과 요약)
  | { id: string; kind: "bullet"; text: string; label?: string }
  | { id: string; kind: "badge"; text: string }
  | { id: string; kind: "tags"; items: string[] }
  | { id: string; kind: "image"; imageId: string; url: string | null; alt: string; decorative: boolean; caption: string; width: number; height: number }
) & {
  /** 이 조각이 속한 입력 구역. 편집 화면의 "작성 위치" 강조에 쓴다(예: "Problem", "summary:0", "profile:education"). 출력에는 나타나지 않는다. */
  zone?: string;
};

/** id를 뺀 조각. 유니언의 각 모양에서 따로 id를 뺀다(Omit을 바로 쓰면 모양이 뭉개진다). */
export type NewAtom = Atom extends infer A ? (A extends { id: string } ? Omit<A, "id"> : never) : never;

export type CoverData = { name: string; targetRole: string; tagline: string; email: string; link: string };

export type HeroCard = { kind: "period" | "role" | "type"; label: string; value: string; sub?: string };

/**
 * 프로젝트 소개 페이지의 첫 장 위쪽(제목·목표·정보 카드·한 줄 소개·대표 이미지). 모두 사용자가 입력한 값에서 가져오고,
 * 성과 숫자는 "목표"로만 보인다(spec 9.2). 이어지는 장에는 붙지 않는다.
 */
export type IntroHero = {
  pill: string;
  title: string;
  /** 성공 지표의 "기준 → 목표". 지표를 쓰지 않았거나 지표 섹션을 숨겼으면 없다. */
  goal: string | null;
  oneLine: string | null;
  cards: HeroCard[];
  image: { imageId: string; url: string | null; alt: string; decorative: boolean; caption: string; width: number; height: number } | null;
};

export type LogicalPage = {
  id: string;
  type: PortfolioPageDoc["type"];
  /** 페이지 위쪽에 보이는 제목과 부제 */
  headerTitle: string;
  headerSub: string;
  atoms: Atom[];
  /** 표지만 가진다. 표지는 나누지 않는다. */
  cover?: CoverData;
  /** 프로젝트 소개 페이지만 가진다 */
  hero?: IntroHero;
  /** 프로젝트의 여러 페이지를 하나로 이어 붙였을 때, 합쳐진 원래 페이지들의 id (편집 화면이 선택한 페이지의 장을 찾는 데 쓴다) */
  pageIds?: string[];
};

export type PhysicalPage = {
  key: string;
  logicalId: string;
  type: LogicalPage["type"];
  headerTitle: string;
  headerSub: string;
  /** 같은 구역이 이어지면 2, 3…. 첫 장은 0 (spec 10.1의 continuation_index) */
  continuationIndex: number;
  atoms: Atom[];
  cover?: CoverData;
  /** 프로젝트 소개 페이지의 첫 장만 가진다 */
  hero?: IntroHero;
  /** 이 장이 담고 있는 원래 페이지들의 id. 이어 붙이지 않은 페이지는 [logicalId]와 같다. */
  pageIds?: string[];
  /** 조각 하나가 한 페이지보다 커서 나눌 수 없다 (자동 축소·자르기는 하지 않는다, spec 9.2) */
  overflow: boolean;
  pageNumber: number;
};

const KEEP_WITH_NEXT: Atom["kind"][] = ["title", "zoneTitle", "subtitle"];

/** 줄바꿈으로 나눈 문단. 비어 있는 줄은 버린다. */
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export const ZONE_TITLE: Record<string, string> = {
  "개요·선정 이유": "개요",
  역할: "역할",
  Problem: "문제 정의",
  "Research & Evidence": "데이터 및 근거",
  Insight: "핵심 인사이트",
  Hypothesis: "가설",
  Solution: "해결안",
  "대안과 선택 이유": "대안과 선택 이유",
  "목표·검증 지표": "목표·검증 지표",
  Execution: "실행",
  Contribution: "기여",
  Result: "결과",
  Reflection: "회고",
};

const FIXED_ZONE_LABEL: Record<string, string> = {
  "프로젝트 정보": "프로젝트 정보",
  "대표 이미지": "대표 이미지",
  "cover:targetRole": "지원 직무",
  "cover:name": "이름",
  "cover:tagline": "한 줄 소개",
  "cover:contact": "연락처",
  "profile:intro": "소개",
  "profile:education": "교육",
  "profile:careers": "경력",
  "profile:certificates": "자격증",
  "profile:tools": "도구",
};

/** 편집 화면에서 "작성 위치 · ○○"로 보여 줄 이름 */
export function zoneLabel(zone: string | null | undefined): string {
  if (!zone) return "";
  if (zone.startsWith("summary:")) return `Summary 항목 ${Number(zone.slice(8)) + 1}`;
  return FIXED_ZONE_LABEL[zone] ?? ZONE_TITLE[zone] ?? zone;
}

function period(a: ProjectAnswers): string {
  const { startMonth, endMonth, ongoing } = a.overview;
  if (!startMonth && !endMonth && !ongoing) return "";
  return `${startMonth ?? ""} ~ ${ongoing ? "진행 중" : (endMonth ?? "")}`.trim();
}

/** 구역 하나의 내용을 조각으로 바꾼다. 비어 있으면 빈 목록이다(빈 구역은 출력하지 않는다, spec 9.2). */
function zoneAtoms(zone: string, copy: PortfolioProjectDoc, mk: (a: NewAtom) => Atom, hero: IntroHero | null = null): Atom[] {
  const a = copy.answers;
  const out: Atom[] = [];
  const paras = (label: string | undefined, value: string, opts?: { emphasis?: boolean; muted?: boolean; callout?: boolean }) =>
    paragraphs(value).forEach((p, i) => out.push(mk({ kind: "text", text: p, label: i === 0 ? label : undefined, ...opts })));

  switch (zone) {
    case "프로젝트 정보": {
      if (hero) return out; // 소개 위쪽(제목·정보 카드)에 나온다
      out.push(mk({ kind: "title", text: copy.title }));
      const meta = [period(a), optionLabel("overview", "projectType", a.overview.projectType), a.overview.teamSize, optionLabel("execution", "status", a.execution.status)].filter(Boolean);
      if (meta.length) out.push(mk({ kind: "text", text: meta.join(" · "), muted: true }));
      return out;
    }
    case "개요·선정 이유":
      if (!hero) paras(undefined, a.overview.oneLine, { emphasis: true }); // 한 줄 소개는 위쪽 상자에 나온다
      paras(undefined, a.overview.context);
      paras("선정 이유", a.overview.purpose);
      return out;
    case "역할":
      if (!hero || !hero.cards.some((c) => c.kind === "role")) paras(undefined, a.role.title, { emphasis: true }); // 역할 이름은 위쪽 카드에 나온다
      paras(undefined, a.role.responsibility);
      return out;
    case REPRESENTATIVE_ZONE:
      if (hero) return out; // 대표 이미지는 위쪽 오른쪽에 나온다
      for (const img of copy.images.filter((i) => i.section_key === REPRESENTATIVE && i.include_in_output && i.url)) {
        out.push(mk({ kind: "image", imageId: img.id, url: img.url, alt: img.alt_text, decorative: img.decorative, caption: img.caption, width: img.width, height: img.height }));
      }
      return out;
    case "Problem":
      paras("대상", a.problem.targetUser);
      paras("현상", a.problem.phenomenon);
      paras("중요한 이유", a.problem.importance);
      return out;
    case "Research & Evidence":
      // 근거 링크(sourceUrl)는 출력하지 않는다: 제출 문서에 넣을지 정하는 항목이 아직 없어서 내부 주소가 새지 않게 한다 (spec 9.2)
      for (const e of a.evidence.filter((x) => x.kind.trim() || x.description.trim())) {
        const lines = [e.description.trim(), e.observedAt.trim() && `확인 시점: ${e.observedAt.trim()}`, e.limitation.trim() && `한계: ${e.limitation.trim()}`].filter(Boolean);
        out.push(mk({ kind: "bullet", label: e.kind.trim() || undefined, text: lines.join("\n") }));
      }
      return out;
    case "Insight":
      paras("발견", a.insight.pattern);
      paras("해석", a.insight.interpretation);
      paras("한계", a.insight.limitation);
      return out;
    case "Hypothesis":
      paras("가설", a.hypothesis.statement);
      paras("기대하는 변화", a.hypothesis.expectedBehavior);
      return out;
    case "Solution":
      paras(undefined, a.solution.selected);
      return out;
    case "대안과 선택 이유":
      paras("검토한 대안", a.solution.alternatives);
      paras("선택한 이유", a.solution.reason);
      return out;
    case "목표·검증 지표":
      // 목표는 목표로만 보인다. 실제로 확인한 값(actualOptional)이 있을 때만 "실제 값"을 적는다 (spec 9.2)
      for (const m of a.metrics.filter((x) => x.name.trim())) {
        const range = [m.baseline.trim() && `기준 ${m.baseline.trim()}`, m.target.trim() && `목표 ${m.target.trim()}${m.unit.trim()}`].filter(Boolean).join(" → ");
        const lines = [range, m.measurementPlan.trim() && `측정: ${m.measurementPlan.trim()}`, m.actualOptional.trim() && `실제 값: ${m.actualOptional.trim()}`].filter(Boolean);
        out.push(mk({ kind: "bullet", label: [m.name.trim(), optionLabel("metrics", "purpose", m.purpose)].filter(Boolean).join(" · "), text: lines.join("\n") }));
      }
      return out;
    case "Execution":
      paras("진행", a.execution.steps);
      paras("협업·검증", a.execution.collaboration);
      return out;
    case "Contribution":
      for (const c of a.contribution.filter((x) => x.task.trim())) {
        const head = [c.task.trim(), optionLabel("contribution", "ownership", c.ownership), c.percentOptional !== null ? `기여율 ${c.percentOptional}%` : ""].filter(Boolean).join(" · ");
        out.push(mk({ kind: "bullet", text: [head, c.detail.trim()].filter(Boolean).join("\n") }));
      }
      return out;
    case "Result": {
      const label = a.result.status ? RESULT_STATUS_GUIDE[a.result.status].outputLabel : null;
      if (label) out.push(mk({ kind: "badge", text: label })); // "효과 미측정", "제안·검증 예정"은 숨기지 않는다
      paras(undefined, a.result.summary, { emphasis: true, callout: true });
      paras("확인한 사실", a.result.facts);
      paras("한계", a.result.limits);
      paras("다음 검증", a.result.nextValidation);
      return out;
    }
    case "Reflection":
      paras("배운 점", a.reflection.learning);
      paras("한계", a.reflection.limitation);
      paras("다음 단계", a.reflection.nextStep);
      paras("직무와의 연결", a.reflection.roleRelevanceOptional);
      return out;
    default:
      return out;
  }
}

/** 성공 지표 중 목표를 적은 것 하나를 "이름 · 기준 → 목표"로 만든다. 성공 지표를 먼저 고른다. */
function goalLine(a: ProjectAnswers): string | null {
  const withTarget = a.metrics.filter((m) => m.name.trim() && m.target.trim());
  const m = withTarget.find((x) => x.purpose === "primary") ?? withTarget[0];
  if (!m) return null;
  const range = [m.baseline.trim() && `기준 ${m.baseline.trim()}`, `목표 ${m.target.trim()}${m.unit.trim()}`].filter(Boolean).join(" → ");
  const actual = m.actualOptional.trim() ? ` · 실제 ${m.actualOptional.trim()}` : ""; // 확인한 값이 있을 때만
  return `${m.name.trim()} · ${range}${actual}`;
}

/** 프로젝트 소개 페이지 위쪽을 만든다. 보여 줄 섹션이 하나도 없으면 null(기존 모양 그대로). */
function buildIntroHero(doc: PortfolioDoc, copy: PortfolioProjectDoc, page: PortfolioPageDoc): IntroHero | null {
  const keys = page.section_keys;
  const a = copy.answers;
  const hasOverview = keys.includes("overview");
  const hasRole = keys.includes("role");
  if (!hasOverview && !hasRole) return null;

  const cards: HeroCard[] = [];
  if (hasOverview) {
    const per = period(a);
    if (per) cards.push({ kind: "period", label: "프로젝트 기간", value: per });
  }
  if (hasRole && a.role.title.trim()) cards.push({ kind: "role", label: "주요 역할", value: a.role.title.trim() });
  if (hasOverview) {
    const type = optionLabel("overview", "projectType", a.overview.projectType);
    const team = a.overview.teamSize.trim();
    if (type || team) cards.push({ kind: "type", label: "프로젝트 유형", value: type || team, sub: type && team ? team : undefined });
  }

  // 목표는 사용자가 목표·검증 지표를 실행 페이지에 보이도록 둔 경우에만 올린다(숨긴 내용을 다른 곳에서 보이게 하지 않는다)
  const exec = doc.pages.find((p) => p.portfolio_project_id === copy.id && p.type === "project_execution");
  const showGoal = Boolean(exec && !exec.hidden && exec.section_keys.includes("metrics")) && !hiddenSections(a).has("metrics");

  const rep = hasOverview ? copy.images.find((i) => i.section_key === REPRESENTATIVE && i.include_in_output && i.url) : undefined;
  return {
    pill: "프로젝트 소개",
    title: copy.title,
    goal: showGoal ? goalLine(a) : null,
    oneLine: hasOverview ? a.overview.oneLine.trim() || null : null,
    cards,
    image: rep ? { imageId: rep.id, url: rep.url, alt: rep.alt_text, decorative: rep.decorative, caption: rep.caption, width: rep.width, height: rep.height } : null,
  };
}

/** 제작본을 출력할 논리 페이지로 바꾼다. 포트폴리오에 넣지 않은 페이지와 내용이 하나도 없는 페이지는 빠진다. */
export function buildLogicalPages(doc: PortfolioDoc): LogicalPage[] {
  const result: LogicalPage[] = [];

  for (const page of orderedPages(doc)) {
    if (page.hidden) continue;
    let n = 0;
    const mk = (a: NewAtom) => ({ ...a, id: `${page.id}:${n++}` }) as Atom;
    /** 이 구역의 조각으로 표시한다 */
    const zoned = (zone: string, list: Atom[]) => list.map((a) => ({ ...a, zone }) as Atom);

    if (page.type === "cover") {
      const c = doc.cover;
      result.push({
        id: page.id,
        type: "cover",
        headerTitle: "",
        headerSub: "",
        atoms: [],
        // 연락처는 사용자가 포함하도록 켰을 때만 출력한다 (spec 8.3·9.2)
        cover: { name: c.name, targetRole: c.targetRole, tagline: c.tagline, email: c.includeContact ? c.email : "", link: c.includeContact ? c.link : "" },
      });
      continue;
    }

    const atoms: Atom[] = [];

    if (page.type === "summary") {
      doc.summary.items.forEach((item, index) => {
        if (!item.title.trim() && !item.description.trim()) return;
        const part: Atom[] = [];
        if (item.title.trim()) part.push(mk({ kind: "subtitle", text: item.title.trim() }));
        for (const p of paragraphs(item.description)) part.push(mk({ kind: "text", text: p }));
        const names = item.projectIds.map((id) => doc.projects.find((p) => p.id === id)?.title).filter((t): t is string => Boolean(t));
        if (names.length) part.push(mk({ kind: "tags", items: names }));
        atoms.push(...zoned(`summary:${index}`, part));
      });
      if (atoms.length) result.push({ id: page.id, type: "summary", headerTitle: "Summary", headerSub: "", atoms });
      continue;
    }

    if (page.type === "profile") {
      const p = doc.profile;
      atoms.push(...zoned("profile:intro", paragraphs(p.intro).map((para) => mk({ kind: "text", text: para }))));
      const edu = p.education.filter((e) => e.org.trim() || e.course.trim());
      if (edu.length) {
        atoms.push(
          ...zoned("profile:education", [
            mk({ kind: "zoneTitle", text: "교육" }),
            ...edu.map((e) => mk({ kind: "bullet", label: e.period.trim() || undefined, text: [[e.course.trim(), e.org.trim()].filter(Boolean).join(" · "), e.description.trim()].filter(Boolean).join("\n") })),
          ]),
        );
      }
      const careers = p.careers.filter((c) => c.org.trim() || c.role.trim());
      if (careers.length) {
        atoms.push(
          ...zoned("profile:careers", [
            mk({ kind: "zoneTitle", text: "경력" }),
            ...careers.map((c) => mk({ kind: "bullet", label: c.period.trim() || undefined, text: [[c.org.trim(), c.role.trim()].filter(Boolean).join(" · "), c.description.trim()].filter(Boolean).join("\n") })),
          ]),
        );
      }
      const certs = p.certificates.filter((c) => c.name.trim());
      if (certs.length) {
        atoms.push(
          ...zoned("profile:certificates", [
            mk({ kind: "zoneTitle", text: "자격증" }),
            ...certs.map((c) => mk({ kind: "bullet", label: c.date.trim() || undefined, text: [c.name.trim(), c.issuer.trim()].filter(Boolean).join(" · ") })),
          ]),
        );
      }
      const tools = p.tools.filter((t) => t.name.trim());
      if (tools.length) {
        atoms.push(
          ...zoned("profile:tools", [
            mk({ kind: "zoneTitle", text: "도구" }),
            mk({ kind: "tags", items: tools.map((t) => (t.description.trim() ? `${t.name.trim()} · ${t.description.trim()}` : t.name.trim())) }),
          ]),
        );
      }
      if (atoms.length) result.push({ id: page.id, type: "profile", headerTitle: "프로필", headerSub: "", atoms });
      continue;
    }

    // 프로젝트 페이지: 보이도록 정한 섹션의 구역만, 내용이 있는 구역만
    const copy = doc.projects.find((p) => p.id === page.portfolio_project_id);
    if (!copy) continue;
    const type = page.type as PageType;
    const hero = type === "project_intro" ? buildIntroHero(doc, copy, page) : null;
    // 사용자가 뺀 단계(숨기기)의 섹션은 페이지 설정과 상관없이 출력하지 않는다
    const off = hiddenSections(copy.answers);
    for (const zone of PAGE_LAYOUT[type].zones) {
      if (!sectionsOfZone(type, zone).some((s) => page.section_keys.includes(s) && !off.has(s))) continue;
      const items = zoneAtoms(zone, copy, mk, hero);
      if (items.length === 0) continue;
      // 프로젝트 정보는 자체 제목(프로젝트 이름)이 있어서 구역 제목을 붙이지 않는다
      const head: Atom[] = zone !== "프로젝트 정보" ? [mk({ kind: "zoneTitle", text: ZONE_TITLE[zone] ?? zone })] : [];
      atoms.push(...zoned(zone, [...head, ...items]));
    }
    if (atoms.length || hero) result.push({ id: page.id, type: page.type, headerTitle: copy.title, headerSub: PAGE_TYPE_LABEL[page.type], atoms, ...(hero ? { hero } : {}) });
  }
  return result;
}

/**
 * 프로젝트 하나의 소개·분석·실행·결과 페이지를 하나의 흐름으로 이어 붙인다. 앞 페이지의 빈 구역이 있으면 뒤의 내용이 그 자리를 채운다.
 * 프로젝트 사이에서는 합치지 않는다(다른 프로젝트의 내용이 섞이지 않는다). 표지·Summary·프로필은 그대로 둔다.
 * 구역 순서와 "소개 첫 장의 위쪽 영역"은 그대로이고, 어느 장에서 나누든 문단·항목 경계에서만 나뉜다.
 */
export function mergeProjectPages(logical: LogicalPage[], doc: PortfolioDoc): LogicalPage[] {
  const ownerOf = new Map<string, string>();
  const idsOfOwner = new Map<string, string[]>(); // 비어 있거나 숨긴 페이지도 포함한다: 어느 페이지를 골라도 그 프로젝트의 장이 보이게
  for (const p of doc.pages) {
    if (!p.portfolio_project_id) continue;
    ownerOf.set(p.id, p.portfolio_project_id);
    idsOfOwner.set(p.portfolio_project_id, [...(idsOfOwner.get(p.portfolio_project_id) ?? []), p.id]);
  }

  const out: LogicalPage[] = [];
  let group: LogicalPage[] = [];
  let groupOwner: string | null = null;
  const flush = () => {
    if (group.length === 0) return;
    const pageIds = idsOfOwner.get(groupOwner ?? "") ?? group.map((g) => g.id);
    if (group.length === 1) {
      out.push({ ...group[0], pageIds });
    } else {
      const first = group[0];
      const hero = group.find((g) => g.hero)?.hero;
      out.push({
        id: first.id,
        type: first.type,
        headerTitle: first.headerTitle,
        headerSub: "",
        atoms: group.flatMap((g) => g.atoms),
        ...(hero ? { hero } : {}),
        pageIds,
      });
    }
    group = [];
    groupOwner = null;
  };

  for (const page of logical) {
    const owner = page.type.startsWith("project_") ? (ownerOf.get(page.id) ?? null) : null;
    if (owner === null) {
      flush();
      out.push({ ...page, pageIds: [page.id] });
      continue;
    }
    if (groupOwner !== owner) flush();
    groupOwner = owner;
    group.push(page);
  }
  flush();
  return out;
}

/** 화면·출력이 실제로 쓰는 논리 페이지: 제작본을 페이지로 바꾸고 프로젝트 안에서 이어 붙인다. */
export const buildOutputPages = (doc: PortfolioDoc): LogicalPage[] => mergeProjectPages(buildLogicalPages(doc), doc);

// ---------------------------------------------------------------------------
// 2. 페이지 나누기: 조각을 순서대로 채우다가 넘치면 다음 페이지로 보낸다 (spec 9.2)
// ---------------------------------------------------------------------------

/** 제목류 조각은 바로 다음 조각과 한 묶음으로 움직인다(제목만 페이지 끝에 남지 않게). */
export function toUnits(atoms: Atom[]): Atom[][] {
  const units: Atom[][] = [];
  for (let i = 0; i < atoms.length; i++) {
    if (KEEP_WITH_NEXT.includes(atoms[i].kind) && i + 1 < atoms.length) {
      units.push([atoms[i], atoms[i + 1]]);
      i += 1;
    } else {
      units.push([atoms[i]]);
    }
  }
  return units;
}

/** hero가 있으면 그 위쪽 영역이 첫 장에 차지하는 높이를 반영해서 잰다 */
export type FitFn = (atoms: Atom[], hero?: IntroHero | null) => boolean;

/**
 * 같은 구역(zone)이 이어지는 조각 묶음(unit)끼리 다시 묶는다. 구역이 없는 묶음은 각각 하나의 구역이다.
 * 반환값의 각 원소는 한 구역의 묶음(unit) 목록이다.
 */
function groupByZone(atoms: Atom[]): Atom[][][] {
  const groups: Atom[][][] = [];
  for (const unit of toUnits(atoms)) {
    const last = groups[groups.length - 1];
    if (unit[0].zone !== undefined && last && last[0][0].zone === unit[0].zone) last.push(unit);
    else groups.push([unit]);
  }
  return groups;
}

/**
 * 조각 묶음을 페이지로 나눈다. fits는 "이 조각들이 한 페이지에 들어가는가"를 실제 높이로 알려 준다.
 * 한 구역(예: 회고)은 가능하면 한 페이지에 통째로 둔다: 지금 페이지에 다 안 들어가면 구역 전체를 다음 페이지로 넘긴다.
 * 구역 하나가 빈 페이지에도 다 안 들어갈 때만 문단·항목 경계에서 나눈다.
 * 묶음 하나가 혼자서도 들어가지 않으면 자르거나 줄이지 않고 그 페이지에 overflow 표시를 한다.
 */
export function paginate(atoms: Atom[], fits: FitFn, fitsFirst: FitFn = fits): { atoms: Atom[]; overflow: boolean }[] {
  const pages: { atoms: Atom[]; overflow: boolean }[] = [];
  let current: Atom[] = [];
  let isFirst = true;
  const fn = () => (isFirst ? fitsFirst : fits);

  /** 한 묶음을 놓는다. 들어가지 않으면 페이지를 넘기고, 그래도 안 들어가면 overflow 표시를 한다. */
  const placeUnit = (unit: Atom[]) => {
    if (fn()([...current, ...unit])) {
      current.push(...unit);
      return;
    }
    // 첫 장에 위쪽 영역(fitsFirst)이 있어서 첫 묶음도 못 놓지만 다음 장에는 들어가면, 첫 장은 위쪽 영역만 두고 넘긴다
    if (current.length === 0 && isFirst && fitsFirst !== fits && fits(unit)) {
      pages.push({ atoms: [], overflow: false });
      isFirst = false;
      current = [...unit];
      return;
    }
    if (current.length > 0) {
      pages.push({ atoms: current, overflow: false });
      current = [];
      isFirst = false;
    }
    if (fn()(unit)) current = [...unit];
    else {
      pages.push({ atoms: unit, overflow: true });
      isFirst = false;
    }
  };

  for (const units of groupByZone(atoms)) {
    const group = units.flat();
    // 지금 페이지에 구역 전체가 들어가면 그대로 둔다
    if (fn()([...current, ...group])) {
      current.push(...group);
      continue;
    }
    // 다 안 들어가지만 새 페이지에는 통째로 들어가면, 구역을 쪼개지 않고 통째로 다음 페이지로 보낸다
    const startsNewPage = current.length > 0 || (isFirst && fitsFirst !== fits);
    if (startsNewPage && fits(group)) {
      placeUnit(group);
      continue;
    }
    // 구역이 새 페이지에도 다 안 들어가면 문단·항목 경계에서 나눈다
    for (const unit of units) placeUnit(unit);
  }
  if (current.length > 0) pages.push({ atoms: current, overflow: false });
  return pages;
}

/** 논리 페이지들을 실제 페이지로 나누고 쪽 번호를 붙인다. 표지는 나누지 않는다. */
export function paginateAll(logical: LogicalPage[], fits: FitFn): PhysicalPage[] {
  const physical: Omit<PhysicalPage, "pageNumber">[] = [];
  for (const page of logical) {
    if (page.type === "cover") {
      physical.push({ key: `${page.id}#0`, logicalId: page.id, pageIds: page.pageIds ?? [page.id], type: page.type, headerTitle: page.headerTitle, headerSub: page.headerSub, continuationIndex: 0, atoms: [], cover: page.cover, overflow: false });
      continue;
    }
    // 소개 페이지는 위쪽 영역이 있어서 첫 장에 들어갈 자리가 적다. 내용이 하나도 없어도 위쪽 영역만으로 첫 장이 생긴다.
    const heroFits: FitFn = (atoms) => fits(atoms, page.hero);
    const sheets = paginate(page.atoms, fits, page.hero ? heroFits : fits);
    if (sheets.length === 0 && page.hero) sheets.push({ atoms: [], overflow: false });
    sheets.forEach((p, i) => {
      physical.push({ key: `${page.id}#${i}`, logicalId: page.id, pageIds: page.pageIds ?? [page.id], type: page.type, headerTitle: page.headerTitle, headerSub: page.headerSub, continuationIndex: i, atoms: p.atoms, overflow: p.overflow, ...(i === 0 && page.hero ? { hero: page.hero } : {}) });
    });
  }
  return physical.map((p, i) => ({ ...p, pageNumber: i + 1 }));
}

// ---------------------------------------------------------------------------
// 3. 출력 전 점검 (spec 9.3)
// ---------------------------------------------------------------------------

export type Check = {
  id: string;
  /** block: 해결해야 출력할 수 있다 / warn: 확인하고 진행할 수 있다 / info: 알려 주기만 한다 */
  level: "block" | "warn" | "info";
  title: string;
  detail: string;
  /** 고치러 갈 때 선택할 페이지 */
  pageId?: string;
};

const has = (s: string | null | undefined) => Boolean(s && s.trim());

/** 프로젝트 사본에서 비어 있는 핵심 항목의 이름들 (spec 9.3: 프로젝트명·역할·문제·직접 행동·결과 상태와 설명) */
export function missingCoreFields(copy: Pick<PortfolioProjectDoc, "title" | "answers">): string[] {
  // 성공 지표 단계를 뺀 프로젝트는 결과를 쓰지 않기로 한 것이므로 결과 상태·설명을 확인하지 않는다
  const a = copy.answers;
  const missing: string[] = [];
  if (!has(copy.title)) missing.push("프로젝트 이름");
  if (!has(a.role.responsibility)) missing.push("역할");
  if (!has(a.problem.phenomenon)) missing.push("문제(현상)");
  if (!a.contribution.some((c) => has(c.task))) missing.push("직접 한 일");
  if (!hiddenSections(a).has("result")) {
    if (!a.result.status) missing.push("결과 상태");
    if (!has(a.result.summary)) missing.push("결과 설명");
  }
  return missing;
}

export type PreflightInput = {
  doc: PortfolioDoc;
  pages: PhysicalPage[];
  /** 불러오지 못한 이미지(제작본 이미지 id) */
  failedImages: string[];
  /** 저장하지 못한 변경이나 충돌이 있는가 */
  saveBlock?: "unsaved" | "conflict" | null;
};

export function runPreflight({ doc, pages, failedImages, saveBlock }: PreflightInput): Check[] {
  const checks: Check[] = [];
  const projectPages = (copyId: string) => doc.pages.filter((p) => p.portfolio_project_id === copyId);
  const coverPage = doc.pages.find((p) => p.type === "cover");
  const copies = [...doc.projects].sort((a, b) => a.sort_order - b.sort_order);

  // ---- 차단 ----
  if (!has(doc.cover.name)) checks.push({ id: "cover-name", level: "block", title: "표지에 이름이 없어요", detail: "표지에 이름을 입력해 주세요.", pageId: coverPage?.id });

  const usable = copies.filter((c) => projectPages(c.id).some((p) => !p.hidden));
  if (copies.length === 0) checks.push({ id: "no-project", level: "block", title: "프로젝트가 없어요", detail: "프로젝트 아카이브에서 프로젝트를 한 개 이상 담아 주세요." });
  else if (usable.length === 0) checks.push({ id: "no-visible-project", level: "block", title: "포트폴리오에 넣은 프로젝트 페이지가 없어요", detail: "프로젝트 페이지를 하나 이상 넣어 주세요." });

  for (const c of usable) {
    const missing = missingCoreFields(c);
    if (missing.length) {
      checks.push({ id: `core-${c.id}`, level: "block", title: `‘${c.title || "제목 없음"}’의 필수 항목이 비어 있어요`, detail: `${missing.join(", ")}을(를) 채워 주세요.`, pageId: projectPages(c.id)[0]?.id });
    }
  }

  pages
    .filter((p) => p.overflow)
    .forEach((p) =>
      checks.push({
        id: `overflow-${p.key}`,
        level: "block",
        title: `내용이 한 페이지를 넘어요 (${p.headerTitle || PAGE_TYPE_LABEL[p.type]})`,
        detail: "한 문단이나 이미지 하나가 페이지보다 커요. 문단을 줄이거나 나눠서 써 주세요. 글자를 줄이거나 잘라서 맞추지는 않아요.",
        pageId: p.logicalId,
      }),
    );

  if (failedImages.length > 0) checks.push({ id: "image-failed", level: "block", title: `이미지를 불러오지 못했어요 (${failedImages.length}개)`, detail: "연결을 확인하고 새로고침해 주세요. 계속 안 되면 이미지를 다시 올려 주세요." });
  if (saveBlock === "unsaved") checks.push({ id: "unsaved", level: "block", title: "저장하지 못한 변경이 있어요", detail: "편집 화면에서 저장 상태를 확인한 뒤 다시 열어 주세요." });
  if (saveBlock === "conflict") checks.push({ id: "conflict", level: "block", title: "다른 곳에서 수정되어 저장이 멈췄어요", detail: "편집 화면에서 최신 버전을 연 뒤 다시 확인해 주세요." });

  // ---- 주의 (확인하고 진행할 수 있다) ----
  const summaryPage = doc.pages.find((p) => p.type === "summary");
  if (summaryPage?.hidden || !doc.summary.items.some((i) => has(i.title) || has(i.description))) {
    checks.push({ id: "no-summary", level: "warn", title: "Summary가 없어요", detail: "핵심 역량 요약이 있으면 채용 담당자가 먼저 읽기 쉬워요.", pageId: summaryPage?.id });
  }

  for (const c of usable) {
    if (c.answers.hiddenSteps.includes("evidence")) continue; // 근거 단계를 뺀 프로젝트에는 근거 안내를 하지 않는다
    const hasEvidence = c.answers.evidence.some((e) => has(e.description)) || c.images.some((i) => i.include_in_output);
    if (!hasEvidence) checks.push({ id: `evidence-${c.id}`, level: "warn", title: `‘${c.title}’에 근거가 없어요`, detail: "데이터·관찰 같은 근거나 이미지를 더하면 설명이 더 단단해져요.", pageId: projectPages(c.id)[0]?.id });
  }

  if (doc.cover.includeContact && (has(doc.cover.email) || has(doc.cover.link))) {
    checks.push({ id: "contact", level: "warn", title: "연락처가 출력에 포함돼요", detail: "표지에 이메일·링크가 보여요. 제출할 곳에 맞는지 확인해 주세요.", pageId: coverPage?.id });
  }

  for (const c of usable) {
    const status = c.answers.result.status;
    const resultVisible = !hiddenSections(c.answers).has("result") && projectPages(c.id).some((p) => p.type === "project_result" && !p.hidden);
    if (resultVisible && (status === "not_measured" || status === "not_executed")) {
      const label = RESULT_STATUS_GUIDE[status].outputLabel;
      checks.push({ id: `unverified-${c.id}`, level: "warn", title: `‘${c.title}’에 미검증 결과가 포함돼요`, detail: `‘${label}’ 표시가 붙어서 실제 성과로 읽히지 않게 출력돼요. 이 표시는 끌 수 없어요.`, pageId: projectPages(c.id).find((p) => p.type === "project_result")?.id });
    }
  }

  // ---- 안내 ----
  const continued = pages.filter((p) => p.continuationIndex > 0).length;
  if (continued > 0) checks.push({ id: "continued", level: "info", title: `내용이 길어서 ${continued}장이 이어지는 페이지로 나뉘어요`, detail: "문단·항목 경계에서만 나누고, 글자를 줄이거나 자르지 않아요." });

  return checks;
}

export const countByLevel = (checks: Check[]) => ({
  block: checks.filter((c) => c.level === "block").length,
  warn: checks.filter((c) => c.level === "warn").length,
  info: checks.filter((c) => c.level === "info").length,
});
