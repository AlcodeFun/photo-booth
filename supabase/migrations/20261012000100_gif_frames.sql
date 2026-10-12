-- GIF frames: overlay PNGs the guest can put on their animated GIF.
--
-- Each frame is a PNG with a transparent window; the GIF is rendered at the
-- PNG's aspect ratio with every photo filling the canvas behind the overlay.
-- Admins upload, name, order and enable them; booths list the active ones.

create table if not exists public.gif_frames (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  image_url text not null,
  storage_path text not null default '',
  width integer not null default 0,
  height integer not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.gif_frames is
  'Overlay PNGs for the animated GIF output; the transparent window shows the photo behind.';

create index if not exists gif_frames_order_idx on public.gif_frames (sort_order, created_at);

create trigger gif_frames_set_updated_at
  before update on public.gif_frames
  for each row
  execute function public.set_updated_at();

alter table public.gif_frames enable row level security;

create policy "gif_frames_select" on public.gif_frames
  for select to anon, authenticated using (true);
create policy "gif_frames_insert" on public.gif_frames
  for insert to authenticated with check (true);
create policy "gif_frames_update" on public.gif_frames
  for update to authenticated using (true) with check (true);
create policy "gif_frames_delete" on public.gif_frames
  for delete to authenticated using (true);

-- Public bucket for the overlay images (booths and the gallery read them).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gif-frames', 'gif-frames', true, 10485760, array['image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "gif_frames_bucket_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'gif-frames');
create policy "gif_frames_bucket_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'gif-frames');
create policy "gif_frames_bucket_update" on storage.objects
  for update to authenticated using (bucket_id = 'gif-frames');
create policy "gif_frames_bucket_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'gif-frames');

notify pgrst, 'reload schema';
