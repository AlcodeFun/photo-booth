-- The photo slot of a GIF frame: where the photo goes, drawn (or auto-detected
-- from the transparent / green-screen area) in the admin GIF frame editor.
--
-- Shape: { "x": 0.08, "y": 0.08, "width": 0.84, "height": 0.69 } as fractions
-- of the overlay image. Null = detect the overlay's transparent window at
-- runtime, so frames saved before this column keep working.

alter table public.gif_frames
  add column if not exists photo_slot jsonb;

comment on column public.gif_frames.photo_slot is
  'Photo slot as fractions of the overlay: { x, y, width, height }. Null = auto-detect the transparent window.';

notify pgrst, 'reload schema';
