import type { SessionOptions } from "@/types/db";

/**
 * 퀴즈 관련 상수. DB check 제약(001_init.sql)과 같은 값이어야 한다.
 * 값을 바꾸면 마이그레이션도 새 번호로 함께 바꾼다.
 */

/** Show 제목 최대 길이(SH-03) */
export const SHOW_TITLE_MAX = 50;
/** 단문형 문제 최대 길이(QZ-02) */
export const SHORT_QUESTION_MAX = 120;
/** 장문형 문제 최대 길이(QZ-02) */
export const LONG_QUESTION_MAX = 300;
/** 보기 텍스트 최대 길이(QZ-03) */
export const CHOICE_TEXT_MAX = 60;
/** 보기 개수(QZ-03) */
export const MIN_CHOICES = 2;
export const MAX_CHOICES = 4;

/** 제한시간 선택지(초)와 기본값(QZ-04) */
export const TIME_LIMIT_OPTIONS = [5, 10, 20, 30, 60, 90, 120] as const;
export type TimeLimitSec = (typeof TIME_LIMIT_OPTIONS)[number];
export const DEFAULT_TIME_LIMIT_SEC: TimeLimitSec = 20;

/** 닉네임 길이(D-07) */
export const NICKNAME_MIN = 1;
export const NICKNAME_MAX = 20;

/** 회차 PIN 자릿수(JN-01) */
export const PIN_LENGTH = 6;

/** 보기 1~4의 도형. 색은 globals.css 의 --color-choice-1~4 토큰(색+도형+번호 3중 구분, MB-02) */
export const CHOICE_SHAPES = ["▲", "◆", "●", "■"] as const;

/** 진행 옵션 기본값(PRD 3.5 + 지각 입장 D-05) */
export const DEFAULT_SESSION_OPTIONS: SessionOptions = {
  hide_leaderboard: false,
  show_choice_text: false,
  sound: true,
  allow_rejoin: true,
  use_submit_button: false,
  auto_advance: false,
  allow_late_join: true,
};

/** 허용되지 않은 값이면 가장 가까운 허용값으로 맞춘다(같은 거리면 짧은 쪽). 엑셀 업로드 등에서 사용(QZ-10). */
export function nearestTimeLimit(sec: number): TimeLimitSec {
  let best: TimeLimitSec = TIME_LIMIT_OPTIONS[0];
  for (const option of TIME_LIMIT_OPTIONS) {
    if (Math.abs(option - sec) < Math.abs(best - sec)) best = option;
  }
  return best;
}
