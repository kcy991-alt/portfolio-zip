"use client";

import { useEffect, useRef, useState } from "react";
import { zoneLabel, type PhysicalPage } from "@/lib/portfolio/output";
import { ScaledPage } from "./portfolio-output";

/**
 * 편집 화면 미리보기에서 출력 페이지(들)를 그린다. 미리보기·PDF 저장 화면과 같은 렌더러를 쓴다(spec 9.2).
 * 지금 작성 중인 구역(activeZone)은 파란 윤곽선과 "작성 위치" 표시로 알리고, 화면 밖에 있으면 그 장이 보이게 움직인다.
 * 이 표시는 편집 화면에서만 나오며 출력에는 나오지 않는다.
 */
export function OutputPages({ pages, total, activeZone }: { pages: PhysicalPage[]; total: number; activeZone: string | null }) {
  const box = useRef<HTMLDivElement>(null);
  // 강조할 구역이 실제로 그려졌는지. 내용이 비어 있으면 출력에도 나오지 않으므로 그려지지 않는다.
  const [drawn, setDrawn] = useState(true);

  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>("[data-zone-active]");
    setDrawn(Boolean(el));
    // 장 안의 내용을 밀어내지 않도록 장 전체를 기준으로 움직인다
    el?.closest<HTMLElement>("[data-scaled-page]")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeZone, pages]);

  return (
    <div ref={box} className="flex flex-col gap-3">
      {activeZone && (
        <p role="status" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded bg-accent px-2 py-0.5 text-xs font-semibold text-white">작성 위치</span>
          <span className="font-medium">{zoneLabel(activeZone)}</span>
          {!drawn && <span className="text-muted">· 아직 비어 있어서 출력에는 나오지 않아요</span>}
        </p>
      )}
      {pages.map((p) => (
        <ScaledPage key={p.key} page={p} total={total} activeZone={activeZone} />
      ))}
      {pages.length > 1 && <p className="text-sm text-muted">내용이 길어서 {pages.length}장으로 나뉘어 출력돼요.</p>}
    </div>
  );
}
