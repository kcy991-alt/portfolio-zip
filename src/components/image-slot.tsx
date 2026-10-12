"use client";

import { useId, useRef, useState } from "react";
import { MAX_ALT, MAX_CAPTION, needsAltText, REPRESENTATIVE } from "@/lib/storage/asset-limits";
import type { AssetItem, ProjectAssets } from "@/lib/use-project-assets";
import { SECTION_FORMS } from "@/templates/pm-v1/fields";
import type { SectionKey } from "@/lib/validation/project-answers";
import { useAuth } from "./auth-context";

const sectionLabel = (key: string) => (key === REPRESENTATIVE ? "대표 이미지" : SECTION_FORMS[key as SectionKey]?.title ?? key);
const SECTION_OPTIONS = [REPRESENTATIVE, ...Object.keys(SECTION_FORMS)];

const field =
  "min-h-11 w-full rounded-control border border-line bg-panel px-3 text-base focus:border-accent focus:shadow-[0_0_0_2px_rgba(49,91,232,0.15)]";

function ImageCard({ item, first, last, assets }: { item: AssetItem; first: boolean; last: boolean; assets: ProjectAssets }) {
  const captionId = useId();
  const altId = useId();
  const [caption, setCaption] = useState(item.caption);
  const [alt, setAlt] = useState(item.alt_text);
  const [confirming, setConfirming] = useState(false);
  const missingAlt = needsAltText({ decorative: item.decorative, alt_text: alt });

  return (
    <li className="flex flex-col gap-3 rounded-control border border-line p-3 sm:flex-row">
      <div className="flex h-32 w-full shrink-0 items-center justify-center overflow-hidden rounded-control bg-canvas sm:w-40">
        {item.url ? (
          // 서명 주소로 보이는 비공개 이미지라서 next/image 최적화를 쓰지 않는다
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.decorative ? "" : alt} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-sm text-muted">불러오지 못했어요</span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <label htmlFor={captionId} className="text-sm font-medium">
            캡션 (선택)
          </label>
          <input
            id={captionId}
            value={caption}
            maxLength={MAX_CAPTION}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => caption !== item.caption && void assets.update(item.id, { caption })}
            className={`${field} mt-1`}
          />
        </div>

        <div>
          <label htmlFor={altId} className="text-sm font-medium">
            대체텍스트 {item.decorative ? "(장식용이라 필요 없어요)" : ""}
          </label>
          <input
            id={altId}
            value={alt}
            maxLength={MAX_ALT}
            disabled={item.decorative}
            aria-invalid={missingAlt ? true : undefined}
            placeholder="이미지를 볼 수 없는 사람에게 무엇이 담겼는지 설명해 주세요"
            onChange={(e) => setAlt(e.target.value)}
            onBlur={() => alt !== item.alt_text && void assets.update(item.id, { alt_text: alt })}
            className={`${field} mt-1 disabled:bg-canvas`}
          />
          {missingAlt && <p className="mt-1 text-sm text-danger">대체텍스트를 입력하거나, 꾸밈용 이미지라면 &lsquo;장식용&rsquo;을 체크해 주세요.</p>}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={item.decorative}
              onChange={(e) => void assets.update(item.id, { decorative: e.target.checked })}
              className="size-5 accent-accent"
            />
            장식용
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={item.include_in_output}
              onChange={(e) => void assets.update(item.id, { include_in_output: e.target.checked })}
              className="size-5 accent-accent"
            />
            출력에 포함
          </label>
          <label className="flex items-center gap-2">
            <span className="text-muted">구역</span>
            <select
              value={item.section_key}
              onChange={(e) => void assets.update(item.id, { section_key: e.target.value })}
              className="min-h-11 rounded-control border border-line bg-panel px-2"
            >
              {SECTION_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {sectionLabel(k)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            disabled={first}
            onClick={() => void assets.move(item.id, -1)}
            aria-label="앞으로 옮기기"
            className="min-h-11 rounded-control border border-line px-3 hover:bg-canvas disabled:text-muted"
          >
            ↑ 앞으로
          </button>
          <button
            type="button"
            disabled={last}
            onClick={() => void assets.move(item.id, 1)}
            aria-label="뒤로 옮기기"
            className="min-h-11 rounded-control border border-line px-3 hover:bg-canvas disabled:text-muted"
          >
            ↓ 뒤로
          </button>
          {confirming ? (
            <span className="flex items-center gap-2">
              <span className="text-danger">이 이미지를 지울까요?</span>
              <button type="button" onClick={() => void assets.remove(item.id)} className="min-h-11 rounded-control bg-danger px-3 font-medium text-white">
                지우기
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-control px-3 text-muted hover:bg-canvas">
                취소
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="min-h-11 rounded-control px-3 text-danger hover:bg-danger/5">
              삭제
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * 한 구역에 이미지를 붙이는 자리 (spec F06).
 * 비로그인 체험에서는 저장소가 없으므로 올리려 하면 로그인 안내를 띄운다.
 */
export function ImageSlot({ sectionKey, assets, mode }: { sectionKey: string; assets: ProjectAssets | null; mode: "real" | "local" }) {
  const input = useRef<HTMLInputElement>(null);
  const { requireLogin } = useAuth();
  const items = assets?.items.filter((i) => i.section_key === sectionKey) ?? [];
  const uploading = assets?.uploadingSection === sectionKey;
  const isRep = sectionKey === REPRESENTATIVE;
  const title = isRep ? "대표 이미지" : "이미지";

  return (
    <div className="mt-4 border-t border-line pt-4" data-image-slot={sectionKey}>
      <p className="text-sm font-medium">{title}</p>

      {items.length > 0 && (
        <ul className="mt-2 flex flex-col gap-3">
          {items.map((item, index) => (
            <ImageCard key={item.id} item={item} first={index === 0} last={index === items.length - 1} assets={assets!} />
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-label={`${title} 파일 선택`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // 같은 파일을 다시 고를 수 있게 비운다
            if (file && assets) void assets.upload(file, sectionKey);
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => {
            if (mode === "local") return void requireLogin("이미지를 올리려면 로그인해야 해요. 이미지는 저장소가 필요해서 로그인한 뒤에만 붙일 수 있어요.");
            input.current?.click();
          }}
          className="min-h-11 rounded-control border border-accent px-4 text-sm font-medium text-accent hover:bg-accent-soft disabled:border-line disabled:text-muted"
        >
          {uploading ? "올리는 중…" : `+ ${title} 추가`}
        </button>
        <span className="text-sm text-muted">JPEG·PNG·WebP, 10MB 이하. 큰 이미지는 올리기 전에 자동으로 줄여요.</span>
      </div>

      <p className="mt-1 text-sm text-muted">이름·연락처·회사 내부 정보가 보이지 않는지 확인하고 올려 주세요.</p>
      {assets?.uploadError && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {assets.uploadError} 입력한 글은 그대로 있어요.
        </p>
      )}
    </div>
  );
}
