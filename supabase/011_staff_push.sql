-- Staff Web Push subscriptions (payment alerts)

create table if not exists public.staff_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  role text not null default 'GUIDE',
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists staff_push_subscriptions_role_idx
  on public.staff_push_subscriptions (role);

alter table public.staff_push_subscriptions enable row level security;

drop policy if exists "anon_manage_staff_push" on public.staff_push_subscriptions;
create policy "anon_manage_staff_push"
  on public.staff_push_subscriptions
  for all
  to anon
  using (true)
  with check (true);
