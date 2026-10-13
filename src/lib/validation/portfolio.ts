import { z } from "zod";
import { projectAnswersSchema } from "./project-answers";

// spec 8.3: 표지·Summary·프로필의 입력 규칙. 서버가 최종 검사를 하고 화면에서도 같은 규칙을 쓴다.
export const PORTFOLIO_LIMITS = {
  title: 80,
  name: 60,
  targetRole: 80,
  tagline: 150,
  email: 120,
  url: 2000,
  summaryItems: 5,
  summaryTitle: 100,
  summaryDescription: 300,
  summaryProjects: 10,
  profileIntro: 600,
  education: 10,
  careers: 10,
  certificates: 10,
  tools: 20,
  org: 80,
  course: 80,
  role: 80,
  certName: 80,
  issuer: 80,
  period: 40,
  detail: 300,
  toolName: 40,
  toolDetail: 150,
} as const;

const L = PORTFOLIO_LIMITS;

export const portfolioTitleSchema = z
  .string()
  .trim()
  .min(1, "포트폴리오 이름을 입력해 주세요.")
  .max(L.title, `포트폴리오 이름은 ${L.title}자 이하로 입력해 주세요.`);

const httpUrl = z
  .string()
  .max(L.url)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "http 또는 https 주소만 입력할 수 있어요.")
  .default("");

const email = z
  .string()
  .max(L.email)
  .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "이메일 주소 형식을 확인해 주세요.")
  .default("");

/** 표지. 이름은 출력할 때 필수이지만 작성 중에는 비어 있어도 저장할 수 있다. 연락처는 기본으로 출력에 넣지 않는다. */
export const coverSchema = z.object({
  name: z.string().max(L.name).default(""),
  targetRole: z.string().max(L.targetRole).default(""),
  tagline: z.string().max(L.tagline).default(""),
  email,
  link: httpUrl,
  includeContact: z.boolean().default(false),
});

/** id는 화면에서 항목을 구분하려고 붙인다. projectIds는 이 항목과 연결한 프로젝트 사본(portfolio_project)의 id다. */
export const summaryItemSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().max(L.summaryTitle).default(""),
  description: z.string().max(L.summaryDescription).default(""),
  projectIds: z.array(z.string().min(1).max(64)).max(L.summaryProjects).default([]),
});

export const summarySchema = z.object({
  items: z.array(summaryItemSchema).max(L.summaryItems).default([]),
});

const educationItem = z.object({
  id: z.string().min(1).max(64),
  org: z.string().max(L.org).default(""),
  course: z.string().max(L.course).default(""),
  period: z.string().max(L.period).default(""),
  description: z.string().max(L.detail).default(""),
});

const careerItem = z.object({
  id: z.string().min(1).max(64),
  org: z.string().max(L.org).default(""),
  role: z.string().max(L.role).default(""),
  period: z.string().max(L.period).default(""),
  description: z.string().max(L.detail).default(""),
});

// 자격증: 이름·발급 기관·취득일만 받는다. 점수·등급 같은 항목은 두지 않는다.
const certificateItem = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(L.certName).default(""),
  issuer: z.string().max(L.issuer).default(""),
  date: z.string().max(L.period).default(""),
});

// 도구에는 숙련도 퍼센트 같은 임의의 점수를 두지 않는다 (spec 8.3)
const toolItem = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(L.toolName).default(""),
  description: z.string().max(L.toolDetail).default(""),
});

export const profileSchema = z.object({
  intro: z.string().max(L.profileIntro).default(""),
  education: z.array(educationItem).max(L.education).default([]),
  careers: z.array(careerItem).max(L.careers).default([]),
  certificates: z.array(certificateItem).max(L.certificates).default([]),
  tools: z.array(toolItem).max(L.tools).default([]),
});

/**
 * 마이페이지에 저장하는 내용: 프로필(소개·교육·경력·자격증·도구)과 기본 정보(이름·이메일·링크).
 * 같은 JSON 칸(my_profile.profile)에 항목만 더했고, 예전에 저장한 값에는 새 항목이 없어도 빈 값으로 읽는다.
 * 지원 직무는 지원처마다 달라서 여기에 두지 않고 표지에서 적는다.
 */
export const myProfileSchema = profileSchema.extend({
  name: z.string().max(L.name).default(""),
  email,
  link: httpUrl,
});

export type Cover = z.infer<typeof coverSchema>;
export type MyProfile = z.infer<typeof myProfileSchema>;
/** 표지에서 마이페이지로부터 불러올 수 있는 항목 */
export type CoverBasics = Pick<Cover, "name" | "email" | "link">;
export type Summary = z.infer<typeof summarySchema>;
export type SummaryItem = z.infer<typeof summaryItemSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type EducationItem = z.infer<typeof educationItem>;
export type CareerItem = z.infer<typeof careerItem>;
export type CertificateItem = z.infer<typeof certificateItem>;
export type ToolItem = z.infer<typeof toolItem>;

export const emptyCover = (): Cover => coverSchema.parse({});
export const emptySummary = (): Summary => summarySchema.parse({});
export const emptyProfile = (): Profile => profileSchema.parse({});
export const emptyMyProfile = (): MyProfile => myProfileSchema.parse({});

/** 제작본 안의 프로젝트 사본 내용. 원본과 같은 모양이다(spec 5.3). */
export const snapshotSchema = z.object({
  title: z.string().trim().min(1).max(80),
  answers: projectAnswersSchema,
  template_key: z.string().default("pm"),
  template_version: z.number().int().default(1),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

// ---- 요청 본문 ----

export const createPortfolioBodySchema = z.object({ title: portfolioTitleSchema });

export const patchPortfolioBodySchema = z
  .object({
    expected_revision: z.number().int().min(1),
    title: portfolioTitleSchema.optional(),
    cover: coverSchema.optional(),
    summary: summarySchema.optional(),
    profile: profileSchema.optional(),
  })
  .refine((v) => v.title !== undefined || v.cover !== undefined || v.summary !== undefined || v.profile !== undefined, {
    message: "바꿀 내용이 없어요.",
  });

export const patchPortfolioProjectBodySchema = z
  .object({
    expected_revision: z.number().int().min(1),
    title: z.string().trim().min(1, "프로젝트 제목을 입력해 주세요.").max(80).optional(),
    answers: projectAnswersSchema.optional(),
  })
  .refine((v) => v.title !== undefined || v.answers !== undefined, { message: "바꿀 내용이 없어요." });

export const addProjectBodySchema = z.object({ project_id: z.uuid() });
export const reorderBodySchema = z.object({ ids: z.array(z.uuid()).min(1).max(100) });
export const patchPageBodySchema = z
  .object({
    hidden: z.boolean().optional(),
    section_keys: z.array(z.string().min(1).max(40)).max(20).optional(),
  })
  .refine((v) => v.hidden !== undefined || v.section_keys !== undefined, { message: "바꿀 내용이 없어요." });
export const patchPortfolioAssetBodySchema = z
  .object({
    caption: z.string().max(150).optional(),
    alt_text: z.string().max(150).optional(),
    decorative: z.boolean().optional(),
    include_in_output: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "바꿀 내용이 없어요." });
