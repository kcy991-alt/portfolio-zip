import { describe, expect, it } from "vitest";
import { IMAGE_ZONE, OUTPUT_ZONES, PAGE_LAYOUT, REPRESENTATIVE_ZONE } from "@/templates/pm-v1";
import { SECTION_FORMS } from "@/templates/pm-v1/fields";
import { emptyProjectAnswers, SECTION_KEYS } from "@/lib/validation/project-answers";

describe("pm-v1 입력 폼 정의", () => {
  const empty = emptyProjectAnswers();

  it("폼 필드가 스키마의 필드와 정확히 일치한다", () => {
    for (const key of SECTION_KEYS) {
      const def = SECTION_FORMS[key];
      const value = empty[key] as unknown;
      const schemaFields = Array.isArray(value)
        ? // 배열 섹션은 항목 스키마가 필요하므로 폼에서 항목 필드 이름을 따로 확인한다
          null
        : Object.keys(value as object).sort();
      if (schemaFields) {
        expect(def.fields.map((f) => f.name).sort(), `${key} 섹션`).toEqual(schemaFields);
      } else {
        expect(def.repeat, `${key} 섹션은 반복 항목이어야 한다`).toBeDefined();
      }
    }
  });

  it("이미지가 보이는 구역은 모든 섹션에 있고, 페이지 레이아웃과 그 섹션의 출력 구역에 존재한다", () => {
    const allZones = new Set(Object.values(PAGE_LAYOUT).flatMap((p) => p.zones));
    expect(allZones.has(REPRESENTATIVE_ZONE)).toBe(true);
    for (const [section, zone] of Object.entries(IMAGE_ZONE)) {
      expect(allZones.has(zone), `${section} → ${zone}`).toBe(true);
      expect(OUTPUT_ZONES[section as keyof typeof OUTPUT_ZONES].map((z) => z.zone), section).toContain(zone);
    }
  });

  it("출력 구역 이름은 모두 페이지 레이아웃에 존재한다", () => {
    const allZones = new Set(Object.values(PAGE_LAYOUT).flatMap((p) => p.zones));
    for (const zones of Object.values(OUTPUT_ZONES)) {
      for (const z of zones) {
        expect(allZones.has(z.zone), z.zone).toBe(true);
        expect(PAGE_LAYOUT[z.page].zones).toContain(z.zone);
      }
    }
  });
});
