import { describe, expect, it } from "vitest";
import { isFirstLogin } from "@/lib/auth/first-login";

describe("isFirstLogin", () => {
  it("계정 생성과 로그인 시각이 1분 이내면 첫 로그인이다", () => {
    expect(isFirstLogin("2026-10-08T10:00:00Z", "2026-10-08T10:00:03Z")).toBe(true);
  });

  it("며칠 뒤 다시 로그인하면 첫 로그인이 아니다", () => {
    expect(isFirstLogin("2026-10-08T10:00:00Z", "2026-10-10T09:00:00Z")).toBe(false);
  });

  it("시각 정보가 없거나 잘못되면 첫 로그인으로 보지 않는다", () => {
    expect(isFirstLogin(undefined, "2026-10-08T10:00:00Z")).toBe(false);
    expect(isFirstLogin("2026-10-08T10:00:00Z", null)).toBe(false);
    expect(isFirstLogin("nope", "also-nope")).toBe(false);
  });
});
