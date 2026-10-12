import { describe, expect, it } from "vitest";
import { addProjectCopy, createLocalPortfolio, type PortfolioDoc } from "@/lib/portfolio/model";
import { buildLogicalPages, paginate, paginateAll, type Atom, type FitFn } from "@/lib/portfolio/output";
import { emptyProjectAnswers, type ProjectAnswers } from "@/lib/validation/project-answers";

function answers(): ProjectAnswers {
  const a = emptyProjectAnswers();
  a.overview.oneLine = "온보딩 과정을 개선한 프로젝트";
  a.overview.context = "신규 사용자의 첫 이용을 돕는 프로젝트입니다.";
  a.overview.purpose = "초기 이탈을 줄이려고 시작했습니다.";
  a.overview.startMonth = "2026-03";
  a.overview.endMonth = "2026-06";
  a.overview.projectType = "work";
  a.overview.teamSize = "기획 2명, 개발자 2명";
  a.role.title = "서비스 기획";
  a.role.responsibility = "인터뷰 설계와 화면 기획을 맡았습니다.";
  a.metrics = [
    { name: "초기 이탈률", purpose: "guardrail", baseline: "31%", target: "28", unit: "% 이하", measurementPlan: "", actualOptional: "" },
    { name: "첫 설정 완료율", purpose: "primary", baseline: "42%", target: "55", unit: "%", measurementPlan: "", actualOptional: "" },
  ];
  return a;
}

function build(mutate?: (doc: PortfolioDoc) => PortfolioDoc, a = answers()) {
  let doc = createLocalPortfolio("지원용");
  doc = addProjectCopy(doc, { id: "p1", title: "온보딩 개선", answers: a }, "pp1").doc;
  return mutate ? mutate(doc) : doc;
}

const intro = (doc: PortfolioDoc) => buildLogicalPages(doc).find((p) => p.type === "project_intro")!;

describe("프로젝트 소개 위쪽(hero)", () => {
  it("제목·한 줄 소개·정보 카드(기간·역할·유형)를 입력한 값으로 만든다", () => {
    const h = intro(build()).hero!;
    expect(h.title).toBe("온보딩 개선");
    expect(h.oneLine).toBe("온보딩 과정을 개선한 프로젝트");
    expect(h.cards.map((c) => [c.kind, c.value])).toEqual([
      ["period", "2026-03 ~ 2026-06"],
      ["role", "서비스 기획"],
      ["type", "실제 업무"],
    ]);
    expect(h.cards[2].sub).toBe("기획 2명, 개발자 2명");
  });

  it("성과 숫자는 성공 지표의 '기준 → 목표'로만 나온다(결과처럼 쓰지 않는다)", () => {
    const h = intro(build()).hero!;
    expect(h.goal).toBe("첫 설정 완료율 · 기준 42% → 목표 55%");
    expect(h.goal).not.toContain("실제");
    expect(h.goal).not.toContain("감소");
  });

  it("확인한 실제 값이 있을 때만 '실제 값'을 덧붙인다", () => {
    const a = answers();
    a.metrics[1].actualOptional = "4주 평균 51%";
    expect(intro(build(undefined, a)).hero!.goal).toContain("실제 4주 평균 51%");
  });

  it("성공 지표가 없거나 목표가 없으면 목표 줄이 없다", () => {
    const none = answers();
    none.metrics = [];
    expect(intro(build(undefined, none)).hero!.goal).toBeNull();
    const noTarget = answers();
    noTarget.metrics = [{ name: "완료율", purpose: "primary", baseline: "", target: "", unit: "", measurementPlan: "", actualOptional: "" }];
    expect(intro(build(undefined, noTarget)).hero!.goal).toBeNull();
  });

  it("실행 페이지에서 지표를 숨겼거나 실행 페이지를 뺐으면 소개에도 목표를 올리지 않는다", () => {
    const hiddenSection = build((d) => ({ ...d, pages: d.pages.map((p) => (p.type === "project_execution" ? { ...p, section_keys: ["solution"] } : p)) }));
    expect(intro(hiddenSection).hero!.goal).toBeNull();
    const hiddenPage = build((d) => ({ ...d, pages: d.pages.map((p) => (p.type === "project_execution" ? { ...p, hidden: true } : p)) }));
    expect(intro(hiddenPage).hero!.goal).toBeNull();
  });

  it("위쪽에 나온 내용은 본문에서 빠져서 같은 말이 두 번 나오지 않는다", () => {
    const page = intro(build());
    const text = JSON.stringify(page.atoms);
    expect(text).not.toContain("온보딩 과정을 개선한 프로젝트"); // 한 줄 소개
    expect(page.atoms.some((a) => a.kind === "title")).toBe(false); // 프로젝트 제목
    expect(text).toContain("신규 사용자의 첫 이용을 돕는 프로젝트입니다."); // 개요 설명은 본문에 남는다
    expect(text).toContain("인터뷰 설계와 화면 기획을 맡았습니다."); // 역할 설명은 본문에 남는다
    expect(text).not.toContain("서비스 기획\"}"); // 역할 이름은 카드에만 나온다
  });

  it("대표 이미지는 위쪽 오른쪽에 나오고 본문 조각으로는 나오지 않는다", () => {
    const withImage = build((d) => ({
      ...d,
      projects: d.projects.map((p) => ({
        ...p,
        images: [{ id: "img1", asset_id: "a1", section_key: "representative", caption: "", alt_text: "대표", decorative: false, sort_order: 0, include_in_output: true, width: 800, height: 600, url: "https://example.test/a.png" }],
      })),
    }));
    const page = intro(withImage);
    expect(page.hero!.image?.imageId).toBe("img1");
    expect(page.atoms.some((a) => a.kind === "image")).toBe(false);
  });

  it("출력에 포함하지 않은 대표 이미지는 나오지 않는다", () => {
    const hidden = build((d) => ({
      ...d,
      projects: d.projects.map((p) => ({
        ...p,
        images: [{ id: "img1", asset_id: "a1", section_key: "representative", caption: "", alt_text: "", decorative: false, sort_order: 0, include_in_output: false, width: 800, height: 600, url: "https://example.test/a.png" }],
      })),
    }));
    expect(intro(hidden).hero!.image).toBeNull();
  });

  it("개요·역할 섹션을 모두 숨기면 위쪽 영역 없이 예전 모양 그대로다", () => {
    const doc = build((d) => ({ ...d, pages: d.pages.map((p) => (p.type === "project_intro" ? { ...p, section_keys: [] } : p)) }));
    expect(buildLogicalPages(doc).find((p) => p.type === "project_intro")).toBeUndefined(); // 보일 내용이 없으면 페이지도 없다
  });

  it("역할만 보이게 두면 역할 카드만 있고 기간·유형·한 줄 소개는 나오지 않는다", () => {
    const doc = build((d) => ({ ...d, pages: d.pages.map((p) => (p.type === "project_intro" ? { ...p, section_keys: ["role"] } : p)) }));
    const h = intro(doc).hero!;
    expect(h.cards.map((c) => c.kind)).toEqual(["role"]);
    expect(h.oneLine).toBeNull();
  });

  it("지표에 이름이 없으면 목표 줄에 쓰지 않는다", () => {
    const a = answers();
    a.metrics = [{ name: "", purpose: "primary", baseline: "", target: "55", unit: "%", measurementPlan: "", actualOptional: "" }];
    expect(intro(build(undefined, a)).hero!.goal).toBeNull();
  });
});

describe("페이지 나누기: 첫 장에 위쪽 영역이 있을 때", () => {
  const text = (n: number): Atom => ({ id: `t${n}`, kind: "text", text: "문단" });
  /** 조각 n개까지 들어가는 칸 */
  const cap = (n: number): FitFn => (atoms) => atoms.length <= n;

  it("위쪽 영역 때문에 첫 장이 작게 들어가도 조각의 순서와 개수는 그대로다", () => {
    const atoms = [1, 2, 3, 4, 5, 6].map(text);
    const pages = paginate(atoms, cap(4), cap(2));
    expect(pages.map((p) => p.atoms.length)).toEqual([2, 4]);
    expect(pages.flatMap((p) => p.atoms.map((a) => a.id))).toEqual(atoms.map((a) => a.id));
  });

  it("첫 장에 한 묶음도 못 놓지만 다음 장에는 들어가면, 첫 장은 위쪽 영역만 두고 넘김으로 표시하지 않는다", () => {
    const atoms = [1, 2].map(text);
    const pages = paginate(atoms, cap(4), cap(0));
    expect(pages).toEqual([
      { atoms: [], overflow: false },
      { atoms, overflow: false },
    ]);
  });

  it("어느 장에도 못 놓는 묶음만 넘침으로 표시한다", () => {
    const pages = paginate([text(1)], cap(0), cap(0));
    expect(pages.some((p) => p.overflow)).toBe(true);
  });

  it("위쪽 영역이 없으면(첫 장 규칙이 같으면) 예전과 똑같이 나눈다", () => {
    const atoms = [1, 2, 3, 4, 5].map(text);
    expect(paginate(atoms, cap(2)).map((p) => p.atoms.length)).toEqual([2, 2, 1]);
  });

  it("논리 페이지 전체: hero는 첫 장에만 붙고, 본문이 없어도 첫 장이 만들어진다", () => {
    const a = answers();
    a.overview.context = "";
    a.overview.purpose = "";
    a.role.responsibility = "";
    const logical = buildLogicalPages(build(undefined, a));
    const introPage = logical.find((p) => p.type === "project_intro")!;
    expect(introPage.atoms).toHaveLength(0);
    const physical = paginateAll([introPage], () => true);
    expect(physical).toHaveLength(1);
    expect(physical[0].hero).toBeDefined();
  });

  it("논리 페이지 전체: 본문이 길어 이어지는 장에는 hero가 붙지 않는다", () => {
    const logical = buildLogicalPages(build());
    const introPage = logical.find((p) => p.type === "project_intro")!;
    // hero가 있는 첫 장은 1조각, 이어지는 장은 3조각이 들어간다
    const fits: FitFn = (atoms, hero) => atoms.length <= (hero ? 1 : 3);
    const physical = paginateAll([introPage], fits);
    expect(physical.length).toBeGreaterThan(1);
    expect(physical[0].hero).toBeDefined();
    expect(physical.slice(1).every((p) => p.hero === undefined)).toBe(true);
    expect(physical.map((p) => p.continuationIndex)).toEqual(physical.map((_, i) => i));
  });
});
