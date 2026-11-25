import { z } from "zod";

/** Play 설정(A5, PL-01) 입력 */
export const playSettingsSchema = z.object({
  edu_title: z.string().trim().min(1).max(100),
  edu_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  play_type: z.enum(["onsite", "remote"]),
  options: z
    .object({
      hide_leaderboard: z.boolean(),
      show_choice_text: z.boolean(),
      sound: z.boolean(),
      allow_rejoin: z.boolean(),
      use_submit_button: z.boolean(),
      auto_advance: z.boolean(),
      allow_late_join: z.boolean(),
    })
    .transform((o) => ({ ...o, allow_rejoin: true })), // D-03: 항상 On
});
export type PlaySettingsInput = z.infer<typeof playSettingsSchema>;

/** 폰 입장 요청(JN-04) */
export const joinRequestSchema = z.object({
  nickname: z.string().max(200),
  deviceId: z.uuid(),
});

/** 폰이 참가자임을 밝히는 헤더 */
export const PARTICIPANT_ID_HEADER = "x-participant-id";
export const PARTICIPANT_TOKEN_HEADER = "x-participant-token";

export const participantCredentialsSchema = z.object({
  participantId: z.uuid(),
  token: z.string().min(20).max(200),
});
