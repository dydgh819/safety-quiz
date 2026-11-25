import { z } from "zod";

import { CHOICE_TEXT_MAX, LONG_QUESTION_MAX, MAX_CHOICES, SHOW_TITLE_MAX, TIME_LIMIT_OPTIONS } from "@/lib/quiz/constants";
import { isDefaultThumbnail } from "@/lib/shows/thumbnails";
import { UPLOAD_CONTENT_TYPES, UPLOAD_KINDS, isOwnMediaUrl } from "@/lib/storage";

/**
 * Show·문항 Server Action 입력 검증(zod). 화면에서 막더라도 서버에서 다시 검사한다.
 * 이미지 URL 은 우리 버킷 URL(또는 기본 대표이미지)만 허용한다.
 *
 * 문항 저장은 "미완성"도 허용한다(자동 저장). 완성 여부는 lib/quiz/validate.ts 가 따로 판단한다.
 * 여기서는 DB 제약을 어기는 값(길이 초과 등)만 막는다.
 */

export const uuidSchema = z.uuid();

export function makeMediaUrlSchema(supabaseUrl: string) {
  return z.string().refine((url) => isOwnMediaUrl(url, supabaseUrl), "invalid media url");
}

export function makeShowSettingsSchema(supabaseUrl: string) {
  return z.object({
    title: z.string().trim().min(1).max(SHOW_TITLE_MAX),
    description: z.string().trim().max(500),
    thumbnail_url: z
      .string()
      .refine((url) => isDefaultThumbnail(url) || isOwnMediaUrl(url, supabaseUrl), "invalid thumbnail")
      .nullable(),
  });
}
export type ShowSettingsInput = z.infer<ReturnType<typeof makeShowSettingsSchema>>;

export function makeQuestionUpdateSchema(supabaseUrl: string) {
  const mediaUrl = makeMediaUrlSchema(supabaseUrl).nullable();
  return z
    .object({
      text_type: z.enum(["short", "long"]),
      question_text: z.string().max(LONG_QUESTION_MAX),
      image_url: mediaUrl,
      choices: z
        .array(
          z.object({
            id: z.number().int().min(1).max(MAX_CHOICES),
            text: z.string().max(CHOICE_TEXT_MAX),
            image_url: mediaUrl,
            is_correct: z.boolean(),
          }),
        )
        .max(MAX_CHOICES),
      memo: z.string().max(1000),
      time_limit_sec: z.number().int().refine((v) => (TIME_LIMIT_OPTIONS as readonly number[]).includes(v)),
      use_score: z.boolean(),
      double_score: z.boolean(),
    })
    .transform((q) => ({
      ...q,
      // 장문형은 이미지 불가(DB 제약) — 남아 있으면 지운다
      image_url: q.text_type === "long" ? null : q.image_url,
    }));
}
export type QuestionUpdateInput = z.infer<ReturnType<typeof makeQuestionUpdateSchema>>;

export const uploadRequestSchema = z.object({
  kind: z.enum(UPLOAD_KINDS),
  contentType: z.enum(UPLOAD_CONTENT_TYPES),
  size: z.number().int().positive(),
});
