-- Chapter99 V4 — Phase 7 Schema
-- Super Admin: Proposals + MRR Views

-- ── Proposals table ───────────────────────────────────────────
create table proposals (
  id            uuid primary key default uuid_generate_v4(),
  shop_name     text not null,
  location      text,
  tier          text not null,
  status        text default 'draft',
  setup_fee     numeric(8,2),
  monthly_fee   numeric(8,2),
  bundle_name   text,
  bundle_total  numeric(8,2),
  addons        jsonb default '[]',
  notes         text,
  sent_at       timestamptz,
  expires_at    timestamptz,
  accepted_at   timestamptz,
  declined_at   timestamptz,
  created_by    text default 'super_admin',
  created_at    timestamptz default now()
);

-- Only super admin can access proposals (no RLS shop isolation)
alter table proposals enable row level security;
create policy "super_admin_only" on proposals
  using (current_setting('app.role', true) = 'super_admin');

-- ── MRR Overview (Super Admin) ────────────────────────────────
create or replace view mrr_overview as
select
  count(*) as total_shops,
  count(*) filter (where active = true) as active_shops,
  sum(case plan
    when 'starter'      then 29
    when 'professional' then 69
    when 'business'     then 110
    else 0
  end) filter (where active = true) as total_mrr,
  sum(case plan when 'starter' then 29 else 0 end)
    filter (where active = true) as starter_mrr,
  sum(case plan when 'professional' then 69 else 0 end)
    filter (where active = true) as professional_mrr,
  sum(case plan when 'business' then 110 else 0 end)
    filter (where active = true) as business_mrr,
  count(*) filter (where plan = 'starter' and active = true) as starter_count,
  count(*) filter (where plan = 'professional' and active = true) as professional_count,
  count(*) filter (where plan = 'business' and active = true) as business_count
from shops;

-- ── Shop health view (Super Admin) ───────────────────────────
create or replace view shop_health as
select
  s.id,
  s.name,
  s.plan,
  s.active,
  s.created_at,
  s.phone,
  s.email,
  -- Bookings this month
  count(distinct b.id) filter (
    where b.created_at >= date_trunc('month', now())
  ) as bookings_this_month,
  -- Revenue this month
  coalesce(sum((t.payment->>'total')::numeric) filter (
    where t.paid_at >= date_trunc('month', now())
    and t.status = 'paid'
  ), 0) as revenue_this_month,
  -- Active staff
  count(distinct st.id) filter (where st.active = true) as active_staff,
  -- Critical alerts
  count(distinct a.id) filter (
    where a.dismissed = false and a.severity = 'critical'
  ) as critical_alerts,
  -- Last activity
  max(t.paid_at) as last_transaction
from shops s
left join bookings b on b.shop_id = s.id
left join transactions t on t.shop_id = s.id
left join staff st on st.shop_id = s.id
left join alerts a on a.shop_id = s.id
group by s.id, s.name, s.plan, s.active, s.created_at, s.phone, s.email
order by s.created_at desc;

-- ── All-shops transaction summary (Super Admin) ───────────────
create or replace view all_shops_revenue as
select
  t.shop_id,
  sh.name as shop_name,
  sh.plan,
  date_trunc('month', t.paid_at at time zone 'Australia/Sydney') as month,
  count(*) as tx_count,
  sum((t.payment->>'total')::numeric) as gross_revenue,
  sum((t.payment->>'gst')::numeric) as gst_collected,
  sum((t.payment->>'netRevenue')::numeric) as net_revenue
from transactions t
join shops sh on sh.id = t.shop_id
where t.status = 'paid'
group by t.shop_id, sh.name, sh.plan, month
order by month desc, gross_revenue desc;

-- ── Function: Generate shop config JSON ───────────────────────
create or replace function get_shop_config(p_shop_id text)
returns jsonb language sql as $$
  select jsonb_build_object(
    'shopId', s.id,
    'name', s.name,
    'plan', s.plan,
    'abn', s.abn,
    'phone', s.phone,
    'email', s.email,
    'address', s.address,
    'providerName', s.provider_name,
    'providerNumber', s.provider_number,
    'settings', jsonb_build_object(
      'gst', 0.10,
      'cardSurcharge', s.card_surcharge,
      'amexSurcharge', s.amex_surcharge,
      'currency', s.currency,
      'timezone', s.timezone
    ),
    'services', (
      select jsonb_agg(jsonb_build_object(
        'id', sv.id,
        'nameEn', sv.name_en,
        'duration', sv.duration,
        'price', sv.price,
        'gstFree', sv.gst_free,
        'itemNo', sv.item_no
      ))
      from services sv
      where sv.shop_id = s.id and sv.active = true
    )
  )
  from shops s
  where s.id = p_shop_id;
$$;
