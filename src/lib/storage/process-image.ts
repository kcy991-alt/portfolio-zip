import sharp from "sharp";

// spec 7.5: JPEG/PNG/WebP만, 10MB 이하, 4,096px 이하로 줄이고 재인코딩해서 메타데이터를 지운다.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_DIMENSION = 4096;

const FORMATS = {
  jpeg: { mime: "image/jpeg", ext: "jpg" },
  png: { mime: "image/png", ext: "png" },
  webp: { mime: "image/webp", ext: "webp" },
} as const;

export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidImageError";
  }
}

export type ProcessedImage = {
  buffer: Buffer;
  mime: (typeof FORMATS)[keyof typeof FORMATS]["mime"];
  ext: string;
  width: number;
  height: number;
  bytes: number;
};

/** 실제로 이미지로 해독되는 파일만 통과시킨다. 파일 이름이나 브라우저가 알려 준 형식은 믿지 않는다. */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length === 0) throw new InvalidImageError("빈 파일이에요.");
  if (input.length > MAX_UPLOAD_BYTES) throw new InvalidImageError("파일이 너무 커요. 10MB 이하만 올릴 수 있어요.");

  let format: string | undefined;
  try {
    format = (await sharp(input, { failOn: "error" }).metadata()).format;
  } catch {
    throw new InvalidImageError("이미지 파일을 읽을 수 없어요.");
  }
  if (format !== "jpeg" && format !== "png" && format !== "webp") {
    throw new InvalidImageError("JPEG, PNG, WebP 이미지만 올릴 수 있어요.");
  }

  // rotate()는 방향 정보를 반영한다. withMetadata를 쓰지 않으므로 EXIF 등 메타데이터는 제거된다.
  let pipeline = sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true });

  if (format === "jpeg") pipeline = pipeline.jpeg({ quality: 85, mozjpeg: true });
  else if (format === "png") pipeline = pipeline.png({ compressionLevel: 9 });
  else pipeline = pipeline.webp({ quality: 85 });

  try {
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    return {
      buffer: data,
      mime: FORMATS[format].mime,
      ext: FORMATS[format].ext,
      width: info.width,
      height: info.height,
      bytes: data.length,
    };
  } catch {
    throw new InvalidImageError("이미지를 처리하지 못했어요.");
  }
}
