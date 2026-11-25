-- 005_submit_answer.sql
-- 답안 저장 함수(5단계). "지금 이 문제의 답을 받는 중인지 확인 + 저장"을 한 트랜잭션에서 한다.
--
-- 왜 함수인가:
--   서버(API)에서 "상태 확인 → 저장"을 따로 하면, 그 사이에 교육자가 '마감'을 눌러 결과 화면(reveal)으로
--   넘어간 뒤에 답이 저장될 수 있다(결과 화면 인원과 최종 점수가 어긋남).
--   이 함수는 회차 행을 FOR SHARE 로 잠근 채 상태를 확인하고 저장하므로,
--   상태 전환(update)은 진행 중인 저장이 끝날 때까지 기다리고, 전환 뒤에 온 답은 'closed' 로 거부된다.
--
-- 점수·정답 여부·경과 시간은 서버(Next.js, src/lib/game/scoring.ts)가 계산해서 넘긴다.
-- 같은 사람이 같은 문제에 두 번 내면 처음 답만 남는다(유일 제약, 'duplicate').
-- 다시 실행해도 안전하다.

create or replace function public.submit_answer(
  p_session_id     uuid,
  p_participant_id uuid,
  p_question_index integer,
  p_question_id    uuid,
  p_choice_ids     integer[],
  p_is_correct     boolean,
  p_elapsed_ms     integer,
  p_score          integer
)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_state text;
  v_index integer;
  v_inserted integer;
begin
  select state, current_q_index
    into v_state, v_index
    from public.sessions
   where id = p_session_id
     for share;

  if not found then
    return 'not_found';
  end if;

  if v_state <> 'question' or v_index is distinct from p_question_index then
    return 'closed';
  end if;

  insert into public.answers (session_id, question_id, participant_id, choice_ids, is_correct, elapsed_ms, score)
  values (p_session_id, p_question_id, p_participant_id, p_choice_ids, p_is_correct, p_elapsed_ms, p_score)
  on conflict (session_id, question_id, participant_id) do nothing;

  get diagnostics v_inserted = row_count;
  return case when v_inserted = 1 then 'accepted' else 'duplicate' end;
end;
$$;

-- 서버(Secret key = service_role)만 호출할 수 있게
revoke all on function public.submit_answer(uuid, uuid, integer, uuid, integer[], boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.submit_answer(uuid, uuid, integer, uuid, integer[], boolean, integer, integer) to service_role;

-- 확인용: 한 줄('submit_answer')이 나오면 성공
select proname from pg_proc where proname = 'submit_answer';
