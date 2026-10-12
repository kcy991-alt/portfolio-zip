import { describe, expect, it } from "vitest";
import { OUTPUT_ZONES, STEPS } from "@/templates/pm-v1";
import { emptyProjectAnswers, projectAnswersSchema } from "@/lib/validation/project-answers";

describe("pm-v1 template", () => {
  it("단계는 10개이고 순서가 1~10이다", () => {
    expect(STEPS.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("스키마의 모든 섹션이 정확히 한 번 단계에 배치되고 출력 구역을 가진다", () => {
    const schemaKeys = Object.keys(emptyProjectAnswers()).sort();
    const stepKeys = STEPS.flatMap((s) => s.sections).sort();
    expect(stepKeys).toEqual(schemaKeys);
    expect(Object.keys(OUTPUT_ZONES).sort()).toEqual(schemaKeys);
  });

  it("빈 초안은 저장 가능하고 예시 텍스트가 없다", () => {
    const a = emptyProjectAnswers();
    expect(a.problem.phenomenon).toBe("");
    expect(a.result.status).toBeNull();
    expect(a.contribution).toEqual([]);
  });

  it("진행 중이면 종료 월을 받지 않고, 종료 월은 시작 월 이상이어야 한다", () => {
    const reversed = { overview: { startMonth: "2026-03", endMonth: "2026-01" } };
    expect(projectAnswersSchema.safeParse(reversed).success).toBe(false);
    const ongoingWithEnd = { overview: { startMonth: "2026-03", endMonth: "2026-05", ongoing: true } };
    expect(projectAnswersSchema.safeParse(ongoingWithEnd).success).toBe(false);
    const ongoing = { overview: { startMonth: "2026-03", ongoing: true } };
    expect(projectAnswersSchema.safeParse(ongoing).success).toBe(true);
  });

  it("근거 URL은 http/https만 허용한다", () => {
    const bad = { evidence: [{ sourceUrl: "javascript:alert(1)" }] };
    const ok = { evidence: [{ sourceUrl: "https://example.com" }, { sourceUrl: "" }] };
    expect(projectAnswersSchema.safeParse(bad).success).toBe(false);
    expect(projectAnswersSchema.safeParse(ok).success).toBe(true);
  });

  it("기여율은 0~100이고 합계를 요구하지 않는다", () => {
    const ok = { contribution: [{ percentOptional: 100 }, { percentOptional: 25 }] };
    const bad = { contribution: [{ percentOptional: 120 }] };
    expect(projectAnswersSchema.safeParse(ok).success).toBe(true);
    expect(projectAnswersSchema.safeParse(bad).success).toBe(false);
  });
});
