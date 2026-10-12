import { describe, expect, it } from "vitest";
import {
  checkProjectLimits,
  MAX_BODY_IMAGES,
  MAX_PROJECT_BYTES,
  needsAltText,
  REPRESENTATIVE,
  type ExistingLink,
} from "@/lib/storage/asset-limits";

const MB = 1024 * 1024;
const body = (n: number, bytes = MB): ExistingLink[] => Array.from({ length: n }, () => ({ section_key: "problem", bytes }));

describe("checkProjectLimits", () => {
  it("비어 있으면 통과한다", () => {
    expect(checkProjectLimits([], "problem", MB)).toBeNull();
    expect(checkProjectLimits([], REPRESENTATIVE, MB)).toBeNull();
  });

  it("대표 이미지는 1개만 허용한다", () => {
    const existing: ExistingLink[] = [{ section_key: REPRESENTATIVE, bytes: MB }];
    expect(checkProjectLimits(existing, REPRESENTATIVE, MB)?.code).toBe("too_many_representative");
    expect(checkProjectLimits(existing, "problem", MB)).toBeNull(); // 본문 이미지는 대표 이미지와 따로 센다
  });

  it("본문 이미지는 12개까지 허용하고 대표 이미지는 12개에 포함하지 않는다", () => {
    expect(checkProjectLimits(body(MAX_BODY_IMAGES - 1), "insight", MB)).toBeNull();
    expect(checkProjectLimits(body(MAX_BODY_IMAGES), "insight", MB)?.code).toBe("too_many_images");
    const withRep = [...body(MAX_BODY_IMAGES - 1), { section_key: REPRESENTATIVE, bytes: MB }];
    expect(checkProjectLimits(withRep, "insight", MB)).toBeNull();
  });

  it("프로젝트 용량 80MB를 넘으면 거절한다", () => {
    const nearFull = [{ section_key: "problem", bytes: MAX_PROJECT_BYTES - MB }];
    expect(checkProjectLimits(nearFull, "problem", MB)).toBeNull();
    expect(checkProjectLimits(nearFull, "problem", MB + 1)?.code).toBe("project_quota_exceeded");
  });
});

describe("needsAltText", () => {
  it("정보성 이미지는 대체텍스트가 비어 있으면 필요하다", () => {
    expect(needsAltText({ decorative: false, alt_text: "" })).toBe(true);
    expect(needsAltText({ decorative: false, alt_text: "   " })).toBe(true);
    expect(needsAltText({ decorative: false, alt_text: "퍼널 이탈률 그래프" })).toBe(false);
  });

  it("장식용으로 표시하면 필요 없다", () => {
    expect(needsAltText({ decorative: true, alt_text: "" })).toBe(false);
  });
});
