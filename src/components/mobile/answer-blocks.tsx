import { choiceStyle } from "@/components/stage/choice-style";
import { ko } from "@/messages/ko";

type Props = {
  /** 보기 id 목록(1~4) */
  choiceIds: number[];
  /** 답변 노출 시 블록에 표시할 보기 텍스트(id → text). 없으면 번호·도형만 */
  texts?: Record<number, string>;
};

/**
 * 피교육자 폰의 답안 블록(현장 Play, MB-02): 화면을 꽉 채우는 2×2 배치, 색+번호+도형 3중 구분.
 * 2단계에서는 미리보기용 정적 표시. 5단계에서 선택·제출 동작을 붙인다.
 */
export function AnswerBlocks({ choiceIds, texts }: Props) {
  return (
    <div className={`grid h-full gap-2 ${choiceIds.length <= 2 ? "grid-cols-1" : "grid-cols-2"}`}>
      {choiceIds.map((id) => {
        const style = choiceStyle(id);
        const text = texts?.[id];
        return (
          <div
            key={id}
            aria-label={ko.stage.choiceAria(id)}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl p-2 text-white ${style.bg}`}
          >
            <span className="text-3xl leading-none font-extrabold">
              <span aria-hidden>{style.shape}</span> {id}
            </span>
            {text && <span className="line-clamp-3 text-center text-xs font-semibold break-keep">{text}</span>}
          </div>
        );
      })}
    </div>
  );
}
