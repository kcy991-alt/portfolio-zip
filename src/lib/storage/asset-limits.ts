// 이미지 첨부 한도 (spec 7.5). 서버가 최종 검사를 하고, 화면에서도 같은 규칙으로 미리 알려 준다.

/** 프로젝트 소개 페이지의 "대표 이미지" 자리. 질문 섹션이 아니라서 따로 이름을 붙인다. */
export const REPRESENTATIVE = "representative";

export const MAX_REPRESENTATIVE = 1; // 대표 이미지는 프로젝트당 1개
export const MAX_BODY_IMAGES = 12; // 본문 이미지는 프로젝트 전체에서 12개
export const MAX_PROJECT_BYTES = 80 * 1024 * 1024; // 프로젝트당 80MB (재인코딩한 뒤의 크기)
export const MAX_ACCOUNT_BYTES = 500 * 1024 * 1024; // 계정당 500MB
export const MAX_CAPTION = 150;
export const MAX_ALT = 150;

export type ExistingLink = { section_key: string; bytes: number };

export type LimitError = { code: "too_many_representative" | "too_many_images" | "project_quota_exceeded"; message: string };

/** 새 이미지를 붙여도 되는지 확인한다. 괜찮으면 null, 아니면 사용자에게 보여 줄 문구를 돌려준다. */
export function checkProjectLimits(existing: ExistingLink[], section: string, newBytes: number): LimitError | null {
  const isRep = section === REPRESENTATIVE;
  const repCount = existing.filter((e) => e.section_key === REPRESENTATIVE).length;
  const bodyCount = existing.length - repCount;

  if (isRep && repCount >= MAX_REPRESENTATIVE) {
    return { code: "too_many_representative", message: "대표 이미지는 1개만 둘 수 있어요. 기존 이미지를 지운 뒤 올려 주세요." };
  }
  if (!isRep && bodyCount >= MAX_BODY_IMAGES) {
    return { code: "too_many_images", message: `본문 이미지는 프로젝트 하나에 ${MAX_BODY_IMAGES}개까지 둘 수 있어요.` };
  }
  const used = existing.reduce((sum, e) => sum + e.bytes, 0);
  if (used + newBytes > MAX_PROJECT_BYTES) {
    return { code: "project_quota_exceeded", message: "이 프로젝트의 이미지 용량(80MB)이 가득 찼어요. 쓰지 않는 이미지를 지워 주세요." };
  }
  return null;
}

/** 정보를 전달하는 이미지는 대체텍스트가 필요하다. 장식용으로 표시한 이미지는 필요 없다. */
export function needsAltText(link: { decorative: boolean; alt_text: string }): boolean {
  return !link.decorative && link.alt_text.trim() === "";
}
