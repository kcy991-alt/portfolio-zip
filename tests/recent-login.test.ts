import { describe, expect, it } from "vitest";
import { isRecentLogin, lastLoginAt } from "@/lib/account/recent-login";

describe("최근 로그인 확인", () => {
  const now = 1_800_000_000;
  it("10분 안의 로그인은 통과", () => {
    expect(isRecentLogin([{ method: "oauth", timestamp: now - 300 }], now)).toBe(true);
  });
  it("오래된 로그인은 거절", () => {
    expect(isRecentLogin([{ method: "oauth", timestamp: now - 3600 }], now)).toBe(false);
  });
  it("여러 기록 중 가장 최근 것을 본다", () => {
    expect(lastLoginAt([{ timestamp: now - 9000 }, { timestamp: now - 100 }])).toBe(now - 100);
  });
  it("기록이 없거나 형식이 다르면 거절", () => {
    expect(isRecentLogin(undefined, now)).toBe(false);
    expect(isRecentLogin([], now)).toBe(false);
    expect(isRecentLogin(["oauth"], now)).toBe(false);
  });
  it("미래 시각은 거절(시계 오차 1분까지만 허용)", () => {
    expect(isRecentLogin([{ timestamp: now + 3600 }], now)).toBe(false);
  });
});
