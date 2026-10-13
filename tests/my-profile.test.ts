import { describe, expect, it } from "vitest";
import { emptyMyProfile, emptyProfile, myProfileSchema, profileSchema } from "@/lib/validation/portfolio";

describe("마이페이지 저장 내용(프로필 + 이름·이메일·링크)", () => {
  it("빈 값은 모든 항목이 비어 있다", () => {
    expect(emptyMyProfile()).toEqual({ ...emptyProfile(), name: "", email: "", link: "" });
  });

  it("이름·이메일·링크가 없던 예전 저장값도 그대로 읽는다(DB 변경 없이 항목만 늘렸다)", () => {
    const old = { intro: "소개", education: [], careers: [], certificates: [], tools: [] };
    const parsed = myProfileSchema.parse(old);
    expect(parsed).toMatchObject({ intro: "소개", name: "", email: "", link: "" });
  });

  it("이름·이메일·링크 규칙: 이름 60자, 이메일 형식, 링크는 http/https만", () => {
    expect(myProfileSchema.safeParse({ name: "가".repeat(61) }).success).toBe(false);
    expect(myProfileSchema.safeParse({ email: "이메일아님" }).success).toBe(false);
    expect(myProfileSchema.safeParse({ link: "javascript:alert(1)" }).success).toBe(false);
    expect(myProfileSchema.safeParse({ name: "홍길동", email: "a@b.co", link: "https://example.com" }).success).toBe(true);
  });

  it("포트폴리오 프로필로 복사할 때는 이름·연락처가 섞여 들어가지 않는다", () => {
    const mine = myProfileSchema.parse({ intro: "소개", name: "홍길동", email: "a@b.co", link: "https://example.com" });
    const profileOnly = profileSchema.parse(mine);
    expect(profileOnly).not.toHaveProperty("name");
    expect(profileOnly).not.toHaveProperty("email");
    expect(profileOnly).not.toHaveProperty("link");
    expect(profileOnly.intro).toBe("소개");
  });
});
