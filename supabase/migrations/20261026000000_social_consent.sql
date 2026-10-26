-- Social media consent at the end of a session.
--
-- When the admin switches it on (booth_settings.social_consent_enabled), the
-- booth asks every guest at the end of the session whether Kelana may post
-- their photos on its social media (Ya / Tidak). The answer is stored on the
-- session; null means the guest was not asked (feature off) or left without
-- answering.

alter table public.booth_settings
  add column if not exists social_consent_enabled boolean not null default false;

comment on column public.booth_settings.social_consent_enabled is
  'Ask guests at the end of a session whether Kelana may post their photos on social media.';

alter table public.sessions
  add column if not exists social_consent boolean,
  add column if not exists social_consent_at timestamptz;

comment on column public.sessions.social_consent is
  'Guest answer to "may Kelana post these photos on social media": true = Ya, false = Tidak, null = not asked / no answer.';
comment on column public.sessions.social_consent_at is
  'When the guest answered the social media consent question.';

-- Admin filter: "which sessions may we post?"
create index if not exists sessions_social_consent_idx
  on public.sessions (social_consent)
  where social_consent is not null;

notify pgrst, 'reload schema';
