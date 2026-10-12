import { describe, expect, it } from "vitest";
import { buildLogicalPages } from "@/lib/portfolio/output";
import { createSamplePortfolio } from "@/lib/portfolio/sample";

describe("완성 예시 포트폴리오", () => {
  const logical = buildLogicalPages(createSamplePortfolio());

  it("표지부터 프로젝트 결과까지 모든 종류의 페이지가 나온다", () => {
    expect(logical.map((p) => p.type)).toEqual(["cover", "summary", "profile", "project_intro", "project_analysis", "project_execution", "project_result"]);
  });

  it("성과 숫자는 목표로만 쓰고, 결과에는 '제안·검증 예정'이 붙는다", () => {
    const text = JSON.stringify(logical);
    expect(logical.find((p) => p.type === "project_intro")?.hero?.goal).toBe("첫 설정 완료율 · 기준 42% → 목표 55%");
    expect(text).toContain("제안·검증 예정");
  });
});
