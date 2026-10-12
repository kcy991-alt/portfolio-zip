// 휴지통 규칙 (spec F13): 삭제한 프로젝트·폴더는 30일 동안 보관한다.
export const TRASH_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 영구 삭제까지 남은 날수(오늘 포함). 0이면 오늘 안에 지워진다. */
export function daysLeft(deletedAt: string | Date, now: Date = new Date()): number {
  const deleted = typeof deletedAt === "string" ? new Date(deletedAt) : deletedAt;
  const elapsedDays = Math.floor((now.getTime() - deleted.getTime()) / DAY_MS);
  return Math.max(0, TRASH_DAYS - elapsedDays);
}

/** 이 시각보다 먼저 삭제된 항목은 보관 기간이 지났다. */
export function trashCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - TRASH_DAYS * DAY_MS);
}

export type TrashType = "project" | "folder" | "portfolio";

export type TrashItem = {
  type: TrashType;
  id: string;
  name: string;
  deleted_at: string;
  /** 프로젝트의 원래 폴더. 폴더가 없어졌으면 deleted가 true이거나 null이다. */
  original_folder: { name: string; deleted: boolean } | null;
};
