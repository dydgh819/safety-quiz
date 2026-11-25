import { describe, expect, it } from "vitest";

import { extensionFor, isOwnMediaUrl, mediaPublicPrefix } from "./storage";

const base = "https://abcd.supabase.co";
const uuid = "123e4567-e89b-12d3-a456-426614174000";

describe("storage", () => {
  it("공개 URL 접두사", () => {
    expect(mediaPublicPrefix(`${base}/`)).toBe(`${base}/storage/v1/object/public/quiz-media/`);
  });

  it("우리 버킷 URL만 허용", () => {
    expect(isOwnMediaUrl(`${base}/storage/v1/object/public/quiz-media/questions/${uuid}.webp`, base)).toBe(true);
    expect(isOwnMediaUrl(`https://evil.example/storage/v1/object/public/quiz-media/questions/${uuid}.webp`, base)).toBe(false);
    expect(isOwnMediaUrl(`${base}/storage/v1/object/public/quiz-media/../x/${uuid}.webp`, base)).toBe(false);
    expect(isOwnMediaUrl(`${base}/storage/v1/object/public/quiz-media/questions/a.webp`, base)).toBe(false);
  });

  it("확장자", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/webp")).toBe("webp");
  });
});
