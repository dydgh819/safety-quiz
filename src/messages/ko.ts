/**
 * 화면 문구 모음(한국어 전용). 컴포넌트·API 에 한국어 문자열을 직접 쓰지 말고 여기서 가져다 쓴다.
 * 화면 단위로 묶고, 변수가 들어가는 문구는 함수로 둔다.
 */
export const ko = {
  app: {
    name: "안전교육 실시간 퀴즈",
    description: "정기안전보건교육 출석 확인과 이해도 평가를 위한 실시간 퀴즈",
  },

  nav: {
    shows: "My Show",
    reports: "리포트",
    mainLabel: "주 메뉴",
  },

  shows: {
    title: "My Show",
    create: "Show 만들기",
    createComingSoon: "Show 만들기는 2단계에서 추가됩니다.",
    loading: "Show 목록을 불러오는 중…",
    empty: "아직 만든 Show가 없습니다.",
    emptyHint: "Show를 만들고 문제를 작성하면 여기에 표시됩니다.",
    count: (n: number) => `Show ${n}개`,
    questionCount: (n: number) => `${n}문항`,
    incomplete: "미완성",
  },

  reports: {
    title: "리포트",
    comingSoon: "회차별 결과 리포트는 7단계에서 추가됩니다.",
  },

  errors: {
    supabaseNotConfigured: "Supabase 연결 정보가 설정되지 않았습니다.",
    supabaseNotConfiguredHint: (missing: readonly string[]) =>
      `이 배포에 비어 있는 환경변수: ${missing.join(", ")} — Vercel에 등록(Preview 환경 포함)한 뒤 다시 배포(Redeploy)해 주세요.`,
    loadFailed: "데이터를 불러오지 못했습니다.",
    loadFailedHint: "Supabase SQL Editor에서 supabase/migrations 의 SQL 파일을 순서대로 실행했는지 확인해 주세요.",
  },
} as const;
