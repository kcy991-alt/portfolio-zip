import { z } from "zod";
import { PROJECT_TYPES, projectAnswersSchema } from "./project-answers";

// 요청 본문 검사. 서버가 최종 검사를 하고, 같은 규칙을 화면에서도 쓴다 (spec 6장 F02·F03)
export const folderNameSchema = z
  .string()
  .trim()
  .min(1, "폴더 이름을 입력해 주세요.")
  .max(60, "폴더 이름은 60자 이하로 입력해 주세요.");

export const projectTitleSchema = z
  .string()
  .trim()
  .min(1, "프로젝트 제목을 입력해 주세요.")
  .max(80, "프로젝트 제목은 80자 이하로 입력해 주세요.");

const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "YYYY-MM 형식으로 입력해 주세요.")
  .nullable()
  .optional();

export const folderBodySchema = z.object({ name: folderNameSchema });

export const createProjectBodySchema = z.object({
  title: projectTitleSchema,
  folder_id: z.uuid().nullable().optional(),
  startMonth: month,
  endMonth: month,
  ongoing: z.boolean().optional(),
  projectType: z.enum(PROJECT_TYPES).nullable().optional(),
});

export const patchProjectBodySchema = z
  .object({
    expected_revision: z.number().int().min(1),
    title: projectTitleSchema.optional(),
    answers: projectAnswersSchema.optional(),
    record_status: z.enum(["draft", "done"]).optional(),
    last_step: z.number().int().min(1).max(10).optional(),
  })
  .refine((v) => v.title !== undefined || v.answers !== undefined || v.record_status !== undefined || v.last_step !== undefined, {
    message: "바꿀 내용이 없어요.",
  });

export const moveProjectBodySchema = z.object({ folder_id: z.uuid().nullable() });

export const uuidSchema = z.uuid();
