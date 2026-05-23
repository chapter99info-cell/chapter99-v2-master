-- Rename legacy plan tiers → starter | growth | pro (idempotent)

update shops set plan = 'growth' where plan = 'professional';
update shops set plan = 'pro' where plan in ('business', 'business_plus');

alter table shops drop constraint if exists shops_plan_check;

alter table shops
  add constraint shops_plan_check
  check (plan in ('starter', 'growth', 'pro'));

-- Super Admin MRR view (monthly subscription amounts)
create or replace view mrr_overview as
select
  count(*) as total_shops,
  count(*) filter (where active = true) as active_shops,
  sum(case plan
    when 'starter' then 69
    when 'growth'  then 129
    when 'pro'     then 199
    else 0
  end) filter (where active = true) as total_mrr,
  sum(case plan when 'starter' then 69 else 0 end)
    filter (where active = true) as starter_mrr,
  sum(case plan when 'growth' then 129 else 0 end)
    filter (where active = true) as growth_mrr,
  sum(case plan when 'pro' then 199 else 0 end)
    filter (where active = true) as pro_mrr,
  count(*) filter (where plan = 'starter' and active = true) as starter_count,
  count(*) filter (where plan = 'growth' and active = true) as growth_count,
  count(*) filter (where plan = 'pro' and active = true) as pro_count
from shops;
