-- Backfill the persist-v2 round whose files reached the gallery but whose row
-- was never patched, and revert the temporary anon-read diagnostic policy.
update public.sessions
set upload_status = 'success',
    print_status = 'success',
    files = '[
      {"name":"framed.png","uploaded":true,"size":295864,"url":"https://photo-booth-gallery.photo-booth-gallery.workers.dev/d/1dxqrjl1ddpocd1h7970mbmej2a/framed.png"},
      {"name":"photo-01.jpg","uploaded":true,"size":97659,"url":"https://photo-booth-gallery.photo-booth-gallery.workers.dev/d/1dxqrjl1ddpocd1h7970mbmej2a/photo-01.jpg"},
      {"name":"photo-02.jpg","uploaded":true,"size":104831,"url":"https://photo-booth-gallery.photo-booth-gallery.workers.dev/d/1dxqrjl1ddpocd1h7970mbmej2a/photo-02.jpg"},
      {"name":"photo-03.jpg","uploaded":true,"size":94971,"url":"https://photo-booth-gallery.photo-booth-gallery.workers.dev/d/1dxqrjl1ddpocd1h7970mbmej2a/photo-03.jpg"},
      {"name":"result.gif","uploaded":true,"size":70700,"url":"https://photo-booth-gallery.photo-booth-gallery.workers.dev/d/1dxqrjl1ddpocd1h7970mbmej2a/result.gif"}
    ]'::jsonb
where token = '1dxqrjl1ddpocd1h7970mbmej2a';

drop policy if exists sessions_select_temp_diag on public.sessions;

notify pgrst, 'reload schema';