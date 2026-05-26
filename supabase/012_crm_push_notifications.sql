-- CRM: email receipts + optional Facebook reference; staff push table rename

alter table public.crm_clients drop column if exists line_notify_token;

alter table public.crm_clients
  add column if not exists facebook_profile_url text;

-- Align email column name: production uses client_email; legacy schemas may use email
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_clients' and column_name = 'email'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_clients' and column_name = 'client_email'
  ) then
    alter table public.crm_clients rename column email to client_email;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_clients' and column_name = 'email'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_clients' and column_name = 'client_email'
  ) then
    update public.crm_clients
    set client_email = coalesce(client_email, email)
    where client_email is null and email is not null;
    alter table public.crm_clients drop column email;
  end if;
end $$;

comment on column public.crm_clients.client_email is 'Primary channel for payment receipts (Resend)';
comment on column public.crm_clients.facebook_profile_url is 'Optional Facebook profile URL for staff reference';

-- push_notifications (replaces staff_push_subscriptions)
create table if not exists public.push_notifications (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  role text not null default 'GUIDE',
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_notifications_role_idx
  on public.push_notifications (role);

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'staff_push_subscriptions'
  ) then
    insert into public.push_notifications (
      id, endpoint, p256dh, auth, role, user_agent, created_at, last_seen_at
    )
    select id, endpoint, p256dh, auth, role, user_agent, created_at, last_seen_at
    from public.staff_push_subscriptions
    on conflict (endpoint) do nothing;

    drop table public.staff_push_subscriptions;
  end if;
end $$;

alter table public.push_notifications enable row level security;

drop policy if exists "anon_manage_push_notifications" on public.push_notifications;
create policy "anon_manage_push_notifications"
  on public.push_notifications
  for all
  to anon
  using (true)
  with check (true);
