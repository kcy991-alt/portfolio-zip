import { describe, expect, it } from "vitest";
import { addProjectCopy, createLocalPortfolio, type PortfolioDoc } from "@/lib/portfolio/model";
import {
  buildLogicalPages,
  countByLevel,
  missingCoreFields,
  paginate,
  paginateAll,
  paragraphs,
  runPreflight,
  toUnits,
  type Atom,
  type FitFn,
} from "@/lib/portfolio/output";
import { emptyProjectAnswers, type ProjectAnswers } from "@/lib/validation/project-answers";

/** 필수 항목을 모두 채운 프로젝트 */
function completeAnswers(): ProjectAnswers {
  const a = emptyProjectAnswers();
  a.overview.oneLine = "가입 흐름을 개선한 프로젝트";
  a.role.title = "서비스 기획";
  a.role.responsibility = "인터뷰 설계와 화면 기획";
  a.problem.phenomenon = "사용자가 다음 행동을 찾기 어려웠어요";
  a.contribution = [{ task: "인터뷰 질문지 설계", ownership: "lead", detail: "", percentOptional: null }];
  a.evidence = [{ kind: "인터뷰", description: "5명 중 4명이 같은 어려움을 말했어요", sourceUrl: "https://internal.example.com/secret", observedAt: "2026-03", limitation: "표본이 작아요" }];
  a.result.status = "observed";
  a.result.summary = "프로토타입 테스트에서 첫 설정을 마쳤어요";
  return a;
}

function build(mutate?: (doc: PortfolioDoc) => PortfolioDoc, answers = completeAnswers()) {
  let doc = createLocalPortfolio("지원용");
  doc = { ...doc, cover: { ...doc.cover, name: "홍길동" } };
  doc = addProjectCopy(doc, { id: "p1", title: "온보딩 개선", answers }, "pp1").doc;
  return mutate ? mutate(doc) : doc;
}

const logical = (doc: PortfolioDoc) => buildLogicalPages(doc);
const textOf = (doc: PortfolioDoc) =>
  JSON.stringify(logical(doc).flatMap((p) => p.atoms.map((a) => ("text" in a ? a.text : "items" in a ? a.items.join(",") : ""))));

describe("paragraphs", () => {
  it("줄바꿈으로 문단을 나누고 빈 줄은 버린다", () => {
    expect(paragraphs("첫째\n\n  둘째  \n셋째")).toEqual(["첫째", "둘째", "셋째"]);
    expect(paragraphs("")).toEqual([]);
    expect(paragraphs(null)).toEqual([]);
  });
});

describe("buildLogicalPages: 무엇을 출력하는가", () => {
  it("표지는 항상 맨 앞에 있고, 내용 없는 Summary·프로필·프로젝트 페이지는 만들지 않는다", () => {
    const pages = logical(build());
    expect(pages[0].type).toBe("cover");
    expect(pages.map((p) => p.type)).not.toContain("summary");
    expect(pages.map((p) => p.type)).not.toContain("profile");
    // 이 프로젝트는 소개·분석·실행·결과에 내용이 있다
    expect(pages.map((p) => p.type)).toEqual(expect.arrayContaining(["project_intro", "project_analysis", "project_execution", "project_result"]));
  });

  it("빈 구역은 출력하지 않는다: 문제만 있으면 다른 구역 제목은 나오지 않는다", () => {
    const a = emptyProjectAnswers();
    a.problem.phenomenon = "문제만 적었어요";
    const pages = logical(build(undefined, a));
    const analysis = pages.find((p) => p.type === "project_analysis")!;
    const titles = analysis.atoms.filter((x) => x.kind === "zoneTitle").map((x) => (x as { text: string }).text);
    expect(titles).toEqual(["문제 정의"]);
    expect(pages.find((p) => p.type === "project_execution")).toBeUndefined();
  });

  it("포트폴리오에 넣지 않은 페이지와 숨긴 섹션은 출력하지 않는다", () => {
    const doc = build((d) => ({
      ...d,
      pages: d.pages.map((p) => (p.type === "project_analysis" ? { ...p, hidden: true } : p.type === "project_intro" ? { ...p, section_keys: ["role"] } : p)),
    }));
    const pages = logical(doc);
    expect(pages.find((p) => p.type === "project_analysis")).toBeUndefined();
    const intro = pages.find((p) => p.type === "project_intro")!;
    expect(JSON.stringify(intro.atoms)).not.toContain("가입 흐름을 개선한 프로젝트"); // overview 섹션을 숨겼다
    expect(JSON.stringify(intro.atoms)).toContain("인터뷰 설계와 화면 기획");
  });

  it("연락처는 포함을 켰을 때만 표지에 나온다", () => {
    const withContact = (include: boolean) =>
      build((d) => ({ ...d, cover: { ...d.cover, email: "me@example.com", link: "https://me.dev", includeContact: include } }));
    expect(logical(withContact(false))[0].cover).toMatchObject({ email: "", link: "" });
    expect(logical(withContact(true))[0].cover).toMatchObject({ email: "me@example.com", link: "https://me.dev" });
  });

  it("근거 링크(내부 주소)는 출력하지 않고 설명과 한계는 출력한다", () => {
    const text = textOf(build());
    expect(text).not.toContain("internal.example.com");
    expect(text).toContain("5명 중 4명이 같은 어려움을 말했어요");
    expect(text).toContain("한계: 표본이 작아요");
  });

  it("목표는 목표로만 적고, 확인한 실제 값이 있을 때만 '실제 값'을 적는다", () => {
    const a = completeAnswers();
    a.metrics = [
      { name: "첫 설정 완료율", purpose: "primary", baseline: "40%", target: "60", unit: "%", measurementPlan: "테스트 과제 관찰", actualOptional: "" },
      { name: "이탈률", purpose: "guardrail", baseline: "", target: "", unit: "", measurementPlan: "", actualOptional: "55%로 확인" },
    ];
    const text = textOf(build(undefined, a));
    expect(text).toContain("목표 60%");
    expect(text).toContain("실제 값: 55%로 확인");
    expect(text.match(/실제 값/g)).toHaveLength(1);
  });

  it("미검증 결과에는 '효과 미측정'·'제안·검증 예정' 표시가 붙고, 확인한 결과에는 붙지 않는다", () => {
    const resultAtoms = (status: "observed" | "not_measured" | "not_executed") => {
      const a = completeAnswers();
      a.result.status = status;
      return logical(build(undefined, a)).find((p) => p.type === "project_result")!.atoms;
    };
    const badges = (atoms: Atom[]) => atoms.filter((x) => x.kind === "badge").map((x) => (x as { text: string }).text);
    expect(badges(resultAtoms("not_measured"))).toEqual(["효과 미측정"]);
    expect(badges(resultAtoms("not_executed"))).toEqual(["제안·검증 예정"]);
    expect(badges(resultAtoms("observed"))).toEqual([]);
  });

  it("출력에는 도움 문구나 예시 안내가 들어가지 않는다", () => {
    const text = textOf(build());
    for (const banned of ["아직 작성하지 않았어요", "지금 작성 중", "이미지를 불러오지", "수치가 없어도 정리할 수 있어요"]) {
      expect(text).not.toContain(banned);
    }
  });

  it("Summary는 제목·설명·연결 프로젝트 이름으로 나오고, 지워진 사본 연결은 나오지 않는다", () => {
    const doc = build((d) => ({ ...d, summary: { items: [{ id: "s1", title: "문제 해결", description: "데이터로 정의해요", projectIds: ["pp1", "사라진-사본"] }] } }));
    const summary = logical(doc).find((p) => p.type === "summary")!;
    const tags = summary.atoms.find((x) => x.kind === "tags") as { items: string[] };
    expect(tags.items).toEqual(["온보딩 개선"]);
  });

  it("프로필은 비어 있는 영역을 숨기고 도구에 점수를 붙이지 않는다", () => {
    const doc = build((d) => ({ ...d, profile: { intro: "", education: [], careers: [], tools: [{ id: "t1", name: "Figma", description: "" }] } }));
    const profile = logical(doc).find((p) => p.type === "profile")!;
    expect(profile.atoms.filter((x) => x.kind === "zoneTitle").map((x) => (x as { text: string }).text)).toEqual(["도구"]);
    expect(JSON.stringify(profile.atoms)).not.toMatch(/%|숙련/);
  });
});

describe("페이지 나누기", () => {
  const atom = (i: number, kind: Atom["kind"] = "text"): Atom => ({ id: `a${i}`, kind, text: `조각 ${i}` }) as Atom;
  /** 조각 하나가 높이 1이고 페이지는 높이 capacity: 높이를 직접 재지 않고도 규칙을 검사한다 */
  const capacity = (cap: number): FitFn => (atoms) => atoms.length <= cap;

  it("넘치면 다음 페이지로 보내고, 조각의 순서를 바꾸지 않는다", () => {
    const atoms = Array.from({ length: 7 }, (_, i) => atom(i));
    const pages = paginate(atoms, capacity(3));
    expect(pages.map((p) => p.atoms.length)).toEqual([3, 3, 1]);
    expect(pages.flatMap((p) => p.atoms.map((a) => a.id))).toEqual(atoms.map((a) => a.id));
    expect(pages.every((p) => !p.overflow)).toBe(true);
  });

  it("조각을 자르거나 버리지 않는다", () => {
    const atoms = Array.from({ length: 10 }, (_, i) => atom(i));
    expect(paginate(atoms, capacity(4)).flatMap((p) => p.atoms)).toHaveLength(10);
  });

  it("제목은 바로 다음 조각과 같은 페이지에 있는다(제목만 페이지 끝에 남지 않는다)", () => {
    const atoms = [atom(0), atom(1), atom(2, "zoneTitle"), atom(3)];
    expect(toUnits(atoms).map((u) => u.length)).toEqual([1, 1, 2]);
    const pages = paginate(atoms, capacity(3)); // 0,1은 한 페이지 → 제목+다음 조각(2)은 다음 페이지로
    expect(pages.map((p) => p.atoms.map((a) => a.id))).toEqual([["a0", "a1"], ["a2", "a3"]]);
  });

  it("한 묶음이 혼자서도 들어가지 않으면 줄이거나 자르지 않고 넘침으로 표시한다", () => {
    const atoms = [atom(0), atom(1), atom(2)];
    const tooBig: FitFn = (list) => !list.some((a) => a.id === "a1"); // a1은 어떤 페이지에도 안 들어간다
    const pages = paginate(atoms, tooBig);
    expect(pages.map((p) => ({ ids: p.atoms.map((a) => a.id), overflow: p.overflow }))).toEqual([
      { ids: ["a0"], overflow: false },
      { ids: ["a1"], overflow: true },
      { ids: ["a2"], overflow: false },
    ]);
  });

  it("조각이 하나도 없으면 페이지를 만들지 않는다", () => {
    expect(paginate([], capacity(3))).toEqual([]);
  });

  it("긴 내용은 이어지는 페이지로 나뉘고 쪽 번호와 이어짐 번호가 연속된다", () => {
    const doc = build((d) => d);
    const pages = paginateAll(logical(doc), capacity(2));
    expect(pages.map((p) => p.pageNumber)).toEqual(pages.map((_, i) => i + 1));
    const analysis = pages.filter((p) => p.type === "project_analysis");
    expect(analysis.length).toBeGreaterThan(1);
    expect(analysis.map((p) => p.continuationIndex)).toEqual(analysis.map((_, i) => i));
    expect(analysis.every((p) => p.headerTitle === "온보딩 개선")).toBe(true);
  });

  it("표지는 나누지 않는다", () => {
    const pages = paginateAll(logical(build()), capacity(1));
    expect(pages.filter((p) => p.type === "cover")).toHaveLength(1);
  });
});

describe("출력 전 점검", () => {
  const run = (doc: PortfolioDoc, extra: Partial<Parameters<typeof runPreflight>[0]> = {}) =>
    runPreflight({ doc, pages: paginateAll(logical(doc), () => true), failedImages: [], ...extra });
  const ids = (checks: ReturnType<typeof run>, level: string) => checks.filter((c) => c.level === level).map((c) => c.id);

  it("모두 갖춘 제작본은 차단 항목이 없다", () => {
    expect(countByLevel(run(build())).block).toBe(0);
  });

  it("표지 이름이 없으면 차단한다", () => {
    const doc = build((d) => ({ ...d, cover: { ...d.cover, name: "  " } }));
    expect(ids(run(doc), "block")).toContain("cover-name");
  });

  it("프로젝트가 없으면 차단한다", () => {
    const doc = { ...createLocalPortfolio("빈 제작본"), cover: { ...createLocalPortfolio("x").cover, name: "홍길동" } };
    expect(ids(run(doc), "block")).toContain("no-project");
  });

  it("프로젝트 페이지를 모두 빼면 차단한다", () => {
    const doc = build((d) => ({ ...d, pages: d.pages.map((p) => (p.portfolio_project_id ? { ...p, hidden: true } : p)) }));
    expect(ids(run(doc), "block")).toContain("no-visible-project");
  });

  it("필수 항목(역할·문제·직접 한 일·결과 상태와 설명)이 비면 어떤 항목인지 알려 주며 차단한다", () => {
    const a = completeAnswers();
    a.role.responsibility = "";
    a.contribution = [];
    a.result.status = null;
    const checks = run(build(undefined, a));
    const core = checks.find((c) => c.id === "core-pp1")!;
    expect(core.level).toBe("block");
    expect(core.detail).toContain("역할");
    expect(core.detail).toContain("직접 한 일");
    expect(core.detail).toContain("결과 상태");
    expect(missingCoreFields({ title: "x", answers: completeAnswers() })).toEqual([]);
  });

  it("수치가 없어도(결과 상태와 설명만 있어도) 차단하지 않는다", () => {
    const a = completeAnswers();
    a.metrics = [];
    a.result.status = "not_measured";
    expect(ids(run(build(undefined, a)), "block")).not.toContain("core-pp1");
  });

  it("나눌 수 없는 넘침, 이미지 불러오기 실패, 저장 문제는 차단한다", () => {
    const doc = build();
    const pages = paginateAll(logical(doc), (atoms) => atoms.length <= 1 || !atoms.some((a) => a.kind === "bullet")); // 목록 조각은 어디에도 안 들어간다
    const checks = runPreflight({ doc, pages, failedImages: ["img1"], saveBlock: "conflict" });
    const blocks = ids(checks, "block");
    expect(blocks.some((id) => id.startsWith("overflow-"))).toBe(true);
    expect(blocks).toContain("image-failed");
    expect(blocks).toContain("conflict");
    expect(ids(run(doc, { saveBlock: "unsaved" }), "block")).toContain("unsaved");
  });

  it("Summary 없음, 근거 없음, 연락처 포함, 미검증 결과는 주의로 알리고 차단하지 않는다", () => {
    const a = completeAnswers();
    a.evidence = [];
    a.result.status = "not_executed";
    const doc = build(
      (d) => ({ ...d, cover: { ...d.cover, email: "me@example.com", includeContact: true } }),
      a,
    );
    const checks = run(doc);
    expect(ids(checks, "warn")).toEqual(expect.arrayContaining(["no-summary", "evidence-pp1", "contact", "unverified-pp1"]));
    expect(countByLevel(checks).block).toBe(0);
    expect(checks.find((c) => c.id === "unverified-pp1")!.detail).toContain("제안·검증 예정");
  });

  it("이어지는 페이지가 생기면 차단 없이 안내만 한다", () => {
    const doc = build();
    const pages = paginateAll(logical(doc), (atoms) => atoms.length <= 2);
    const checks = runPreflight({ doc, pages, failedImages: [] });
    expect(ids(checks, "info")).toContain("continued");
    expect(countByLevel(checks).block).toBe(0);
  });
});
