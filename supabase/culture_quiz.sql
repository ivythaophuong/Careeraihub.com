-- Culture Quiz: lead capture and funnel events.
-- Run once in the Supabase SQL Editor. Anonymous visitors can INSERT only; nobody can read
-- these tables with the public anon key. View the data from the Supabase dashboard.

create table if not exists public.culture_leads (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' and length(email) <= 254),
  name                text check (name is null or length(name) <= 80),
  persona             text not null check (length(persona) <= 60),
  score_innovation    int  not null check (score_innovation    between 0 and 100),
  score_autonomy      int  not null check (score_autonomy      between 0 and 100),
  score_collaboration int  not null check (score_collaboration between 0 and 100),
  score_structure     int  not null check (score_structure     between 0 and 100),
  score_pace          int  not null check (score_pace          between 0 and 100),
  marketing_consent   boolean not null default false,
  source              jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create table if not exists public.culture_quiz_events (
  id          bigint generated always as identity primary key,
  event       text not null check (event in ('view','start','complete','unlock','share','cta_click')),
  session_id  text not null check (length(session_id) <= 64),
  source      jsonb not null default '{}'::jsonb,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.culture_leads       enable row level security;
alter table public.culture_quiz_events enable row level security;

-- Insert-only for anonymous and signed-in visitors. No select/update/delete policies exist,
-- so those operations are denied for the public key.
drop policy if exists "anyone can submit a lead" on public.culture_leads;
create policy "anyone can submit a lead"
  on public.culture_leads for insert
  to anon, authenticated
  with check (marketing_consent is true);

drop policy if exists "anyone can log a quiz event" on public.culture_quiz_events;
create policy "anyone can log a quiz event"
  on public.culture_quiz_events for insert
  to anon, authenticated
  with check (true);

create index if not exists culture_leads_created_idx on public.culture_leads (created_at desc);
create index if not exists culture_leads_email_idx   on public.culture_leads (lower(email));
create index if not exists culture_events_event_idx  on public.culture_quiz_events (event, created_at desc);

-- Handy funnel view for the dashboard (run as a normal SQL query):
--   select event, count(distinct session_id) as visitors
--   from public.culture_quiz_events
--   where created_at > now() - interval '30 days'
--   group by event order by visitors desc;
