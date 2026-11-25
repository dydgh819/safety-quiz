import type { QuestionIssue } from "@/lib/quiz/validate";

/**
 * 화면 문구 모음(한국어 전용). 컴포넌트·API 에 한국어 문자열을 직접 쓰지 말고 여기서 가져다 쓴다.
 * 화면 단위로 묶고, 변수가 들어가는 문구는 함수로 둔다.
 */

const questionIssues: Record<QuestionIssue, string> = {
  missingText: "문제를 입력해 주세요.",
  textTooLong: "문제가 글자 수 제한을 넘었습니다.",
  longWithImage: "장문형 문제에는 이미지를 넣을 수 없습니다.",
  tooFewChoices: "보기를 2개 이상 만들어 주세요.",
  tooManyChoices: "보기는 4개까지입니다.",
  emptyChoice: "비어 있는 보기가 있습니다. 내용을 넣거나 보기를 삭제해 주세요.",
  choiceTooLong: "보기는 60자까지입니다.",
  noCorrect: "정답을 1개 이상 체크해 주세요.",
  invalidTimeLimit: "제한시간을 다시 선택해 주세요.",
};

const thumbnailNames: Record<string, string> = {
  helmet: "안전모",
  warning: "경고",
  fire: "소화기",
  "first-aid": "응급처치",
  electric: "전기",
  forklift: "지게차",
};

export const ko = {
  app: {
    name: "안전교육 실시간 퀴즈",
    description: "정기안전보건교육 출석 확인과 이해도 평가를 위한 실시간 퀴즈",
  },

  common: {
    cancel: "취소",
    close: "닫기",
    retry: "다시 시도",
    charCount: (n: number, max: number) => `${n}/${max}`,
    comingSoon: (step: number) => `${step}단계에서 추가됩니다.`,
  },

  nav: {
    shows: "My Show",
    reports: "리포트",
    mainLabel: "주 메뉴",
  },

  shows: {
    title: "My Show",
    create: "Show 만들기",
    loading: "Show 목록을 불러오는 중…",
    tabActive: "My Show",
    tabTrash: "휴지통",
    searchPlaceholder: "Show 제목 검색",
    empty: "아직 만든 Show가 없습니다.",
    emptyHint: "'Show 만들기'로 퀴즈 세트를 만들고 문제를 작성해 보세요.",
    noSearchResult: "검색 결과가 없습니다.",
    trashEmpty: "휴지통이 비어 있습니다.",
    trashHint: "휴지통의 Show는 30일 동안 보관된 뒤 목록에서 사라집니다.",
    questionCount: (n: number) => `${n}문항`,
    updatedAt: (date: string) => `수정 ${date}`,
    deletedAt: (date: string, daysLeft: number) => `삭제 ${date} · ${daysLeft}일 후 목록에서 사라짐`,
    incomplete: "미완성",
    incompleteTitle: "미완성 문항이 있습니다",
    menu: "메뉴",
    menuPlay: "Play",
    menuEdit: "편집",
    menuCopy: "복사",
    menuPreview: "미리보기",
    menuDelete: "삭제",
    menuRestore: "복구",
    menuDeleteForever: "완전삭제",
    playNeedsComplete: "완성된 Show만 Play할 수 있습니다.",
    confirmTrash: (title: string) => `'${title}'을(를) 휴지통으로 옮길까요?\n휴지통에서 30일 안에 복구할 수 있습니다.`,
    confirmDeleteForever: (title: string) =>
      `'${title}'을(를) 완전히 삭제할까요?\n문항이 모두 지워지며 되돌릴 수 없습니다. (이미 진행한 회차의 리포트는 남습니다.)`,
    copySuffix: " (복사)",
  },

  showSettings: {
    createTitle: "Show 만들기",
    editTitle: "Show 기본설정",
    titleLabel: "제목",
    titlePlaceholder: "예: 2026년 4분기 정기안전보건교육",
    titleRequired: "제목을 입력해 주세요.",
    descriptionLabel: "설명",
    descriptionPlaceholder: "교육 대상·내용 등 (선택)",
    thumbnailLabel: "대표이미지",
    thumbnailUpload: "직접 올리기",
    thumbnailUploaded: "올린 이미지",
    thumbnailName: (id: string) => thumbnailNames[id] ?? id,
    create: "만들기",
    save: "저장",
  },

  editor: {
    loading: "Show를 불러오는 중…",
    backToList: "← My Show",
    settings: "기본설정",
    preview: "미리보기",
    complete: "완성",
    completed: "완성됨",
    completedHint: "완성된 Show입니다. 문항을 고쳐 미완성이 되면 다시 '완성'을 눌러야 Play할 수 있습니다.",
    saveSaving: "저장 중…",
    saveSaved: "저장됨",
    saveError: "저장하지 못했습니다",
    listTitle: "문제 목록",
    addQuestion: "+ 문제 추가",
    copyQuestion: "복사",
    deleteQuestion: "삭제",
    dragHandle: "끌어서 순서 변경",
    untitledQuestion: "(문제를 입력하세요)",
    incompleteMark: "미완성 문항",
    confirmDeleteQuestion: (n: number) => `${n}번 문제를 삭제할까요?`,
    cannotDeleteLast: "문제는 1개 이상 있어야 합니다.",
    previewLabel: "발표 화면 미리보기",
    incompleteNotice: (n: number) => `${n}번 문제를 완성해 주세요.`,
    noQuestionsNotice: "문제를 1개 이상 만들어 주세요.",
    issues: questionIssues,

    textType: "문제 유형",
    textTypeShort: "단문형",
    textTypeLong: "장문형",
    textTypeShortHint: "최대 120자, 이미지 첨부 가능",
    textTypeLongHint: "최대 300자, 이미지 불가",
    cannotSwitchToShort: "120자를 넘는 문제는 단문형으로 바꿀 수 없습니다. 문제를 줄여 주세요.",
    confirmSwitchToLong: "장문형은 이미지를 쓸 수 없어 문제 이미지가 삭제됩니다. 바꿀까요?",
    questionLabel: "문제",
    questionPlaceholder: "문제를 입력하세요",
    questionImage: "문제 이미지",
    choicesLabel: "보기",
    choicesHint: "2~4개 · 정답에 체크(복수정답 가능)",
    choicePlaceholder: (n: number) => `보기 ${n}`,
    correct: "정답",
    correctFor: (n: number) => `보기 ${n} 정답`,
    addChoice: "+ 보기 추가",
    choiceImageIcon: "🖼",
    choiceImage: (n: number) => `보기 ${n}에 이미지 넣기`,
    removeChoice: (n: number) => `보기 ${n} 삭제`,
    timeLimit: "제한시간",
    seconds: (n: number) => `${n}초`,
    useScore: "점수 사용",
    useScoreHint: "끄면 이 문제는 정답 수만 집계합니다.",
    doubleScore: "점수 2배",
    memo: "메모",
    memoHint: "교육자 전용 — 진행 화면에 나오지 않습니다.",
    memoPlaceholder: "해설, 관련 법령, 강조할 점 등",

    completeDialogTitle: "Show가 완성되었습니다",
    completeDialogBody: "이제 이 Show로 교육을 진행할 수 있습니다.",
    goToList: "My Show로",
    playNow: "바로 Play",
    keepEditing: "계속 편집",
  },

  stage: {
    questionOf: (n: number, m: number) => `${n} / ${m}`,
    seconds: (n: number) => `${n}초`,
    emptyQuestion: "문제를 입력하세요",
    doubleScore: "점수 2배",
    choiceAria: (n: number) => `${n}번 보기`,
  },

  preview: {
    title: "미리보기",
    presenter: "발표 화면",
    phone: "휴대폰 화면 (현장 Play)",
    prev: "◀ 이전",
    next: "다음 ▶",
    showAnswer: "정답 보기",
    showChoiceText: "폰에 보기 텍스트 표시 (답변 노출)",
    edit: "편집",
    position: (n: number, m: number) => `${n} / ${m} 문제`,
    keyboardHint: "← → 키로 이동",
    incompleteBadge: "미완성 문항",
  },

  upload: {
    button: "이미지 올리기",
    replace: "바꾸기",
    remove: "삭제",
    uploading: "올리는 중…",
    notImage: "이미지 파일만 올릴 수 있습니다.",
    tooLarge: "이미지가 너무 큽니다. (줄인 뒤 최대 5MB)",
    failed: "이미지를 올리지 못했습니다. 잠시 후 다시 시도해 주세요.",
  },

  reports: {
    title: "리포트",
    comingSoon: "회차별 결과 리포트는 7단계에서 추가됩니다.",
  },

  errors: {
    supabaseNotConfigured: "Supabase 연결 정보가 설정되지 않았습니다.",
    supabaseNotConfiguredHint: (missing: readonly string[]) =>
      `이 배포에 비어 있는 환경변수: ${missing.join(", ")} — Vercel에 등록(Preview 환경 포함)한 뒤 다시 배포(Redeploy)해 주세요.`,
    wrongServerKey:
      "SUPABASE_SERVICE_ROLE_KEY에 브라우저용 키(Publishable key 또는 anon key)가 들어 있습니다. Supabase → API Keys의 Secret key(sb_secret_…)로 바꾼 뒤 다시 배포해 주세요.",
    loadFailed: "데이터를 불러오지 못했습니다.",
    dbErrorHint: {
      tablesMissing:
        "DB에 테이블이 없습니다. Supabase SQL Editor에서 001_init.sql, 002_rls.sql 내용을 순서대로 실행해 주세요.",
      permissionDenied:
        "서버 키(Secret key)에 테이블 권한이 없습니다. Supabase SQL Editor에서 003_service_role_grants.sql 내용을 실행해 주세요.",
      invalidKey:
        "Supabase 키가 올바르지 않습니다. 키를 다시 복사해 등록하고(앞뒤 공백 없이), URL과 같은 프로젝트의 키인지 확인해 주세요.",
      unreachable:
        "Supabase 서버에 연결하지 못했습니다. NEXT_PUBLIC_SUPABASE_URL이 https://<프로젝트ID>.supabase.co 형식인지, 프로젝트가 일시정지(Paused) 상태가 아닌지 확인해 주세요.",
      unknown: "알 수 없는 오류입니다. 아래 오류 내용을 알려 주세요.",
    },
    dbErrorDetail: (code: string, message: string) => `오류 내용: ${code ? `[${code}] ` : ""}${message}`,
    actionFailed: "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    invalidInput: "입력값이 올바르지 않습니다.",
    showNotFound: "Show를 찾을 수 없습니다. 삭제되었을 수 있습니다.",
    staleData: "다른 곳에서 내용이 바뀌었습니다. 새로고침 후 다시 시도해 주세요.",
  },
} as const;
