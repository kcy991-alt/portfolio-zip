"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { MonthPicker } from "./month-picker";
import { RESULT_GUIDE_HEADLINE, RESULT_STATUS_GUIDE } from "@/templates/pm-v1";
import { SECTION_FORMS, type FieldDef } from "@/templates/pm-v1/fields";
import type { ProjectAnswers, SectionKey } from "@/lib/validation/project-answers";

type Values = Record<string, unknown>;

const controlClass =
  "min-h-11 w-full rounded-control border border-line bg-panel px-3 py-2 text-base text-ink focus:border-accent";

function Field({
  def,
  value,
  onChange,
  error,
  onFocusField,
}: {
  def: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  /** 이 입력 항목에 포커스가 가면 알린다 (미리보기에서 들어갈 자리를 강조하는 데 쓴다) */
  onFocusField?: (name: string) => void;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const describedBy = def.hint || error ? hintId : undefined;
  const str = typeof value === "string" ? value : "";

  if (def.kind === "checkbox") {
    return (
      <label className="flex min-h-11 items-center gap-2" onFocusCapture={() => onFocusField?.(def.name)}>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="size-5 accent-accent"
        />
        <span>{def.label}</span>
      </label>
    );
  }

  return (
    <div className="flex flex-col gap-1" onFocusCapture={() => onFocusField?.(def.name)}>
      <label htmlFor={id} className="text-sm font-medium">
        {def.label}
      </label>

      {def.kind === "textarea" && (
        <textarea
          id={id}
          rows={4}
          value={str}
          maxLength={def.maxLength}
          placeholder={def.placeholder}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className={`${controlClass} resize-y`}
        />
      )}

      {(def.kind === "text" || def.kind === "url") && (
        <input
          id={id}
          type={def.kind === "url" ? "url" : "text"}
          value={str}
          maxLength={def.maxLength}
          placeholder={def.placeholder}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={controlClass}
        />
      )}

      {def.kind === "month" && (
        <MonthPicker
          id={id}
          label={def.label}
          value={str}
          describedBy={describedBy}
          onChange={(v) => onChange(v === "" ? null : v)}
          className={controlClass}
        />
      )}

      {def.kind === "number" && (
        <input
          id={id}
          type="number"
          min={0}
          max={100}
          value={typeof value === "number" ? value : ""}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className={controlClass}
        />
      )}

      {def.kind === "select" && (
        <select
          id={id}
          value={str}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          className={controlClass}
        >
          <option value="">선택하지 않음</option>
          {def.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      <div className="flex justify-between gap-2 text-sm">
        <motion.span key={error ? "error" : "hint"} id={hintId} className={error ? "text-danger" : "text-muted"} initial={error ? { opacity: 0, y: -4 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {error ?? def.hint}
        </motion.span>
        {def.maxLength && (def.kind === "textarea" || def.kind === "text") && (
          <span className="shrink-0 text-muted">
            {str.length}/{def.maxLength}
          </span>
        )}
      </div>
    </div>
  );
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** 서버가 거절할 값을 입력 칸 옆에서 미리 알려 준다. 서버 규칙(spec 7.2·7.3·7.5)과 같다. */
function fieldError(section: SectionKey, def: FieldDef, value: unknown, values: Values): string | undefined {
  if (def.kind === "url" && typeof value === "string" && value !== "" && !/^https?:\/\//i.test(value)) {
    return "http 또는 https 주소만 입력할 수 있어요.";
  }
  if (def.kind === "number" && typeof value === "number" && (value < 0 || value > 100)) {
    return "0에서 100 사이로 입력해 주세요.";
  }
  if (section === "overview" && def.name === "endMonth" && typeof value === "string" && typeof values.startMonth === "string" && value < values.startMonth) {
    return "종료 월은 시작 월 이후여야 해요.";
  }
  return undefined;
}

export function SectionForm({
  section,
  answers,
  onChange,
  onFocusSection,
  onFocusField,
  footer,
}: {
  section: SectionKey;
  answers: ProjectAnswers;
  onChange: (next: ProjectAnswers) => void;
  onFocusSection: (s: SectionKey) => void;
  /** 입력 항목 하나에 포커스가 갔을 때(섹션 포커스 알림 뒤에 불린다) */
  onFocusField?: (s: SectionKey, field: string) => void;
  /** 입력 칸 아래에 붙이는 내용(이미지 첨부 자리 등) */
  footer?: React.ReactNode;
}) {
  const def = SECTION_FORMS[section];
  const data = answers[section] as unknown;

  const setAnswers = (value: unknown) => onChange({ ...answers, [section]: value } as ProjectAnswers);

  const renderFields = (values: Values, setField: (name: string, v: unknown) => void) =>
    def.fields.map((f) => {
      // 진행 중이면 종료 월 입력을 비활성화하지 않고 값만 비운다 (spec 7.2)
      return (
        <Field
          key={f.name}
          def={f}
          value={values[f.name]}
          onChange={(v) => setField(f.name, v)}
          error={fieldError(section, f, values[f.name], values)}
          onFocusField={(name) => onFocusField?.(section, name)}
        />
      );
    });

  const setObjectField = (name: string, v: unknown) => {
    if (section === "overview" && (name === "startMonth" || name === "endMonth") && typeof v === "string" && !MONTH.test(v)) {
      return; // 연도를 5자리로 입력하는 등 형식이 맞지 않는 값은 받지 않는다(서버도 거절한다)
    }
    const base = { ...(data as Values), [name]: v };
    if (section === "overview") {
      if (name === "ongoing" && v === true) base.endMonth = null; // 진행 중이면 종료 월은 비운다
      if (name === "endMonth" && v) base.ongoing = false; // 종료 월을 고르면 '진행 중'이 풀린다
    }
    setAnswers(base);
  };

  return (
    <section
      aria-labelledby={`section-${section}`}
      onFocusCapture={() => onFocusSection(section)}
      className="rounded-card border border-line bg-panel p-4"
    >
      <h3 id={`section-${section}`} className="mb-3 text-lg font-bold">
        {def.title}
      </h3>

      {section === "result" && (
        <div className="mb-4 rounded-control bg-canvas p-3 text-sm">
          <p>{RESULT_GUIDE_HEADLINE}</p>
          {(() => {
            const status = (data as Values).status as keyof typeof RESULT_STATUS_GUIDE | null;
            const g = status ? RESULT_STATUS_GUIDE[status] : null;
            return g ? (
              <p className="mt-2 font-medium">
                {g.question}
                {g.outputLabel && <span className="ml-2 rounded bg-accent-soft px-2 py-0.5 text-accent">출력 라벨: {g.outputLabel}</span>}
              </p>
            ) : null;
          })()}
        </div>
      )}

      {def.repeat ? (
        <div className="flex flex-col gap-4">
          {(data as Values[]).map((item, index) => (
            <fieldset key={index} className="flex flex-col gap-3 rounded-control border border-line p-3">
              <legend className="px-1 text-sm font-medium">
                {def.repeat!.itemLabel} {index + 1}
              </legend>
              {renderFields(item, (name, v) => {
                const list = (data as Values[]).map((it, i) => (i === index ? { ...it, [name]: v } : it));
                setAnswers(list);
              })}
              <button
                type="button"
                onClick={() => setAnswers((data as Values[]).filter((_, i) => i !== index))}
                className="min-h-11 self-start rounded-control border border-line px-3 text-sm text-danger"
              >
                이 {def.repeat!.itemLabel} 삭제
              </button>
            </fieldset>
          ))}
          {(data as Values[]).length < def.repeat.max && (
            <button
              type="button"
              onClick={() => {
                const blank: Values = {};
                for (const f of def.fields) blank[f.name] = f.kind === "number" || f.kind === "select" ? null : "";
                setAnswers([...(data as Values[]), blank]);
              }}
              className="min-h-11 self-start rounded-control border border-accent px-4 text-sm font-medium text-accent"
            >
              + {def.repeat.addLabel}
            </button>
          )}
          <p className="text-sm text-muted">
            최대 {def.repeat.max}개까지 추가할 수 있어요. ({(data as Values[]).length}/{def.repeat.max})
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">{renderFields(data as Values, setObjectField)}</div>
      )}
      {footer}
    </section>
  );
}
