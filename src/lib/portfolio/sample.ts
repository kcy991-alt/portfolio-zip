// "완성되면 이런 포트폴리오가 나와요"를 보여 주는 예시 제작본. 저장하지 않고 화면에서만 쓴다.
// 가상의 내용이며, 성과 숫자는 결과가 아니라 목표로만 적는다(제품의 출력 규칙과 같다).
import { addProjectCopy, createLocalPortfolio, type PortfolioDoc } from "@/lib/portfolio/model";
import { emptyProjectAnswers } from "@/lib/validation/project-answers";

const COPY_ID = "sample-project";

export function createSamplePortfolio(): PortfolioDoc {
  const a = emptyProjectAnswers();
  a.overview = {
    oneLine: "회원가입 이후 온보딩 과정을 개선해 신규 사용자의 첫 이용을 돕는 프로젝트",
    context: "가입 후 첫 설정을 끝내지 못하고 떠나는 신규 사용자 다수",
    purpose: "초기 이탈 원인 파악, 첫 이용 경험 개선",
    startMonth: "2026-03",
    endMonth: "2026-06",
    ongoing: false,
    projectType: "work",
    teamSize: "기획 2명, 디자이너 1명, 개발자 2명",
  };
  a.role = { title: "서비스 기획", responsibility: "사용자 인터뷰 설계, 온보딩 화면 기획. 디자이너와 주 1회 화면 검토, 개발자와 구현 범위 조율" };
  a.problem = {
    targetUser: "가입 7일 이내 신규 사용자",
    phenomenon: "가입 후 첫 설정을 끝내지 않고 떠나는 사용자 다수",
    importance: "첫 설정을 끝낸 사용자의 이후 재이용 비율이 높음",
  };
  a.evidence = [
    { kind: "사용 데이터", description: "첫 설정 완료율 42%, 3단계에서 이탈 최다", sourceUrl: "", observedAt: "2026-03", limitation: "한 달 치 데이터라 계절 영향 확인 불가" },
    { kind: "사용자 인터뷰", description: "신규 사용자 5명 중 4명이 ‘무엇을 먼저 해야 할지 모르겠다’고 응답", sourceUrl: "", observedAt: "2026-04", limitation: "인터뷰 대상 5명으로 제한" },
  ];
  a.insight = {
    pattern: "입력할 정보가 많은 3단계에 이탈 집중",
    interpretation: "한 화면에서 입력을 한꺼번에 요구해 부담을 느꼈을 가능성",
    limitation: "원인 확정에는 단계별 비교 실험 필요",
  };
  a.hypothesis = {
    statement: "필수 입력을 줄이고 단계마다 이유를 안내하면 첫 설정 완료 사용자 증가",
    expectedBehavior: "3단계 이탈 사용자 감소 예상",
  };
  a.solution = {
    selected: "필수 입력 3개로 축소, 나머지는 나중에 입력",
    alternatives: "전체 안내 영상 추가, 단계 수 늘리기",
    reason: "영상은 제작 기간이 길고, 단계를 늘리면 이탈 지점이 늘 수 있음",
  };
  a.metrics = [
    { name: "첫 설정 완료율", purpose: "primary", baseline: "42%", target: "55", unit: "%", measurementPlan: "출시 후 4주 동안 주 단위로 확인", actualOptional: "" },
    { name: "초기 이탈률", purpose: "guardrail", baseline: "31%", target: "28", unit: "% 이하", measurementPlan: "", actualOptional: "" },
  ];
  a.execution = {
    steps: "인터뷰 → 문제 정의 → 화면 설계 → 개발 협의 → 출시 준비",
    collaboration: "디자이너와 주 1회 화면 검토, 개발자와 구현 범위 조율",
    status: "in_progress",
  };
  a.contribution = [
    { task: "사용자 인터뷰 설계", ownership: "lead", detail: "질문지 작성, 5명 인터뷰", percentOptional: null },
    { task: "온보딩 화면 기획", ownership: "joint", detail: "필수 입력을 줄인 화면 흐름 기획", percentOptional: null },
  ];
  a.result = {
    status: "not_executed",
    type: "mixed",
    summary: "출시 전이라 효과는 미확인. 목표 달성 여부는 출시 후 4주간 확인 예정",
    facts: "화면 기획, 개발 협의 완료",
    limits: "실제 사용자 반응 미확인",
    nextValidation: "출시 후 4주간 첫 설정 완료율 확인",
  };
  a.reflection = {
    learning: "수치와 인터뷰를 함께 보면 이탈 원인을 더 구체적으로 좁힐 수 있음",
    limitation: "표본이 작아 결론 단정 보류",
    nextStep: "단계별 비교 실험 제안 예정",
    roleRelevanceOptional: "",
  };

  let doc = createLocalPortfolio("예시 포트폴리오");
  doc = addProjectCopy(doc, { id: "sample-source", title: "신규 사용자 온보딩 개선", answers: a }, COPY_ID).doc;
  return {
    ...doc,
    cover: {
      name: "김기획",
      targetRole: "서비스 기획 · PM",
      tagline: "사용자의 막힌 지점을 찾아 해결하는 기획자",
      email: "",
      link: "",
      includeContact: false,
    },
    summary: {
      items: [
        { id: "s1", title: "데이터와 인터뷰를 함께 봅니다", description: "수치로 이탈 지점을 찾고 인터뷰로 이유를 확인해 문제 정의", projectIds: [COPY_ID] },
        { id: "s2", title: "확인하지 못한 것은 그대로 적습니다", description: "효과 확인 전에는 목표와 검증 계획으로만 기재", projectIds: [COPY_ID] },
      ],
    },
    profile: {
      intro: "신규 사용자의 첫 경험 개선 중심의 서비스 기획",
      education: [{ id: "e1", org: "○○대학교", course: "경영학", period: "2019 ~ 2025", description: "" }],
      careers: [{ id: "c1", org: "○○ 서비스", role: "서비스 기획 인턴", period: "2025.07 ~ 2025.12", description: "신규 기능 기획 지원, 사용자 인터뷰" }],
      certificates: [{ id: "k1", name: "○○ 자격증", issuer: "○○ 기관", date: "2025.06" }],
      tools: [
        { id: "t1", name: "Figma", description: "화면 설계" },
        { id: "t2", name: "SQL", description: "사용 데이터 확인" },
      ],
    },
  };
}
