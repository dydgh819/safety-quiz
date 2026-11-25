import { NICKNAME_MAX, NICKNAME_MIN } from "@/lib/quiz/constants";

/**
 * 닉네임(D-07): 형식 제한 없이 자유 입력. 앞뒤 공백을 지우고 연속 공백은 하나로 줄인다.
 * 길이는 글자 수(이모지 1개 = 1자) 기준 1~20자. 회차 안 중복 비교는 대소문자를 무시한다.
 */
export function normalizeNickname(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function nicknameLength(nickname: string): number {
  return [...nickname].length;
}

export type NicknameProblem = "empty" | "tooLong";

export function checkNickname(nickname: string): NicknameProblem | null {
  const length = nicknameLength(nickname);
  if (length < NICKNAME_MIN) return "empty";
  if (length > NICKNAME_MAX) return "tooLong";
  return null;
}

export function isSameNickname(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
