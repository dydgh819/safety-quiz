/**
 * 폰 브라우저 저장소(localStorage): 기기 ID(JN-07)와 회차별 입장 정보(재접속 토큰).
 * 사생활 보호 모드 등에서 저장소가 막히면 null 을 돌려준다(예외를 던지지 않음).
 */

const DEVICE_KEY = "sq_device_id";
const credentialsKey = (sessionId: string) => `sq_participant_${sessionId}`;

export type StoredCredentials = { participantId: string; token: string };

function storage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = "__sq_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** 이 기기의 ID. 없으면 만든다. 저장소를 못 쓰면 null */
export function getOrCreateDeviceId(): string | null {
  const s = storage();
  if (!s) return null;
  try {
    let id = s.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      s.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function loadCredentials(sessionId: string): StoredCredentials | null {
  try {
    const raw = storage()?.getItem(credentialsKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCredentials>;
    return typeof parsed.participantId === "string" && typeof parsed.token === "string"
      ? { participantId: parsed.participantId, token: parsed.token }
      : null;
  } catch {
    return null;
  }
}

export function saveCredentials(sessionId: string, credentials: StoredCredentials): boolean {
  try {
    const s = storage();
    if (!s) return false;
    s.setItem(credentialsKey(sessionId), JSON.stringify(credentials));
    return true;
  } catch {
    return false;
  }
}

export function clearCredentials(sessionId: string): void {
  try {
    storage()?.removeItem(credentialsKey(sessionId));
  } catch {
    // 무시
  }
}
