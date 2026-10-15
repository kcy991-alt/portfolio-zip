import * as amplitude from "@amplitude/unified";

// 제품 이용 이벤트(spec 10.4). Amplitude 설정과 개인정보 원칙은 components/amplitude.tsx와 docs/decisions.md 2026-10-15 참고.
// 이름과 mode(guest: 로그인 없이 체험, member: 로그인)만 보낸다. 사용자가 쓴 글·이미지·연락처·계정 id는 보내지 않는다.
export type AppEventName =
  | "project_created"
  | "core_record_saved"
  | "preview_opened"
  | "portfolio_created"
  | "project_added_to_portfolio"
  | "print_requested"
  | "save_failed"
  | "asset_upload_failed";

export type AppEventMode = "guest" | "member";

/** 실패해도 사용자 동작을 막지 않는다. */
export function trackEvent(name: AppEventName, mode: AppEventMode) {
  try {
    amplitude.track(name, { mode });
  } catch {
    // 분석 오류는 무시한다
  }
}
