import { describe, expect, it } from "vitest";
import { isFilled, STEP_MAIN_FIELDS, stepStatus } from "@/lib/step-status";
import { emptyProjectAnswers } from "@/lib/validation/project-answers";
import { OUTPUT_ZONES, pageOfZone, PAGE_LAYOUT, STEPS, zoneOfField } from "@/templates/pm-v1";
import { SECTION_FORMS } from "@/templates/pm-v1/fields";

describe("단계별 작성 상태", () => {
  it("아무것도 안 썼으면 작성 전", () => {
    const a = emptyProjectAnswers();
    for (const s of STEPS) expect(stepStatus(s.key, a)).toBe("empty");
  });

  it("일부만 쓰면 작성 중, 주요 항목을 모두 쓰면 작성 완료", () => {
    const a = emptyProjectAnswers();
    a.overview.oneLine = "온보딩 개선";
    expect(stepStatus("overview", a)).toBe("partial");
    a.overview.context = "무엇을 했는지";
    a.overview.purpose = "왜 시작했는지";
    expect(stepStatus("overview", a)).toBe("done");
  });

  it("공백만 있는 글, 꺼진 체크, 선택 안 함은 쓴 것으로 보지 않는다", () => {
    expect(isFilled("   ")).toBe(false);
    expect(isFilled(false)).toBe(false);
    expect(isFilled(null)).toBe(false);
    expect(isFilled([])).toBe(false);
    expect(isFilled([{ a: "" }])).toBe(false);
    expect(isFilled("글")).toBe(true);
    expect(isFilled(0)).toBe(true);
    expect(isFilled(true)).toBe(true);
  });

  it("반복 항목은 하나라도 채워지면 인정한다", () => {
    const a = emptyProjectAnswers();
    a.evidence = [{ kind: "", description: "", sourceUrl: "", observedAt: "", limitation: "" }];
    expect(stepStatus("evidence", a)).toBe("empty");
    a.evidence = [{ kind: "인터뷰", description: "", sourceUrl: "", observedAt: "", limitation: "" }];
    expect(stepStatus("evidence", a)).toBe("partial");
    a.evidence = [{ kind: "", description: "반복된 어려움", sourceUrl: "", observedAt: "", limitation: "" }];
    expect(stepStatus("evidence", a)).toBe("done");
  });

  it("모든 단계에 주요 항목이 정의되어 있고 실제 항목을 가리킨다", () => {
    for (const s of STEPS) {
      const main = STEP_MAIN_FIELDS[s.key];
      expect(main?.length, s.key).toBeGreaterThan(0);
      for (const path of main) {
        const [section, field] = path.split(path.includes("[].") ? "[]." : ".");
        const def = SECTION_FORMS[section as keyof typeof SECTION_FORMS];
        expect(def, path).toBeTruthy();
        expect(def.fields.some((f) => f.name === field), path).toBe(true);
      }
    }
  });
});

describe("입력 항목이 들어가는 구역", () => {
  it("모든 입력 항목이 실제 존재하는 구역과 페이지에 연결된다", () => {
    for (const [section, def] of Object.entries(SECTION_FORMS)) {
      for (const f of def.fields) {
        const zone = zoneOfField(section as keyof typeof SECTION_FORMS, f.name);
        const page = pageOfZone(zone);
        expect(PAGE_LAYOUT[page].zones, `${section}.${f.name}`).toContain(zone);
      }
    }
  });

  it("한 섹션이 여러 구역에 걸칠 때 항목별로 다른 구역을 가리킨다", () => {
    expect(zoneOfField("overview", "startMonth")).toBe("프로젝트 정보");
    expect(zoneOfField("overview", "context")).toBe("개요·선정 이유");
    expect(zoneOfField("solution", "selected")).toBe("Solution");
    expect(zoneOfField("solution", "reason")).toBe("대안과 선택 이유");
    expect(zoneOfField("problem", "phenomenon")).toBe("Problem");
  });

  it("목록에 없는 항목은 섹션의 첫 구역으로 간다", () => {
    for (const section of Object.keys(OUTPUT_ZONES) as (keyof typeof OUTPUT_ZONES)[]) {
      expect(zoneOfField(section, "")).toBe(OUTPUT_ZONES[section][0].zone);
    }
  });
});
