import { describe, expect, it } from "vitest";
import {
  checkSource,
  fitWithin,
  MAX_DIMENSION,
  nextScale,
  PrepareImageError,
  SOURCE_MAX_BYTES,
  UPLOAD_TARGET_BYTES,
} from "@/lib/storage/client-compress";

describe("nextScale", () => {
  it("용량이 목표의 4배면 변을 약 절반으로(0.9배 여유 포함) 줄인다", () => {
    const s = nextScale(1, UPLOAD_TARGET_BYTES * 4);
    expect(s).toBeGreaterThan(0.4);
    expect(s).toBeLessThan(0.5);
  });

  it("목표에 거의 가까우면 최소한 5%는 줄여서 같은 크기를 되풀이하지 않는다", () => {
    expect(nextScale(1, UPLOAD_TARGET_BYTES * 1.001)).toBeLessThanOrEqual(0.95);
  });

  it("너무 작게 줄이지 않는다", () => {
    expect(nextScale(1, UPLOAD_TARGET_BYTES * 1000)).toBe(0.25);
  });
});

describe("fitWithin", () => {
  it("긴 변이 4,096px을 넘으면 비율을 지키며 줄인다", () => {
    expect(fitWithin(8192, 4096)).toEqual({ width: MAX_DIMENSION, height: 2048 });
    expect(fitWithin(3000, 6000)).toEqual({ width: 2048, height: MAX_DIMENSION });
  });

  it("작은 이미지는 키우지 않는다", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("아주 가는 이미지도 한 변이 0이 되지 않는다", () => {
    const out = fitWithin(100000, 1);
    expect(out.width).toBe(MAX_DIMENSION);
    expect(out.height).toBeGreaterThanOrEqual(1);
  });
});

describe("checkSource", () => {
  it("JPEG/PNG/WebP 10MB 이하는 통과한다", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(() => checkSource({ type, size: SOURCE_MAX_BYTES })).not.toThrow();
    }
  });

  it("다른 형식, 10MB 초과, 빈 파일은 사용자에게 보여 줄 문구와 함께 거절한다", () => {
    expect(() => checkSource({ type: "image/svg+xml", size: 10 })).toThrow(PrepareImageError);
    expect(() => checkSource({ type: "image/gif", size: 10 })).toThrow(PrepareImageError);
    expect(() => checkSource({ type: "image/png", size: SOURCE_MAX_BYTES + 1 })).toThrow("10MB");
    expect(() => checkSource({ type: "image/png", size: 0 })).toThrow(PrepareImageError);
  });

  it("서버로 보내는 목표 크기는 Vercel 요청 제한(4.5MB)보다 작다", () => {
    expect(UPLOAD_TARGET_BYTES).toBeLessThan(4.5 * 1024 * 1024);
  });
});
