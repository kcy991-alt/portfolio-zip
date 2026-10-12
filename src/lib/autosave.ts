// 자동 저장 로직 (spec 10.3). 화면(React)과 분리해서 순서 문제를 테스트할 수 있게 했다.
//
// 지키는 규칙
// - 같은 프로젝트에는 한 번에 저장 요청 하나만 보낸다.
// - 요청 중에 새로 입력한 내용은 최신 버퍼에 남겨 두고, 요청이 끝나면 이어서 저장한다.
// - 응답이 현재 버퍼와 같을 때만 '저장됨'으로 표시한다. 오래된 응답이 새 입력을 덮어쓰지 않는다.
// - 실패하면 입력(버퍼)을 그대로 두고 다시 시도할 수 있게 한다.
// - 충돌(409)이면 저장을 멈추고 자동으로 덮어쓰지 않는다.

// dirty: 입력했지만 아직 서버에 보내지 않았다(대기 중). 이때는 '저장됨'이라고 하지 않는다.
export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

export type SaveResult = { ok: true; revision: number } | { ok: false; kind: "conflict" | "error" };

export type AutosaverOptions<T> = {
  save: (payload: T, expectedRevision: number) => Promise<SaveResult>;
  initialRevision: number;
  onStatus: (status: SaveStatus) => void;
  delayMs?: number;
};

export class Autosaver<T> {
  private readonly save: AutosaverOptions<T>["save"];
  private readonly onStatus: (status: SaveStatus) => void;
  private readonly delayMs: number;

  private revision: number;
  private latest: T | undefined;
  private version = 0; // 입력이 바뀔 때마다 올라간다
  private savedVersion = 0; // 서버에 반영된 입력의 버전
  private inFlight = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private status: SaveStatus = "idle";

  constructor(options: AutosaverOptions<T>) {
    this.save = options.save;
    this.onStatus = options.onStatus;
    this.revision = options.initialRevision;
    this.delayMs = options.delayMs ?? 1000;
  }

  /** 입력이 바뀌었을 때 부른다. 마지막 입력 뒤 delayMs가 지나면 저장한다. */
  change(payload: T) {
    if (this.stopped || this.status === "conflict") return;
    this.latest = payload;
    this.version += 1;
    // 저장 중이거나 실패 상태일 때는 그대로 두고(저장 중이면 끝난 뒤 이어서 저장한다), 저장된 상태에서만 '대기 중'으로 바꾼다
    if (this.status === "idle" || this.status === "saved") this.setStatus("dirty");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(), this.delayMs);
  }

  /** 입력 칸을 벗어나거나 단계를 옮길 때 기다리지 않고 바로 저장을 시도한다. */
  flush() {
    clearTimeout(this.timer);
    return this.run();
  }

  /** 실패한 뒤 사용자가 다시 시도할 때 부른다. */
  retry() {
    if (this.status === "conflict") return Promise.resolve();
    return this.flush();
  }

  /** 아직 서버에 반영되지 않은 입력이 있는가 (탭을 닫을 때 경고에 쓴다) */
  get hasUnsaved() {
    return this.version !== this.savedVersion;
  }

  get currentRevision() {
    return this.revision;
  }

  /** 저장과 상관없이 서버가 revision을 올린 경우(예: 다른 동작이 같은 행을 바꿈)에 맞춰 준다. */
  setRevision(revision: number) {
    this.revision = revision;
  }

  dispose() {
    this.stopped = true;
    clearTimeout(this.timer);
  }

  private setStatus(next: SaveStatus) {
    if (this.status === next) return;
    this.status = next;
    this.onStatus(next);
  }

  private async run(): Promise<void> {
    if (this.stopped || this.inFlight || this.status === "conflict") return;
    if (this.version === this.savedVersion || this.latest === undefined) return;

    this.inFlight = true;
    this.setStatus("saving");
    const sentVersion = this.version;
    const payload = this.latest;

    let result: SaveResult;
    try {
      result = await this.save(payload, this.revision);
    } catch {
      result = { ok: false, kind: "error" };
    }
    this.inFlight = false;
    if (this.stopped) return;

    if (result.ok) {
      this.revision = result.revision;
      this.savedVersion = sentVersion;
      if (this.version !== sentVersion) {
        // 저장하는 동안 새로 입력했다. 이어서 저장하고, 그 전에는 '저장됨'으로 바꾸지 않는다.
        await this.run();
      } else {
        this.setStatus("saved");
      }
      return;
    }

    this.setStatus(result.kind === "conflict" ? "conflict" : "error");
  }
}
