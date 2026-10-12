// 브라우저에서 이미지를 올리기 전에 줄인다.
// 사용자는 10MB까지 원본을 고를 수 있지만(spec 7.5), Vercel 함수는 요청 본문이 4.5MB를 넘으면 거절하므로
// 서버로 보내는 파일은 UPLOAD_TARGET_BYTES 이하로 만든다. 서버는 이 파일을 다시 검증하고 재인코딩한다.

export const SOURCE_MAX_BYTES = 10 * 1024 * 1024;
export const UPLOAD_TARGET_BYTES = 3.5 * 1024 * 1024;
export const MAX_DIMENSION = 4096;

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_ATTEMPTS = 5;
const MIN_SCALE = 0.25;

export class PrepareImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrepareImageError";
  }
}

/** 긴 변이 max를 넘으면 비율을 지키며 줄인다. 작은 이미지는 키우지 않는다. */
export function fitWithin(width: number, height: number, max = MAX_DIMENSION): { width: number; height: number } {
  const ratio = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

/**
 * 파일 크기가 목표보다 클 때, 다음 시도에서 곱할 크기 배율을 어림한다.
 * 용량은 대략 화소 수(가로×세로)에 비례하므로 용량 비율의 제곱근만큼 변을 줄이고, 여유를 위해 조금 더 줄인다.
 */
export function nextScale(currentScale: number, currentBytes: number, targetBytes = UPLOAD_TARGET_BYTES): number {
  const ratio = Math.sqrt(targetBytes / currentBytes) * 0.9;
  return Math.max(MIN_SCALE, Math.min(currentScale * 0.95, currentScale * ratio));
}

/** 고른 파일이 올릴 수 있는 종류와 크기인지 확인한다. 문제가 있으면 사용자에게 보여 줄 문구로 던진다. */
export function checkSource(file: { type: string; size: number }): void {
  if (!ACCEPTED.includes(file.type)) throw new PrepareImageError("JPEG, PNG, WebP 이미지만 올릴 수 있어요.");
  if (file.size > SOURCE_MAX_BYTES) throw new PrepareImageError("파일이 너무 커요. 10MB 이하만 올릴 수 있어요.");
  if (file.size === 0) throw new PrepareImageError("빈 파일이에요.");
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * 서버로 보낼 파일을 준비한다.
 * - 이미 작으면 그대로 돌려준다(서버가 다시 크기를 줄이고 메타데이터를 지운다).
 * - 크면 4,096px 안으로 줄이고 WebP(투명도 유지)로 인코딩한다. 첫 시도가 목표보다 크면 용량 비율로 크기를 어림해서 줄여 가며
 *   최대 5번 안에 맞춘다(오래 기다리지 않게 시도 횟수를 제한한다). WebP를 못 만드는 브라우저는 JPEG(흰 배경)로 대신한다.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  checkSource(file);
  if (file.size <= UPLOAD_TARGET_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PrepareImageError("이미지 파일을 읽을 수 없어요.");
  }

  try {
    const base = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new PrepareImageError("이미지를 줄이지 못했어요. 다른 브라우저에서 다시 시도해 주세요.");

    let type: "image/webp" | "image/jpeg" = "image/webp";
    let scale = 1;
    let quality = 0.85;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      canvas.width = Math.max(1, Math.round(base.width * scale));
      canvas.height = Math.max(1, Math.round(base.height * scale));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (type === "image/jpeg") {
        ctx.fillStyle = "#fff"; // JPEG는 투명도가 없으므로 흰 배경을 깐다
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await toBlob(canvas, type, quality);
      if (!blob) break;
      if (blob.type !== type) {
        // 이 브라우저는 요청한 형식을 만들지 못한다. JPEG로 바꿔서 같은 크기로 다시 시도한다.
        if (type === "image/webp") {
          type = "image/jpeg";
          attempt -= 1;
          continue;
        }
        break;
      }
      if (blob.size <= UPLOAD_TARGET_BYTES) {
        const name = file.name.replace(/\.[^.]+$/, "") || "image";
        return new File([blob], `${name}.${type === "image/webp" ? "webp" : "jpg"}`, { type });
      }
      scale = nextScale(scale, blob.size);
      quality = Math.max(0.6, quality - 0.1);
    }
  } finally {
    bitmap.close();
  }

  throw new PrepareImageError("이미지를 4MB 안으로 줄이지 못했어요. 더 작은 이미지를 선택해 주세요.");
}
