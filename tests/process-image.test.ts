import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { InvalidImageError, MAX_DIMENSION, MAX_UPLOAD_BYTES, processImage } from "@/lib/storage/process-image";

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 49, g: 91, b: 232 } } });

describe("processImage", () => {
  it("큰 이미지는 4,096px 안으로 줄이고 비율을 지킨다", async () => {
    const input = await solid(5000, 2500).png().toBuffer();
    const out = await processImage(input);
    expect(out.width).toBe(MAX_DIMENSION);
    expect(out.height).toBe(2048);
    expect(out.mime).toBe("image/png");
  });

  it("작은 이미지는 키우지 않는다", async () => {
    const input = await solid(300, 200).jpeg().toBuffer();
    const out = await processImage(input);
    expect([out.width, out.height]).toEqual([300, 200]);
    expect(out.mime).toBe("image/jpeg");
    expect(out.ext).toBe("jpg");
  });

  it("EXIF 같은 메타데이터를 지운다", async () => {
    const input = await solid(100, 100).jpeg().withExif({ IFD0: { Copyright: "개인정보" } }).toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const out = await processImage(input);
    expect((await sharp(out.buffer).metadata()).exif).toBeUndefined();
  });

  it("WebP도 받는다", async () => {
    const input = await solid(64, 64).webp().toBuffer();
    expect((await processImage(input)).mime).toBe("image/webp");
  });

  it("SVG, GIF, 텍스트 파일은 거절한다", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    const gif = await solid(10, 10).gif().toBuffer();
    await expect(processImage(svg)).rejects.toBeInstanceOf(InvalidImageError);
    await expect(processImage(gif)).rejects.toBeInstanceOf(InvalidImageError);
    await expect(processImage(Buffer.from("그냥 텍스트"))).rejects.toBeInstanceOf(InvalidImageError);
  });

  it("빈 파일과 10MB 초과 파일은 거절한다", async () => {
    await expect(processImage(Buffer.alloc(0))).rejects.toBeInstanceOf(InvalidImageError);
    await expect(processImage(Buffer.alloc(MAX_UPLOAD_BYTES + 1))).rejects.toBeInstanceOf(InvalidImageError);
  });
});
