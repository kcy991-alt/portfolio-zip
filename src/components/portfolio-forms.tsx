"use client";

import { useId } from "react";
import type { PortfolioDoc } from "@/lib/portfolio/model";
import {
  PORTFOLIO_LIMITS as L,
  type CareerItem,
  type Cover,
  type EducationItem,
  type Profile,
  type Summary,
  type SummaryItem,
  type ToolItem,
} from "@/lib/validation/portfolio";
import { inputClass } from "./modal";

const newId = () => crypto.randomUUID();

function TextField({
  label,
  value,
  onChange,
  maxLength,
  multiline,
  error,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  multiline?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea id={id} rows={4} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${inputClass} resize-y py-2`} />
      ) : (
        <input id={id} value={value} maxLength={maxLength} placeholder={placeholder} aria-invalid={error ? true : undefined} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      )}
      <div className="flex justify-between gap-2 text-sm">
        <span className={error ? "text-danger" : "text-muted"}>{error ?? hint}</span>
        <span className="shrink-0 text-muted">
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}

const card = "rounded-card border border-line bg-panel p-4";

// ---- 표지 (spec 8.3) ----

export function CoverForm({ cover, onChange }: { cover: Cover; onChange: (c: Cover) => void }) {
  const set = (patch: Partial<Cover>) => onChange({ ...cover, ...patch });
  const emailError = cover.email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cover.email) ? "이메일 주소 형식을 확인해 주세요." : undefined;
  const linkError = cover.link !== "" && !/^https?:\/\//i.test(cover.link) ? "http 또는 https 주소만 입력할 수 있어요." : undefined;

  return (
    <div className={`${card} flex flex-col gap-4`}>
      <h3 className="text-lg font-bold">표지</h3>
      <TextField label="이름 (출력에 꼭 필요해요)" value={cover.name} maxLength={L.name} onChange={(name) => set({ name })} />
      <TextField label="지원 직무" value={cover.targetRole} maxLength={L.targetRole} onChange={(targetRole) => set({ targetRole })} placeholder="예: 서비스 기획" />
      <TextField label="한 줄 소개" value={cover.tagline} maxLength={L.tagline} onChange={(tagline) => set({ tagline })} />

      <div className="rounded-control bg-canvas p-3">
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={cover.includeContact} onChange={(e) => set({ includeContact: e.target.checked })} className="size-5 accent-accent" />
          <span className="font-medium">연락처를 출력에 포함해요</span>
        </label>
        <p className="mt-1 text-sm text-muted">기본은 꺼져 있어요. 외부에 유출되지 않도록 제출할 때만 켜 두는 것을 권해요.</p>
      </div>

      <TextField label="이메일 (선택)" value={cover.email} maxLength={L.email} onChange={(email) => set({ email })} error={emailError} />
      <TextField label="링크 (선택)" value={cover.link} maxLength={L.url} onChange={(link) => set({ link })} error={linkError} placeholder="https://" />
    </div>
  );
}

// ---- 반복 목록 (Summary·교육·경력·도구에서 공통으로 쓴다) ----

function MoveButtons({ index, count, onMove, onRemove, label }: { index: number; count: number; onMove: (d: -1 | 1) => void; onRemove: () => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1 text-sm">
      <button type="button" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`${label} 위로`} className="min-h-11 rounded-control border border-line px-3 hover:bg-canvas disabled:text-muted">
        ↑ 위로
      </button>
      <button type="button" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`${label} 아래로`} className="min-h-11 rounded-control border border-line px-3 hover:bg-canvas disabled:text-muted">
        ↓ 아래로
      </button>
      <button type="button" onClick={onRemove} className="min-h-11 rounded-control px-3 text-danger hover:bg-danger/5">
        삭제
      </button>
    </div>
  );
}

function move<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

const addButton = "min-h-11 self-start rounded-control border border-accent px-4 text-sm font-medium text-accent hover:bg-accent-soft";

// ---- Summary (spec 8.3: 1~5개) ----

export function SummaryForm({ summary, projects, onChange }: { summary: Summary; projects: PortfolioDoc["projects"]; onChange: (s: Summary) => void }) {
  const items = summary.items;
  const setItem = (index: number, patch: Partial<SummaryItem>) => onChange({ items: items.map((it, i) => (i === index ? { ...it, ...patch } : it)) });
  const toggleProject = (index: number, projectId: string, on: boolean) => {
    const current = items[index].projectIds;
    setItem(index, { projectIds: on ? [...current, projectId] : current.filter((id) => id !== projectId) });
  };

  return (
    <div className={`${card} flex flex-col gap-4`}>
      <div>
        <h3 className="text-lg font-bold">Summary</h3>
        <p className="mt-1 text-sm text-muted">핵심 역량을 직접 적고, 그것을 보여 주는 프로젝트를 연결해요. ({items.length}/{L.summaryItems})</p>
      </div>

      {items.map((item, index) => (
        <fieldset key={item.id} className="flex flex-col gap-3 rounded-control border border-line p-3">
          <legend className="px-1 text-sm font-medium">항목 {index + 1}</legend>
          <TextField label="제목" value={item.title} maxLength={L.summaryTitle} onChange={(title) => setItem(index, { title })} />
          <TextField label="설명" value={item.description} maxLength={L.summaryDescription} multiline onChange={(description) => setItem(index, { description })} />
          <div>
            <p className="text-sm font-medium">연결한 프로젝트</p>
            {projects.length === 0 ? (
              <p className="mt-1 text-sm text-muted">포트폴리오에 프로젝트를 담으면 여기서 연결할 수 있어요.</p>
            ) : (
              <ul className="mt-1 flex flex-col">
                {projects.map((p) => (
                  <li key={p.id}>
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <input type="checkbox" checked={item.projectIds.includes(p.id)} onChange={(e) => toggleProject(index, p.id, e.target.checked)} className="size-5 accent-accent" />
                      {p.title}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <MoveButtons index={index} count={items.length} label={`Summary 항목 ${index + 1}`} onMove={(d) => onChange({ items: move(items, index, d) })} onRemove={() => onChange({ items: items.filter((_, i) => i !== index) })} />
        </fieldset>
      ))}

      {items.length < L.summaryItems && (
        <button type="button" onClick={() => onChange({ items: [...items, { id: newId(), title: "", description: "", projectIds: [] }] })} className={addButton}>
          + Summary 항목 추가
        </button>
      )}
    </div>
  );
}

// ---- 프로필 (spec 8.3: 소개 600자, 교육·경력 각 10개, 도구 20개) ----

export function ProfileForm({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const set = (patch: Partial<Profile>) => onChange({ ...profile, ...patch });

  return (
    <div className="flex flex-col gap-4">
      <div className={`${card} flex flex-col gap-4`}>
        <h3 className="text-lg font-bold">프로필</h3>
        <TextField label="소개" value={profile.intro} maxLength={L.profileIntro} multiline onChange={(intro) => set({ intro })} />
      </div>

      <div className={`${card} flex flex-col gap-3`}>
        <h3 className="font-bold">
          교육 <span className="text-sm font-normal text-muted">({profile.education.length}/{L.education})</span>
        </h3>
        {profile.education.map((e, i) => {
          const setE = (patch: Partial<EducationItem>) => set({ education: profile.education.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
          return (
            <fieldset key={e.id} className="flex flex-col gap-3 rounded-control border border-line p-3">
              <legend className="px-1 text-sm font-medium">교육 {i + 1}</legend>
              <TextField label="기관" value={e.org} maxLength={L.org} onChange={(org) => setE({ org })} />
              <TextField label="과정" value={e.course} maxLength={L.course} onChange={(course) => setE({ course })} />
              <TextField label="기간" value={e.period} maxLength={L.period} onChange={(period) => setE({ period })} placeholder="예: 2025.03 ~ 2025.08" />
              <TextField label="설명 (선택)" value={e.description} maxLength={L.detail} multiline onChange={(description) => setE({ description })} />
              <MoveButtons index={i} count={profile.education.length} label={`교육 ${i + 1}`} onMove={(d) => set({ education: move(profile.education, i, d) })} onRemove={() => set({ education: profile.education.filter((_, k) => k !== i) })} />
            </fieldset>
          );
        })}
        {profile.education.length < L.education && (
          <button type="button" onClick={() => set({ education: [...profile.education, { id: newId(), org: "", course: "", period: "", description: "" }] })} className={addButton}>
            + 교육 추가
          </button>
        )}
      </div>

      <div className={`${card} flex flex-col gap-3`}>
        <h3 className="font-bold">
          경력 <span className="text-sm font-normal text-muted">({profile.careers.length}/{L.careers})</span>
        </h3>
        {profile.careers.map((c, i) => {
          const setC = (patch: Partial<CareerItem>) => set({ careers: profile.careers.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
          return (
            <fieldset key={c.id} className="flex flex-col gap-3 rounded-control border border-line p-3">
              <legend className="px-1 text-sm font-medium">경력 {i + 1}</legend>
              <TextField label="조직" value={c.org} maxLength={L.org} onChange={(org) => setC({ org })} />
              <TextField label="역할" value={c.role} maxLength={L.role} onChange={(role) => setC({ role })} />
              <TextField label="기간" value={c.period} maxLength={L.period} onChange={(period) => setC({ period })} />
              <TextField label="설명 (선택)" value={c.description} maxLength={L.detail} multiline onChange={(description) => setC({ description })} />
              <MoveButtons index={i} count={profile.careers.length} label={`경력 ${i + 1}`} onMove={(d) => set({ careers: move(profile.careers, i, d) })} onRemove={() => set({ careers: profile.careers.filter((_, k) => k !== i) })} />
            </fieldset>
          );
        })}
        {profile.careers.length < L.careers && (
          <button type="button" onClick={() => set({ careers: [...profile.careers, { id: newId(), org: "", role: "", period: "", description: "" }] })} className={addButton}>
            + 경력 추가
          </button>
        )}
      </div>

      <div className={`${card} flex flex-col gap-3`}>
        <h3 className="font-bold">
          도구 <span className="text-sm font-normal text-muted">({profile.tools.length}/{L.tools})</span>
        </h3>
        <p className="text-sm text-muted">도구 이름과 어떻게 썼는지만 적어요. 숙련도 점수는 넣지 않아요.</p>
        {profile.tools.map((t, i) => {
          const setT = (patch: Partial<ToolItem>) => set({ tools: profile.tools.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
          return (
            <fieldset key={t.id} className="flex flex-col gap-3 rounded-control border border-line p-3">
              <legend className="px-1 text-sm font-medium">도구 {i + 1}</legend>
              <TextField label="도구 이름" value={t.name} maxLength={L.toolName} onChange={(name) => setT({ name })} />
              <TextField label="활용 설명 (선택)" value={t.description} maxLength={L.toolDetail} onChange={(description) => setT({ description })} />
              <MoveButtons index={i} count={profile.tools.length} label={`도구 ${i + 1}`} onMove={(d) => set({ tools: move(profile.tools, i, d) })} onRemove={() => set({ tools: profile.tools.filter((_, k) => k !== i) })} />
            </fieldset>
          );
        })}
        {profile.tools.length < L.tools && (
          <button type="button" onClick={() => set({ tools: [...profile.tools, { id: newId(), name: "", description: "" }] })} className={addButton}>
            + 도구 추가
          </button>
        )}
      </div>
    </div>
  );
}
