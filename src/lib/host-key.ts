import "server-only";

import { cookies } from "next/headers";

import { verifyHostKey } from "@/lib/db/sessions";

/**
 * 진행 키(D-27) 쿠키. 회차를 만든 브라우저에만 저장되고(httpOnly), 진행·강퇴·입장 마감에 필요하다.
 * 로그인이 아니라 "폰에서 회차 id 를 알아낸 참가자가 진행을 조작하는 것"만 막는 장치다.
 */

const MAX_AGE_SEC = 24 * 60 * 60;

export function hostKeyCookieName(sessionId: string): string {
  return `sq_hk_${sessionId}`;
}

export async function setHostKeyCookie(sessionId: string, hostKey: string): Promise<void> {
  (await cookies()).set(hostKeyCookieName(sessionId), hostKey, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

/** 이 요청의 브라우저가 회차 진행 권한을 가졌는지 */
export async function hasHostAccess(sessionId: string): Promise<boolean> {
  const key = (await cookies()).get(hostKeyCookieName(sessionId))?.value;
  return verifyHostKey(sessionId, key);
}
