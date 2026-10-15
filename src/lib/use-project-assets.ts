"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { api, ApiError } from "@/lib/api/client";
import { checkProjectLimits } from "@/lib/storage/asset-limits";
import { PrepareImageError, prepareImageForUpload } from "@/lib/storage/client-compress";

export type AssetItem = {
  id: string; // project_asset id
  asset_id: string;
  section_key: string;
  caption: string;
  alt_text: string;
  decorative: boolean;
  sort_order: number;
  include_in_output: boolean;
  width: number;
  height: number;
  bytes: number;
  /** 보기용 서명 주소. 10분 뒤 만료되므로 주기적으로 새로 받는다. */
  url: string | null;
};

type EditablePatch = Partial<Pick<AssetItem, "caption" | "alt_text" | "decorative" | "section_key" | "sort_order" | "include_in_output">>;

const REFRESH_MS = 8 * 60 * 1000; // 서명 주소(10분)가 만료되기 전에 새로 받는다

const sortItems = (list: AssetItem[]) => [...list].sort((a, b) => a.sort_order - b.sort_order);

/** 프로젝트에 붙은 이미지를 관리한다. projectId가 null이면(비로그인 체험) 아무것도 하지 않는다. */
export function useProjectAssets(projectId: string | null) {
  const [items, setItems] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);
  const [uploadingSection, setUploadingSection] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const reload = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await api<{ items: AssetItem[] }>(`/api/projects/${projectId}/assets`);
      setItems(sortItems(data.items));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "이미지를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 화면이 열릴 때 서버에서 이미지 목록을 가져온다
    void reload();
    if (!projectId) return;
    const timer = setInterval(() => void reload(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [projectId, reload]);

  const upload = useCallback(
    async (file: File, sectionKey: string) => {
      if (!projectId) return;
      setUploadError(null);

      // 서버에 보내기 전에 한도를 미리 확인해서 기다리지 않고 알려 준다 (서버도 다시 확인한다)
      const early = checkProjectLimits(
        itemsRef.current.map((i) => ({ section_key: i.section_key, bytes: i.bytes })),
        sectionKey,
        0,
      );
      if (early) return setUploadError(early.message);

      setUploadingSection(sectionKey);
      try {
        const ready = await prepareImageForUpload(file); // 10MB 원본도 고를 수 있고, 올리기 전에 줄인다
        const form = new FormData();
        form.append("file", ready);
        form.append("project_id", projectId);
        form.append("section_key", sectionKey);
        // 응답이 끊겨 다시 보내도 같은 이미지가 두 번 생기지 않도록 같은 번호를 쓴다
        form.append("operation_id", crypto.randomUUID());

        const send = () => fetch("/api/assets/upload", { method: "POST", body: form });
        let res: Response;
        try {
          res = await send();
        } catch {
          // 네트워크가 끊겼을 수 있으니 같은 번호로 한 번만 더 보낸다
          try {
            res = await send();
          } catch {
            throw new ApiError(0, "network", "네트워크에 연결하지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
          }
        }
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new ApiError(res.status, "upload_failed", json?.error?.message ?? "이미지를 올리지 못했어요. 잠시 뒤 다시 시도해 주세요.");
        }
        await reload();
      } catch (e) {
        // 업로드가 실패해도 텍스트 답변은 그대로 둔다 (spec F06)
        trackEvent("asset_upload_failed", "member"); // 이미지 첨부는 로그인한 사용자만 쓴다
        setUploadError(e instanceof PrepareImageError || e instanceof Error ? e.message : "이미지를 올리지 못했어요.");
      } finally {
        setUploadingSection(null);
      }
    },
    [projectId, reload],
  );

  const update = useCallback(
    async (id: string, patch: EditablePatch) => {
      const before = itemsRef.current;
      setItems((list) => sortItems(list.map((i) => (i.id === id ? { ...i, ...patch } : i))));
      try {
        await api(`/api/asset-links/${id}`, { method: "PATCH", body: patch });
        setError(null);
      } catch (e) {
        setItems(before); // 저장하지 못했으면 화면도 이전 상태로 되돌린다
        setError(e instanceof Error ? e.message : "이미지 정보를 저장하지 못했어요.");
      }
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    const before = itemsRef.current;
    setItems((list) => list.filter((i) => i.id !== id));
    try {
      await api(`/api/asset-links/${id}`, { method: "DELETE" });
      setError(null);
    } catch (e) {
      setItems(before);
      setError(e instanceof Error ? e.message : "이미지를 지우지 못했어요.");
    }
  }, []);

  /** 같은 구역 안에서 순서를 한 칸 옮긴다 */
  const move = useCallback(
    async (id: string, direction: -1 | 1) => {
      const current = itemsRef.current.find((i) => i.id === id);
      if (!current) return;
      const siblings = sortItems(itemsRef.current.filter((i) => i.section_key === current.section_key));
      const index = siblings.findIndex((i) => i.id === id);
      const other = siblings[index + direction];
      if (!other) return;
      // 두 항목의 순서 값을 서로 바꾼다. 값이 같으면 위치로 구분되도록 새로 매긴다.
      const a = current.sort_order === other.sort_order ? index : current.sort_order;
      const b = current.sort_order === other.sort_order ? index + direction : other.sort_order;
      await Promise.all([update(id, { sort_order: b }), update(other.id, { sort_order: a })]);
    },
    [update],
  );

  return { items, loading, error, uploadingSection, uploadError, setUploadError, reload, upload, update, remove, move };
}

export type ProjectAssets = ReturnType<typeof useProjectAssets>;
