-- Backfill two stuck sessions whose uploads DID reach the gallery but whose
-- status files were never persisted (PRINT_QR unmounted before the final patch
-- on a pre-persistence build). File lists come from the gallery's own records.
-- Also reverts the temporary anon-read diagnostic policy.

update public.sessions
set upload_status = 'success',
    print_status = 'success',
    files = '[
      {"name":"framed.png","uploaded":true,"size":582197,"url":"https://photo-booth-gallery.photo-booth-gallery.workers.dev/d/q7q3b5l9j361qqwzssn680bg/framed.png"},
      {"name":"photo-01.jpg","uploaded":true,"size":98584,"url":"https://photo-booth-gallery.photo-booth-gallery.workers.dev/d/q7q3b5l9j361qqwzssn680bg/photo-01.jpg"},
      {"name":"photo-02.jpg","uploaded":true,"size":97295,"url":"https://photo-booth-gallery.photo-booth-gallery.workers.dev/d/q7q3b5l9j361qqwzssn680bg/photo-02.jpg"},
      {"name":"photo-03.jpg","uploaded":true,"size":96591,"url":"https://photo-booth-gallery.photo-booth-gallery.workers.dev/d/q7q3b5l9j361qqwzssn680bg/photo-03.jpg"},
      {"name":"result.gif","uploaded":true,"size":64981,"url":"https://photo-booth-gallery.photo-booth-gallery.workers.dev/d/q7q3b5l9j361qqwzssn680bg/result.gif"}
    ]'::jsonb
where token = 'q7q3b5l9j361qqwzssn680bg';

update public.sessions
set upload_status = 'success',
    print_status = 'success',
    files = '[
      {"name":"framed.png","uploaded":true,"size":586330,"url":"https://photo-booth-gallery.photo-booth-gallery.workers.dev/d/19n26g11t7cc3cbn2fem16bwm2k/framed.png"},
      {"name":"photo-01.jpg","uploaded":true,"size":104157,"url":"https://photo-booth-gallery.photo-booth-gallery.workers.dev/d/19n26g11t7cc3cbn2fem16bwm2k/photo-01.jpg"},
      {"name":"photo-02.jpg","uploaded":true,"size":103205,"url":"https://photo-booth-gallery.photo-booth-gallery.workers.dev/d/19n26g11t7cc3cbn2fem16bwm2k/photo-02.jpg"},
      {"name":"photo-03.jpg","uploaded":true,"size":100965,"url":"https://photo-booth-gallery.photo-booth-gallery.workers.dev/d/19n26g11t7cc3cbn2fem16bwm2k/photo-03.jpg"},
      {"name":"result.gif","uploaded":true,"size":75812,"url":"https://photo-booth-gallery.photo-booth-gallery.workers.dev/d/19n26g11t7cc3cbn2fem16bwm2k/result.gif"}
    ]'::jsonb
where token = '19n26g11t7cc3cbn2fem16bwm2k';

-- Revert the temporary anon-read diagnostic policy.
drop policy if exists sessions_select_temp_diag on public.sessions;

notify pgrst, 'reload schema';