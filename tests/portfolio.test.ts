import { describe, expect, it } from "vitest";
import {
  addProjectCopy,
  createLocalPortfolio,
  DEFAULT_PAGE_SECTIONS,
  isValidOrder,
  moveProjectCopy,
  orderedPages,
  PROJECT_PAGE_TYPES,
  refreshProjectCopy,
  removeProjectCopy,
  type PortfolioDoc,
} from "@/lib/portfolio/model";
import {
  coverSchema,
  patchPortfolioBodySchema,
  portfolioTitleSchema,
  profileSchema,
  summarySchema,
} from "@/lib/validation/portfolio";
import { emptyProjectAnswers } from "@/lib/validation/project-answers";
import { OUTPUT_ZONES } from "@/templates/pm-v1";

const source = (id: string, title: string) => {
  const answers = emptyProjectAnswers();
  answers.problem.phenomenon = `${title}의 문제`;
  return { id, title, answers };
};

describe("기본 페이지 섹션", () => {
  it("질문 구조(OUTPUT_ZONES)의 페이지 구성과 같다", () => {
    for (const type of PROJECT_PAGE_TYPES) {
      const fromTemplate = Object.entries(OUTPUT_ZONES)
        .filter(([, zones]) => zones.some((z) => z.page === type))
        .map(([section]) => section)
        .sort();
      expect([...DEFAULT_PAGE_SECTIONS[type]].sort(), type).toEqual(fromTemplate);
    }
  });
});

describe("제작본 만들기와 프로젝트 사본", () => {
  it("새 제작본은 표지·Summary·프로필 페이지로 시작한다", () => {
    const doc = createLocalPortfolio("지원용");
    expect(orderedPages(doc).map((p) => p.type)).toEqual(["cover", "summary", "profile"]);
    expect(doc.cover.includeContact).toBe(false); // 연락처는 기본으로 출력에 넣지 않는다
  });

  it("프로젝트를 추가하면 소개·분석·실행·결과 4장이 뒤에 붙는다", () => {
    const { doc } = addProjectCopy(createLocalPortfolio("지원용"), source("p1", "온보딩"));
    expect(orderedPages(doc).map((p) => p.type)).toEqual([
      "cover", "summary", "profile", "project_intro", "project_analysis", "project_execution", "project_result",
    ]);
  });

  it("사본 id를 미리 정해 줄 수 있고, 그 id로 사본과 페이지가 만들어진다", () => {
    const { doc, copyId } = addProjectCopy(createLocalPortfolio("지원용"), source("p1", "온보딩"), "local-pp-fixed");
    expect(copyId).toBe("local-pp-fixed");
    expect(doc.projects[0].id).toBe("local-pp-fixed");
    expect(doc.pages.filter((p) => p.portfolio_project_id === "local-pp-fixed")).toHaveLength(4);
  });

  it("사본은 원본과 독립이다: 사본을 고쳐도 원본이 바뀌지 않고, 원본이 바뀌어도 사본은 그대로다", () => {
    const original = source("p1", "온보딩");
    const { doc } = addProjectCopy(createLocalPortfolio("지원용"), original);
    doc.projects[0].answers.problem.phenomenon = "제작본에서 고친 문장";
    expect(original.answers.problem.phenomenon).toBe("온보딩의 문제");

    original.answers.problem.phenomenon = "원본을 나중에 고침";
    expect(doc.projects[0].answers.problem.phenomenon).toBe("제작본에서 고친 문장");
  });

  it("다시 가져오기는 해당 사본만 원본으로 교체하고 페이지 설정은 유지한다", () => {
    const original = source("p1", "온보딩");
    const added = addProjectCopy(createLocalPortfolio("지원용"), original);
    const edited: PortfolioDoc = {
      ...added.doc,
      pages: added.doc.pages.map((p) => (p.type === "project_analysis" ? { ...p, hidden: true } : p)),
    };
    original.title = "온보딩 개선";
    const refreshed = refreshProjectCopy(edited, added.copyId, original);
    expect(refreshed.projects[0].title).toBe("온보딩 개선");
    expect(refreshed.projects[0].revision).toBe(2);
    expect(refreshed.pages.find((p) => p.type === "project_analysis")?.hidden).toBe(true);
  });
});

describe("순서", () => {
  const three = () => {
    let doc = createLocalPortfolio("지원용");
    const ids: string[] = [];
    for (const n of ["A", "B", "C"]) {
      const r = addProjectCopy(doc, source(n, n));
      doc = r.doc;
      ids.push(r.copyId);
    }
    return { doc, ids };
  };
  const titles = (doc: PortfolioDoc) => [...doc.projects].sort((a, b) => a.sort_order - b.sort_order).map((p) => p.title);

  it("위/아래로 한 칸씩 옮기고, 끝에서는 그대로 둔다", () => {
    const { doc, ids } = three();
    expect(titles(moveProjectCopy(doc, ids[1], -1))).toEqual(["B", "A", "C"]);
    expect(titles(moveProjectCopy(doc, ids[1], 1))).toEqual(["A", "C", "B"]);
    expect(titles(moveProjectCopy(doc, ids[0], -1))).toEqual(["A", "B", "C"]);
    expect(titles(moveProjectCopy(doc, ids[2], 1))).toEqual(["A", "B", "C"]);
  });

  it("옮기면 그 사본의 페이지도 함께 움직인다", () => {
    const { doc, ids } = three();
    const moved = moveProjectCopy(doc, ids[2], -1);
    const order = orderedPages(moved)
      .filter((p) => p.type === "project_intro")
      .map((p) => moved.projects.find((pr) => pr.id === p.portfolio_project_id)?.title);
    expect(order).toEqual(["A", "C", "B"]);
  });

  it("순서 목록에 누락이나 중복이 있으면 거절한다", () => {
    expect(isValidOrder(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
    expect(isValidOrder(["a", "b", "c"], ["a", "b"])).toBe(false);
    expect(isValidOrder(["a", "b", "c"], ["a", "a", "b"])).toBe(false);
    expect(isValidOrder(["a", "b"], ["a", "x"])).toBe(false);
  });
});

describe("프로젝트 사본 빼기", () => {
  it("사본과 그 페이지가 사라지고, Summary 연결은 풀리지만 문장은 남는다", () => {
    const first = addProjectCopy(createLocalPortfolio("지원용"), source("p1", "온보딩"));
    const second = addProjectCopy(first.doc, source("p2", "결제"));
    const withSummary: PortfolioDoc = {
      ...second.doc,
      summary: {
        items: [
          { id: "s1", title: "문제 해결", description: "데이터로 문제를 정의했어요", projectIds: [first.copyId, second.copyId] },
          { id: "s2", title: "협업", description: "", projectIds: [second.copyId] },
        ],
      },
    };
    const { doc, unlinkedSummaryItems } = removeProjectCopy(withSummary, first.copyId);
    expect(unlinkedSummaryItems).toBe(1);
    expect(doc.projects.map((p) => p.title)).toEqual(["결제"]);
    expect(doc.pages.some((p) => p.portfolio_project_id === first.copyId)).toBe(false);
    expect(doc.summary.items[0].description).toBe("데이터로 문제를 정의했어요"); // 문장은 유지
    expect(doc.summary.items[0].projectIds).toEqual([second.copyId]); // 연결만 해제
    expect(doc.revision).toBe(withSummary.revision + 1);
  });
});

describe("표지·Summary·프로필 입력 규칙", () => {
  it("빈 값으로 시작해도 저장할 수 있고 연락처 포함은 기본으로 꺼져 있다", () => {
    expect(coverSchema.parse({}).includeContact).toBe(false);
    expect(summarySchema.parse({}).items).toEqual([]);
    expect(profileSchema.parse({}).education).toEqual([]);
  });

  it("링크는 http/https만, 이메일은 형식을 확인한다", () => {
    expect(coverSchema.safeParse({ link: "javascript:alert(1)" }).success).toBe(false);
    expect(coverSchema.safeParse({ link: "https://example.com/me" }).success).toBe(true);
    expect(coverSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(coverSchema.safeParse({ email: "me@example.com" }).success).toBe(true);
  });

  it("Summary는 최대 5개, 교육·경력은 10개, 도구는 20개까지다", () => {
    const item = (i: number) => ({ id: `s${i}`, title: "t", description: "d", projectIds: [] });
    expect(summarySchema.safeParse({ items: Array.from({ length: 5 }, (_, i) => item(i)) }).success).toBe(true);
    expect(summarySchema.safeParse({ items: Array.from({ length: 6 }, (_, i) => item(i)) }).success).toBe(false);
    const edu = (i: number) => ({ id: `e${i}`, org: "", course: "", period: "", description: "" });
    expect(profileSchema.safeParse({ education: Array.from({ length: 11 }, (_, i) => edu(i)) }).success).toBe(false);
    const tool = (i: number) => ({ id: `t${i}`, name: "", description: "" });
    expect(profileSchema.safeParse({ tools: Array.from({ length: 21 }, (_, i) => tool(i)) }).success).toBe(false);
  });

  it("프로필 소개는 600자, Summary 제목은 100자, 설명은 300자까지다", () => {
    expect(profileSchema.safeParse({ intro: "가".repeat(600) }).success).toBe(true);
    expect(profileSchema.safeParse({ intro: "가".repeat(601) }).success).toBe(false);
    const make = (title: number, description: number) => ({ items: [{ id: "s", title: "가".repeat(title), description: "가".repeat(description), projectIds: [] }] });
    expect(summarySchema.safeParse(make(100, 300)).success).toBe(true);
    expect(summarySchema.safeParse(make(101, 0)).success).toBe(false);
    expect(summarySchema.safeParse(make(0, 301)).success).toBe(false);
  });

  it("제목은 1~80자이고, 저장 요청은 바꿀 내용이 있어야 한다", () => {
    expect(portfolioTitleSchema.safeParse("   ").success).toBe(false);
    expect(portfolioTitleSchema.safeParse("가".repeat(81)).success).toBe(false);
    expect(patchPortfolioBodySchema.safeParse({ expected_revision: 1 }).success).toBe(false);
    expect(patchPortfolioBodySchema.safeParse({ expected_revision: 1, title: "새 제목" }).success).toBe(true);
  });
});
