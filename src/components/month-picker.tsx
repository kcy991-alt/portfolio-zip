"use client";

import { useState } from "react";

// 브라우저 기본 월 선택 창은 연도를 고르기 어렵거나 한 해만 보이는 경우가 있어서, 연도와 월을 따로 고르는 선택 칸을 쓴다.
// 고를 수 있는 연도: MIN_YEAR부터 내년까지. 이미 저장된 값이 이 범위 밖이어도 그 연도는 목록에 포함한다.
export const MIN_YEAR = 2015;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "YYYY-MM" 값을 연도·월 두 칸으로 고른다. 한쪽만 골랐을 때는 값이 비어 있다(완성되기 전까지 저장하지 않는다).
 */
export function MonthPicker({
  value,
  onChange,
  disabled,
  label,
  id,
  className,
  describedBy,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
  id?: string;
  className: string;
  describedBy?: string;
}) {
  const [partial, setPartial] = useState({ y: "", m: "" });
  const y = value ? value.slice(0, 4) : partial.y;
  const m = value ? value.slice(5, 7) : partial.m;

  const thisYear = new Date().getFullYear();
  const years: number[] = [];
  for (let n = thisYear + 1; n >= MIN_YEAR; n--) years.push(n);
  if (y && !years.includes(Number(y))) years.push(Number(y)); // 범위 밖의 기존 값도 보이게 한다
  years.sort((a, b) => b - a);

  const update = (ny: string, nm: string) => {
    if (ny && nm) {
      setPartial({ y: "", m: "" });
      onChange(`${ny}-${nm}`);
    } else {
      setPartial({ y: ny, m: nm });
      onChange("");
    }
  };

  return (
    <div className="grid grid-cols-[1.2fr_1fr] gap-2" role="group" aria-label={label}>
      <select id={id} value={y} disabled={disabled} aria-label={`${label} 연도`} aria-describedby={describedBy} onChange={(e) => update(e.target.value, m)} className={className}>
        <option value="">년</option>
        {years.map((n) => (
          <option key={n} value={String(n)}>
            {n}년
          </option>
        ))}
      </select>
      <select value={m} disabled={disabled} aria-label={`${label} 월`} onChange={(e) => update(y, e.target.value)} className={className}>
        <option value="">월</option>
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i} value={pad(i + 1)}>
            {i + 1}월
          </option>
        ))}
      </select>
    </div>
  );
}
