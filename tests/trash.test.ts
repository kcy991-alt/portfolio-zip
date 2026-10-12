import { describe, expect, it } from "vitest";
import { daysLeft, TRASH_DAYS, trashCutoff } from "@/lib/trash";

const at = (iso: string) => new Date(iso);

describe("daysLeft", () => {
  it("방금 삭제하면 30일 남는다", () => {
    expect(daysLeft("2026-10-08T00:00:00Z", at("2026-10-08T00:10:00Z"))).toBe(TRASH_DAYS);
  });

  it("하루가 지날 때마다 1씩 줄어든다", () => {
    expect(daysLeft("2026-10-08T00:00:00Z", at("2026-10-09T00:00:00Z"))).toBe(29);
    expect(daysLeft("2026-10-08T00:00:00Z", at("2026-10-28T12:00:00Z"))).toBe(10);
  });

  it("보관 기간이 지나면 0이고 음수가 되지 않는다", () => {
    expect(daysLeft("2026-10-08T00:00:00Z", at("2026-11-07T00:00:00Z"))).toBe(0);
    expect(daysLeft("2026-10-08T00:00:00Z", at("2027-01-01T00:00:00Z"))).toBe(0);
  });
});

describe("trashCutoff", () => {
  it("지금으로부터 30일 전 시각을 돌려준다", () => {
    expect(trashCutoff(at("2026-10-31T00:00:00Z")).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});
