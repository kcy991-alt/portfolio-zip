import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Autosaver, type SaveResult, type SaveStatus } from "@/lib/autosave";

type Call = { payload: string; revision: number; resolve: (r: SaveResult) => void };

function setup(initialRevision = 1) {
  const calls: Call[] = [];
  const statuses: SaveStatus[] = [];
  const saver = new Autosaver<string>({
    initialRevision,
    delayMs: 1000,
    onStatus: (s) => statuses.push(s),
    save: (payload, revision) => new Promise<SaveResult>((resolve) => calls.push({ payload, revision, resolve })),
  });
  return { saver, calls, statuses };
}

const flushMicrotasks = () => vi.advanceTimersByTimeAsync(0);

describe("Autosaver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("마지막 입력 1초 뒤에 한 번만 저장한다", async () => {
    const { saver, calls } = setup();
    saver.change("a");
    await vi.advanceTimersByTimeAsync(500);
    saver.change("ab");
    await vi.advanceTimersByTimeAsync(900);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].payload).toBe("ab");
    expect(calls[0].revision).toBe(1);
  });

  it("입력하면 '저장 대기 중'이 되고, 저장이 끝나야 '저장됨'이 된다", async () => {
    const { saver, calls, statuses } = setup();
    saver.change("a");
    expect(statuses).toEqual(["dirty"]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(statuses).toEqual(["dirty", "saving"]);
    calls[0].resolve({ ok: true, revision: 2 });
    await flushMicrotasks();
    expect(statuses).toEqual(["dirty", "saving", "saved"]);
  });

  it("저장 중에 새로 입력하면 먼저 응답이 와도 '저장됨'이 되지 않고, 이어서 최신 내용을 새 revision으로 저장한다", async () => {
    const { saver, calls, statuses } = setup();
    saver.change("첫 내용");
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(1);

    saver.change("첫 내용 + 더 입력"); // 요청이 아직 끝나지 않았다
    calls[0].resolve({ ok: true, revision: 2 }); // 오래된 응답
    await flushMicrotasks();

    expect(statuses).not.toContain("saved"); // 아직 최신 입력이 저장되지 않았다
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(2);
    expect(calls[1].payload).toBe("첫 내용 + 더 입력");
    expect(calls[1].revision).toBe(2);

    calls[1].resolve({ ok: true, revision: 3 });
    await flushMicrotasks();
    expect(statuses.at(-1)).toBe("saved");
    expect(saver.currentRevision).toBe(3);
    expect(saver.hasUnsaved).toBe(false);
  });

  it("같은 시간에 저장 요청을 둘 이상 보내지 않는다", async () => {
    const { saver, calls } = setup();
    saver.change("a");
    await vi.advanceTimersByTimeAsync(1000);
    saver.change("b");
    void saver.flush(); // 요청이 진행 중이라 새 요청을 만들지 않는다
    await flushMicrotasks();
    expect(calls).toHaveLength(1);
  });

  it("실패하면 입력을 지키고 다시 시도할 수 있다", async () => {
    const { saver, calls, statuses } = setup();
    saver.change("지켜야 할 내용");
    await vi.advanceTimersByTimeAsync(1000);
    calls[0].resolve({ ok: false, kind: "error" });
    await flushMicrotasks();

    expect(statuses.at(-1)).toBe("error");
    expect(saver.hasUnsaved).toBe(true);

    void saver.retry();
    await flushMicrotasks();
    expect(calls).toHaveLength(2);
    expect(calls[1].payload).toBe("지켜야 할 내용");
    expect(calls[1].revision).toBe(1);
    calls[1].resolve({ ok: true, revision: 2 });
    await flushMicrotasks();
    expect(statuses.at(-1)).toBe("saved");
  });

  it("저장 요청이 예외로 끝나도 오류 상태가 되고 입력은 남는다", async () => {
    const statuses: SaveStatus[] = [];
    const saver = new Autosaver<string>({
      initialRevision: 1,
      onStatus: (s) => statuses.push(s),
      save: () => Promise.reject(new Error("네트워크 끊김")),
    });
    saver.change("내용");
    await vi.advanceTimersByTimeAsync(1000);
    expect(statuses.at(-1)).toBe("error");
    expect(saver.hasUnsaved).toBe(true);
  });

  it("충돌(409)이면 멈추고 이후 입력으로 자동 덮어쓰지 않는다", async () => {
    const { saver, calls, statuses } = setup();
    saver.change("내 입력");
    await vi.advanceTimersByTimeAsync(1000);
    calls[0].resolve({ ok: false, kind: "conflict" });
    await flushMicrotasks();
    expect(statuses.at(-1)).toBe("conflict");

    saver.change("충돌 뒤 입력");
    await vi.advanceTimersByTimeAsync(5000);
    void saver.retry();
    await flushMicrotasks();
    expect(calls).toHaveLength(1);
  });

  it("flush는 기다리지 않고 바로 저장하고, 바뀐 것이 없으면 아무것도 보내지 않는다", async () => {
    const { saver, calls } = setup();
    void saver.flush();
    await flushMicrotasks();
    expect(calls).toHaveLength(0);

    saver.change("x");
    void saver.flush();
    await flushMicrotasks();
    expect(calls).toHaveLength(1);
  });

  it("setRevision으로 맞춘 revision으로 다음 저장을 보낸다", async () => {
    const { saver, calls } = setup(1);
    saver.setRevision(7);
    saver.change("x");
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls[0].revision).toBe(7);
  });

  it("dispose 뒤에는 저장하지 않는다", async () => {
    const { saver, calls } = setup();
    saver.change("x");
    saver.dispose();
    await vi.advanceTimersByTimeAsync(2000);
    expect(calls).toHaveLength(0);
  });
});
