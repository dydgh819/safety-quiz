-- 004_storage.sql
-- 문제·보기·대표 이미지 저장소(Supabase Storage 버킷 'quiz-media').
--
-- - 공개 버킷(D-24): 발표 화면·폰에서 URL 로 바로 읽는다. 파일명은 추측할 수 없는 UUID.
-- - 업로드는 서버가 발급한 서명 업로드 URL 로만 한다(Secret key 사용). 브라우저(Publishable key)에는
--   storage.objects 쓰기 정책을 주지 않는다.
-- - 5MB 제한, WebP/JPEG/PNG 만 허용(브라우저에서 1600px·WebP 로 줄인 뒤 업로드).
-- 다시 실행해도 안전하다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quiz-media', 'quiz-media', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 확인용: 한 줄이 나오고 public = true 여야 한다.
select id, public, file_size_limit, allowed_mime_types
  from storage.buckets
 where id = 'quiz-media';
