import { PIN_LENGTH } from "@/lib/quiz/constants";

/**
 * 회차 PIN(JN-01): 숫자 6자리. 진행 중 회차끼리의 중복은 DB 부분 유일 인덱스가 막고,
 * 충돌하면 호출하는 쪽이 새 PIN 으로 다시 시도한다.
 * @param randomInt 0 이상 max 미만의 정수를 돌려주는 함수(서버에서는 crypto.randomInt)
 */
export function generatePin(randomInt: (max: number) => number): string {
  const max = 10 ** PIN_LENGTH;
  return String(randomInt(max)).padStart(PIN_LENGTH, "0");
}

export function isValidPin(value: string): boolean {
  return new RegExp(`^[0-9]{${PIN_LENGTH}}$`).test(value);
}
