import type { SectionKey } from "@/lib/validation/project-answers";

export type FieldKind = "text" | "textarea" | "month" | "select" | "number" | "checkbox" | "url";

export type FieldDef = {
  name: string;
  label: string;
  kind: FieldKind;
  /** 회색 예시 문구. 저장되는 값이 아니다 (spec 7.2, 20-4). */
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  options?: { value: string; label: string }[];
};

export type SectionFormDef = {
  title: string;
  fields: FieldDef[];
  /** 배열 섹션이면 항목 추가 정보를 가진다 */
  repeat?: { max: number; itemLabel: string; addLabel: string };
};

const projectTypes = [
  { value: "work", label: "실제 업무" },
  { value: "intern", label: "인턴" },
  { value: "education", label: "교육·과제" },
  { value: "personal", label: "개인" },
  { value: "other", label: "기타" },
];

export const SECTION_FORMS: Record<SectionKey, SectionFormDef> = {
  overview: {
    title: "프로젝트 개요",
    fields: [
      { name: "oneLine", label: "프로젝트 한 줄 소개", kind: "text", maxLength: 300, placeholder: "회원가입 이후 온보딩 과정을 개선한 프로젝트" },
      { name: "context", label: "어떤 프로젝트를 진행했나요?", kind: "textarea", maxLength: 2000, placeholder: "회원가입 이후 온보딩 과정을 개선해 신규 사용자의 서비스 적응을 지원" },
      { name: "purpose", label: "이 프로젝트를 시작한 이유는 무엇인가요?", kind: "textarea", maxLength: 2000, placeholder: "신규 사용자의 초기 이탈 원인을 파악하고 첫 이용 경험을 개선하고자 시작" },
      { name: "startMonth", label: "시작 월", kind: "month" },
      { name: "endMonth", label: "종료 월", kind: "month", hint: "진행 중이면 비워 두세요." },
      { name: "ongoing", label: "아직 진행 중이에요", kind: "checkbox" },
      { name: "projectType", label: "프로젝트 유형", kind: "select", options: projectTypes },
      { name: "teamSize", label: "팀 규모", kind: "text", maxLength: 40, placeholder: "예: 기획 2명, 디자이너 1명, 개발자 2명" },
    ],
  },
  role: {
    title: "역할",
    fields: [
      { name: "title", label: "직무·역할", kind: "text", maxLength: 80, placeholder: "예: 서비스 기획" },
      { name: "responsibility", label: "맡은 범위", kind: "textarea", maxLength: 2000, placeholder: "사용자 인터뷰 설계, 온보딩 화면 기획" },
    ],
  },
  contribution: {
    title: "Contribution",
    repeat: { max: 10, itemLabel: "수행 항목", addLabel: "수행 항목 추가" },
    fields: [
      { name: "task", label: "수행한 일", kind: "text", maxLength: 80, placeholder: "예: 인터뷰 질문지 설계" },
      {
        name: "ownership",
        label: "책임 수준",
        kind: "select",
        options: [
          { value: "lead", label: "주도" },
          { value: "joint", label: "공동 수행" },
          { value: "support", label: "지원" },
        ],
      },
      { name: "detail", label: "직접 한 일", kind: "textarea", maxLength: 2000, placeholder: "인터뷰 가이드 작성, 사용자 8명 직접 인터뷰 후 핵심 불편 정리" },
      {
        name: "percentOptional",
        label: "기여율 (선택, %)",
        kind: "number",
        hint: "실측 또는 합의 근거가 없으면 책임 수준과 직접 한 일로 설명할 수 있어요.",
      },
    ],
  },
  problem: {
    title: "문제 정의",
    fields: [
      { name: "targetUser", label: "누구에게 발생했나요?", kind: "textarea", maxLength: 2000, placeholder: "가입 7일 이내 신규 사용자" },
      { name: "phenomenon", label: "어떤 현상인가요?", kind: "textarea", maxLength: 2000, placeholder: "가입 직후 다음 행동을 찾지 못하는 사용자 다수" },
      { name: "importance", label: "사용자·비즈니스에 왜 중요한가요?", kind: "textarea", maxLength: 2000, placeholder: "첫 이용에서 막힌 사용자는 이탈하기 쉬워 가입 후 활성 사용자 전환율 하락" },
    ],
  },
  evidence: {
    title: "데이터 및 근거",
    repeat: { max: 10, itemLabel: "근거", addLabel: "근거 추가" },
    fields: [
      { name: "kind", label: "근거 종류", kind: "text", maxLength: 80, placeholder: "예: 사용자 인터뷰, 설문, 로그" },
      { name: "description", label: "어떤 근거인가요?", kind: "textarea", maxLength: 2000, placeholder: "인터뷰에서 반복된 어려움과 관찰 범위" },
      { name: "sourceUrl", label: "근거 링크 (선택)", kind: "url", hint: "http 또는 https 주소만 입력할 수 있어요." },
      { name: "observedAt", label: "확인 시점", kind: "text", maxLength: 40, placeholder: "예: 2026년 3월" },
      { name: "limitation", label: "이 근거의 한계", kind: "textarea", maxLength: 2000, placeholder: "인터뷰 8명으로 전체 사용자를 대표하기 어려움" },
    ],
  },
  insight: {
    title: "핵심 인사이트",
    fields: [
      { name: "pattern", label: "발견한 패턴과 불편", kind: "textarea", maxLength: 2000, placeholder: "가입 직후 누를 버튼을 몰라 화면을 떠나는 사용자 다수" },
      { name: "interpretation", label: "해석", kind: "textarea", maxLength: 2000, placeholder: "첫 화면 안내 부족이 이탈 원인 중 하나로 해석" },
      { name: "limitation", label: "단정하기 어려운 점", kind: "textarea", maxLength: 2000, placeholder: "안내 부족을 의심했으나 원인으로 확정할 데이터 없음" },
    ],
  },
  hypothesis: {
    title: "가설",
    fields: [
      { name: "statement", label: "왜 문제가 생긴다고 생각하나요?", kind: "textarea", maxLength: 2000, placeholder: "첫 화면에서 다음 행동이 보이지 않아 사용자가 헤매는 것이 원인" },
      { name: "expectedBehavior", label: "어떤 행동 변화를 예상하나요?", kind: "textarea", maxLength: 2000, placeholder: "다음 행동을 안내하면 첫 설정 완료 증가 예상" },
    ],
  },
  solution: {
    title: "해결안",
    fields: [
      { name: "selected", label: "무엇을 개선했나요?", kind: "textarea", maxLength: 2000, placeholder: "가입 직후 3단계 시작 가이드 추가로 첫 설정 안내" },
      { name: "alternatives", label: "검토한 다른 대안", kind: "textarea", maxLength: 2000, placeholder: "전체 화면 개편, 영상 튜토리얼 추가" },
      { name: "reason", label: "선택한 이유", kind: "textarea", maxLength: 2000, placeholder: "전체 개편보다 첫 단계 안내 우선. 구현 범위가 작고 핵심 문제에 직접 대응" },
    ],
  },
  metrics: {
    title: "성공 지표",
    repeat: { max: 6, itemLabel: "지표", addLabel: "지표 추가" },
    fields: [
      { name: "name", label: "지표 이름", kind: "text", maxLength: 80, placeholder: "예: 첫 설정 완료율" },
      {
        name: "purpose",
        label: "지표 성격",
        kind: "select",
        options: [
          { value: "primary", label: "성공 지표" },
          { value: "supporting", label: "중간 지표" },
          { value: "guardrail", label: "부작용 확인 지표" },
          { value: "qualitative", label: "정성 지표" },
        ],
      },
      { name: "baseline", label: "기준값", kind: "text", maxLength: 200, placeholder: "예: 첫 설정 완료율 42%" },
      { name: "target", label: "목표값", kind: "text", maxLength: 200, placeholder: "예: 55%" },
      { name: "unit", label: "단위", kind: "text", maxLength: 40, placeholder: "예: %" },
      { name: "measurementPlan", label: "측정 방법", kind: "textarea", maxLength: 2000, placeholder: "검증 예정: 테스트 과제 관찰" },
      { name: "actualOptional", label: "실제 값 (확인한 경우만)", kind: "text", maxLength: 200, placeholder: "예: 4주 평균 51%" },
    ],
  },
  result: {
    title: "결과",
    fields: [
      {
        name: "status",
        label: "결과 상태",
        kind: "select",
        options: [
          { value: "observed", label: "결과를 확인했어요" },
          { value: "not_measured", label: "실행했지만 효과는 측정하지 못했어요" },
          { value: "not_executed", label: "아직 실행하지 않은 기획·과제예요" },
        ],
      },
      {
        name: "type",
        label: "결과 유형",
        kind: "select",
        options: [
          { value: "quantitative", label: "정량 수치" },
          { value: "qualitative", label: "정성 피드백" },
          { value: "deliverable", label: "산출물" },
          { value: "mixed", label: "복합" },
        ],
      },
      { name: "summary", label: "결과 요약", kind: "textarea", maxLength: 2000, placeholder: "프로토타입과 화면 명세 완성. 실제 전환율 변화는 미측정" },
      { name: "facts", label: "확인한 사실", kind: "textarea", maxLength: 2000, placeholder: "프로토타입 테스트에서 5명 중 4명이 도움 없이 첫 설정 완료" },
      { name: "limits", label: "한계", kind: "textarea", maxLength: 2000, placeholder: "실제 서비스 지표 변화 미측정" },
      { name: "nextValidation", label: "다음 검증", kind: "textarea", maxLength: 2000, placeholder: "출시 후 4주간 첫 설정 완료율 확인 예정" },
    ],
  },
  execution: {
    title: "실행 계획",
    fields: [
      { name: "steps", label: "진행 순서", kind: "textarea", maxLength: 2000, placeholder: "기획안 작성, 프로토타입으로 사용 흐름 확인" },
      { name: "collaboration", label: "협업·검증 방법", kind: "textarea", maxLength: 2000, placeholder: "디자이너와 주 1회 화면 검토, 개발자와 구현 범위 조율" },
      {
        name: "status",
        label: "진행 상태",
        kind: "select",
        options: [
          { value: "planned", label: "계획" },
          { value: "in_progress", label: "진행 중" },
          { value: "completed", label: "완료" },
        ],
      },
    ],
  },
  reflection: {
    title: "회고",
    fields: [
      { name: "learning", label: "배운 점", kind: "textarea", maxLength: 2000, placeholder: "문제 정의 전 사용자 행동 관찰의 중요성" },
      { name: "limitation", label: "한계", kind: "textarea", maxLength: 2000, placeholder: "정량 데이터 부족으로 효과 확인 못 한 점이 아쉬움" },
      { name: "nextStep", label: "다음 단계", kind: "textarea", maxLength: 2000, placeholder: "실제 이용 데이터를 추가해 가설 확인 예정" },
      { name: "roleRelevanceOptional", label: "지원 직무와의 연결 (선택)", kind: "textarea", maxLength: 2000, placeholder: "인터뷰와 데이터로 사용자 문제를 정의한 경험이 PM 직무와 연결" },
    ],
  },
};

/** 선택 항목의 값(예: "intern")을 화면에 보이는 이름(예: "인턴")으로 바꾼다. 값이 없거나 모르는 값이면 빈 문자열이다. */
export function optionLabel(section: SectionKey, field: string, value: string | null | undefined): string {
  if (!value) return "";
  return SECTION_FORMS[section].fields.find((f) => f.name === field)?.options?.find((o) => o.value === value)?.label ?? "";
}