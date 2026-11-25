import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * 진행 키(D-27)·재접속 토큰(PRD 6.1)용 비밀값. 원문은 브라우저에만 두고 DB 에는 해시만 저장한다.
 * (서버 전용: node:crypto 사용)
 */

/** 추측할 수 없는 비밀값(256비트, URL 에 써도 되는 문자) */
export function createSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** 비밀값이 저장된 해시와 맞는지(시간차 공격 방지 비교) */
export function verifySecret(secret: string, storedHash: string): boolean {
  if (!secret || !storedHash) return false;
  const a = Buffer.from(hashSecret(secret), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
