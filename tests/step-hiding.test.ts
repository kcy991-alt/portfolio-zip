import { describe, expect, it } from "vitest";
import { addProjectCopy, createLocalPortfolio, type PortfolioDoc } from "@/lib/portfolio/model";
import { buildLogicalPages, buildOutputPages, mergeProjectPages, missingCoreFields, paginateAll, runPreflight, type Atom } from "@/lib/portfolio/output";
import { emptyProjectAnswers, projectAnswersSchema, OPTIONAL_STEP_KEYS, type ProjectAnswers } from "@/lib/validation/project-answers";
import { hiddenSections, isRemovableStep, STEPS, visibleStepIndexes } from "@/templates/pm-v1";
import { toggleStepHidden } from "@/components/step-manager";

function answers(): ProjectAnswers {
  const a = emptyProjectAnswers();
  a.overview.oneLine = "가입 흐름을 개선한 프로젝트";
  a.role.responsibility = "인터뷰 설계와 화면 기획";
  a.problem.phenomenon = "문제 현상";
  a.evidence = [{ kind: "인터뷰", description: "근거 설명", sourceUrl: "", observedAt: "", limitation: "" }];
  a.insight.pattern = "인사이트 내용";
  a.result.status = "observed";
  a.result.summary = "결과 설명";
  a.reflection.learning = "회고 내용";
  return a;
}

function build(a: ProjectAnswers): PortfolioDoc {
  let doc = createLocalPortfolio("지원용");
  doc = { ...doc, cover: { ...doc.cover, name: "홍길동" } };
  return addProjectCopy(doc, { id: "p1", title: "온보딩 개선", answers: a }, "pp1").doc;
}

const zonesOf = (atoms: Atom[]) => atoms.filter((a) => a.kind === "zoneTitle").map((a) => (a as { text: string }).text);

describe("단계 숨기기", () => {
  it("기본은 아무것도 숨기지 않고, 개요·역할·문제 정의는 뺄 수 없다", () => {
    expect(emptyProjectAnswers().hiddenSteps).toEqual([]);
    expect(STEPS.filter((s) => !isRemovableStep(s.key)).map((s) => s.key)).toEqual(["overview", "role", "problem"]);
    expect(projectAnswersSchema.safeParse({ hiddenSteps: ["problem"] }).success).toBe(false);
    expect(projectAnswersSchema.safeParse({ hiddenSteps: ["evidence", "reflection", "metrics"] }).success).toBe(true);
    expect(OPTIONAL_STEP_KEYS).toHaveLength(7);
  });

  it("숨긴 단계는 이동 목록과 출력 섹션에서 빠진다", () => {
    const a = { ...emptyProjectAnswers(), hiddenSteps: ["evidence" as const, "insight" as const] };
    expect(visibleStepIndexes(a).map((i) => STEPS[i].key)).toEqual(["overview", "role", "problem", "hypothesis", "solution", "metrics", "execution", "reflection"]);
    expect([...hiddenSections(a)].sort()).toEqual(["evidence", "insight"]);
  });

  it("toggleStepHidden: 넣고 빼기가 되고, 뺄 수 없는 단계는 그대로다", () => {
    const a = emptyProjectAnswers();
    const hidden = toggleStepHidden(a, "evidence");
    expect(hidden.hiddenSteps).toEqual(["evidence"]);
    expect(toggleStepHidden(hidden, "evidence").hiddenSteps).toEqual([]);
    expect(toggleStepHidden(a, "problem")).toBe(a);
  });

  it("숨긴 단계에 쓴 내용은 남아 있지만 출력에는 나오지 않는다", () => {
    const a = { ...answers(), hiddenSteps: ["evidence" as const] };
    expect(a.evidence[0].description).toBe("근거 설명"); // 지우지 않는다
    const analysis = buildLogicalPages(build(a)).find((p) => p.type === "project_analysis")!;
    expect(zonesOf(analysis.atoms)).toEqual(["문제 정의", "핵심 인사이트"]);
    expect(JSON.stringify(analysis.atoms)).not.toContain("근거 설명");
  });

  it("다시 넣으면 그대로 돌아온다", () => {
    const hidden = { ...answers(), hiddenSteps: ["evidence" as const] };
    const back = toggleStepHidden(hidden, "evidence");
    const analysis = buildLogicalPages(build(back)).find((p) => p.type === "project_analysis")!;
    expect(zonesOf(analysis.atoms)).toContain("데이터 및 근거");
  });

  it("근거 단계를 뺀 프로젝트에는 '근거 없음' 주의를 띄우지 않는다", () => {
    const check = (a: ProjectAnswers) => {
      const doc = build({ ...a, evidence: [] });
      return runPreflight({ doc, pages: paginateAll(buildOutputPages(doc), () => true), failedImages: [] }).map((c) => c.id);
    };
    expect(check(answers()).some((id) => id.startsWith("evidence-"))).toBe(true);
    expect(check({ ...answers(), hiddenSteps: ["evidence"] }).some((id) => id.startsWith("evidence-"))).toBe(false);
  });
});

describe("성공 지표 단계 빼기", () => {
  it("성공 지표 단계를 빼면 결과 상태·설명을 필수 확인하지 않고, 지표·결과는 출력되지 않는다", () => {
    const a = { ...emptyProjectAnswers(), hiddenSteps: ["metrics" as const] };
    a.role.responsibility = "역할";
    a.problem.phenomenon = "문제";
    a.contribution = [{ task: "직접 한 일", ownership: "lead", detail: "", percentOptional: null }];
    a.result.status = "observed";
    a.result.summary = "숨겨질 결과";
    const doc = build(a);
    expect(missingCoreFields({ title: "온보딩 개선", answers: a })).toEqual([]);
    expect(missingCoreFields({ title: "온보딩 개선", answers: { ...a, hiddenSteps: [] } })).toEqual([]);
    expect(missingCoreFields({ title: "x", answers: { ...emptyProjectAnswers(), hiddenSteps: [] } })).toContain("결과 상태");
    expect(JSON.stringify(buildLogicalPages(doc).map((p) => p.atoms))).not.toContain("숨겨질 결과");
    const checks = runPreflight({ doc, pages: paginateAll(buildOutputPages(doc), () => true), failedImages: [] });
    expect(checks.some((c) => c.id.startsWith("core-"))).toBe(false);
  });

  it("성공 지표 단계를 빼면 소개 첫 장의 목표 줄도 나오지 않는다", () => {
    const a = emptyProjectAnswers();
    a.metrics = [{ name: "첫 설정 완료율", purpose: "primary", baseline: "40%", target: "60", unit: "%", measurementPlan: "", actualOptional: "" }];
    expect(buildLogicalPages(build(a)).find((p) => p.type === "project_intro")?.hero?.goal).toContain("첫 설정 완료율");
    expect(buildLogicalPages(build({ ...a, hiddenSteps: ["metrics"] })).find((p) => p.type === "project_intro")?.hero?.goal).toBeNull();
  });
});

describe("프로젝트 안에서 이어 붙이기", () => {
  it("프로젝트의 소개·분석·실행·결과가 한 흐름으로 합쳐지고, 앞 페이지의 빈 자리를 뒤 내용이 채운다", () => {
    const a = emptyProjectAnswers();
    a.problem.phenomenon = "문제만 적었어요";
    a.result.status = "observed";
    a.result.summary = "결과 설명";
    const doc = build(a);

    const separate = buildLogicalPages(doc).filter((p) => p.type.startsWith("project_"));
    expect(separate.map((p) => p.type)).toEqual(["project_intro", "project_analysis", "project_result"]); // 따로면 세 장(소개는 프로젝트 이름만으로도 한 장이 생긴다)
    expect(paginateAll(separate, () => true)).toHaveLength(3);

    const merged = buildOutputPages(doc).filter((p) => p.type.startsWith("project_"));
    expect(merged).toHaveLength(1); // 이어 붙이면 한 장
    expect(zonesOf(merged[0].atoms)).toEqual(["문제 정의", "결과"]);
    expect(paginateAll(merged, () => true)).toHaveLength(1);
  });

  it("합쳐도 넘치면 기존처럼 이어짐 페이지로 나뉘고, 구역 순서는 유지된다", () => {
    const doc = build(answers());
    const pages = paginateAll(buildOutputPages(doc), (atoms) => atoms.length <= 4).filter((p) => p.type.startsWith("project_"));
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.map((p) => p.continuationIndex)).toEqual(pages.map((_, i) => i));
    const order = pages.flatMap((p) => zonesOf(p.atoms));
    expect(order).toEqual(["역할", "문제 정의", "데이터 및 근거", "핵심 인사이트", "결과", "회고"]);
  });

  it("합쳐진 장은 원래 페이지 id를 모두 알고 있어서, 어느 페이지를 골라도 그 장이 보인다", () => {
    const doc = build(answers());
    const ids = doc.pages.filter((p) => p.type.startsWith("project_")).map((p) => p.id);
    const pages = paginateAll(buildOutputPages(doc), () => true).filter((p) => p.type.startsWith("project_"));
    for (const id of ids) expect(pages.some((p) => (p.pageIds ?? []).includes(id))).toBe(true);
  });

  it("프로젝트 사이는 합치지 않는다", () => {
    let doc = build(answers());
    doc = addProjectCopy(doc, { id: "p2", title: "두 번째", answers: answers() }, "pp2").doc;
    const merged = mergeProjectPages(buildLogicalPages(doc), doc).filter((p) => p.type.startsWith("project_"));
    expect(merged).toHaveLength(2);
    expect(merged.map((p) => p.headerTitle)).toEqual(["온보딩 개선", "두 번째"]);
  });

  it("표지는 맨 앞에 그대로 있다", () => {
    const doc = build(answers());
    expect(buildOutputPages(doc)[0].type).toBe("cover");
  });

  it("소개 첫 장의 위쪽 영역(hero)은 이어 붙인 첫 장에 그대로 있다", () => {
    const doc = build(answers());
    const merged = buildOutputPages(doc).find((p) => p.type === "project_intro")!;
    expect(merged.hero?.title).toBe("온보딩 개선");
    expect(paginateAll([merged], () => true)[0].hero?.title).toBe("온보딩 개선");
  });

  it("숨긴 페이지의 내용은 이어 붙이지 않는다", () => {
    const base = build(answers());
    const doc = { ...base, pages: base.pages.map((p) => (p.type === "project_analysis" ? { ...p, hidden: true } : p)) };
    const merged = buildOutputPages(doc).find((p) => p.type.startsWith("project_"))!;
    expect(zonesOf(merged.atoms)).not.toContain("문제 정의");
  });
});
