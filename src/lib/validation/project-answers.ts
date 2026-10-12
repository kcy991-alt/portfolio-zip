import { z } from "zod";

// spec.md 7.2 — 글자 수 상한은 저장 가능한 상한이며 출력 페이지에 들어간다는 뜻이 아니다.
export const LIMITS = {
  text: 2000,
  intro: 300,
  title: 80,
  evidenceItems: 10,
  contributionItems: 10,
  metricItems: 6,
} as const;

const text = z.string().max(LIMITS.text).default("");
const intro = z.string().max(LIMITS.intro).default("");
const title = z.string().max(LIMITS.title).default("");

const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "YYYY-MM 형식으로 입력해 주세요.")
  .nullable()
  .default(null);

export const PROJECT_TYPES = ["work", "intern", "education", "personal", "other"] as const;
export const EXECUTION_STATUSES = ["planned", "in_progress", "completed"] as const;
export const OWNERSHIPS = ["lead", "joint", "support"] as const;
export const METRIC_PURPOSES = ["primary", "supporting", "guardrail", "qualitative"] as const;
export const RESULT_STATUSES = ["observed", "not_measured", "not_executed"] as const;
export const RESULT_TYPES = ["quantitative", "qualitative", "deliverable", "mixed"] as const;

// http/https만 허용 (spec 7.5). 빈 값은 허용한다.
const httpUrl = z
  .string()
  .max(2000)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "http 또는 https 주소만 입력할 수 있어요.")
  .default("");

export const overviewSchema = z
  .object({
    oneLine: intro,
    context: text,
    purpose: text,
    startMonth: month,
    endMonth: month,
    ongoing: z.boolean().default(false),
    projectType: z.enum(PROJECT_TYPES).nullable().default(null),
    teamSize: z.string().max(40).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.ongoing && v.endMonth !== null) {
      ctx.addIssue({ code: "custom", path: ["endMonth"], message: "진행 중이면 종료 월은 비워 주세요." });
    }
    if (v.startMonth && v.endMonth && v.endMonth < v.startMonth) {
      ctx.addIssue({ code: "custom", path: ["endMonth"], message: "종료 월은 시작 월 이후여야 해요." });
    }
  });

export const roleSchema = z.object({ title, responsibility: text });

export const contributionItemSchema = z.object({
  task: title,
  ownership: z.enum(OWNERSHIPS).nullable().default(null),
  detail: text,
  // 선택 입력 0~100. 합계 100%를 요구하지 않고 자동 추정하지 않는다 (spec 7.3).
  percentOptional: z.number().min(0).max(100).nullable().default(null),
});

export const problemSchema = z.object({ targetUser: text, phenomenon: text, importance: text });

export const evidenceItemSchema = z.object({
  kind: title,
  description: text,
  sourceUrl: httpUrl,
  observedAt: z.string().max(40).default(""),
  limitation: text,
});

export const insightSchema = z.object({ pattern: text, interpretation: text, limitation: text });

export const hypothesisSchema = z.object({ statement: text, expectedBehavior: text });

export const solutionSchema = z.object({ selected: text, alternatives: text, reason: text });

export const metricItemSchema = z.object({
  name: title,
  purpose: z.enum(METRIC_PURPOSES).nullable().default(null),
  baseline: z.string().max(200).default(""),
  target: z.string().max(200).default(""),
  unit: z.string().max(40).default(""),
  measurementPlan: text,
  actualOptional: z.string().max(200).default(""),
});

export const executionSchema = z.object({
  steps: text,
  collaboration: text,
  status: z.enum(EXECUTION_STATUSES).nullable().default(null),
});

export const resultSchema = z.object({
  status: z.enum(RESULT_STATUSES).nullable().default(null),
  type: z.enum(RESULT_TYPES).nullable().default(null),
  summary: text,
  facts: text,
  limits: text,
  nextValidation: text,
});

export const reflectionSchema = z.object({
  learning: text,
  limitation: text,
  nextStep: text,
  roleRelevanceOptional: text,
});

export const projectAnswersSchema = z.object({
  overview: overviewSchema.default(() => overviewSchema.parse({})),
  role: roleSchema.default(() => roleSchema.parse({})),
  contribution: z.array(contributionItemSchema).max(LIMITS.contributionItems).default([]),
  problem: problemSchema.default(() => problemSchema.parse({})),
  evidence: z.array(evidenceItemSchema).max(LIMITS.evidenceItems).default([]),
  insight: insightSchema.default(() => insightSchema.parse({})),
  hypothesis: hypothesisSchema.default(() => hypothesisSchema.parse({})),
  solution: solutionSchema.default(() => solutionSchema.parse({})),
  metrics: z.array(metricItemSchema).max(LIMITS.metricItems).default([]),
  result: resultSchema.default(() => resultSchema.parse({})),
  execution: executionSchema.default(() => executionSchema.parse({})),
  reflection: reflectionSchema.default(() => reflectionSchema.parse({})),
});

export type ProjectAnswers = z.infer<typeof projectAnswersSchema>;
export type SectionKey = keyof ProjectAnswers;

/** 빈 초안. 예시 문구는 저장하지 않는다 (spec 20-4). */
export const emptyProjectAnswers = (): ProjectAnswers => projectAnswersSchema.parse({});
