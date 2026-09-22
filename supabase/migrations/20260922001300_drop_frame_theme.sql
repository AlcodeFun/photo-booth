-- No theme approach anymore — FrameCanvas always renders the fixed blue frame
-- styling, so the unused theme column on frame_templates is dropped.
alter table public.frame_templates drop column if exists theme;