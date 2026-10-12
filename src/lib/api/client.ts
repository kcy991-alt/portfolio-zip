// 브라우저에서 우리 API를 부르는 도우미. 실패는 ApiError로 던진다.

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(url: string, init?: Omit<RequestInit, "body"> & { body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "network", "네트워크에 연결하지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
  }

  const json = (await res.json().catch(() => null)) as { data?: T; error?: { code?: string; message?: string } } | null;
  if (!res.ok) {
    const e = json?.error;
    throw new ApiError(res.status, e?.code ?? "unknown", e?.message ?? "요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.", { ...e });
  }
  return json?.data as T;
}
