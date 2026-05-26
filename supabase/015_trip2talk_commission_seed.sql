-- Sample commission rows (run after 006 + 013)

insert into staff_commission_ledger (staff_id, tour_id, amount_aud, description, is_paid)
select s.id, t.id, 249.90, 'Base guide commission — NZ-AUT-2026', false
from staff_profiles s
cross join tours t
where s.role = 'GUIDE' and t.trip_code = 'NZ-AUT-2026'
  and not exists (select 1 from staff_commission_ledger limit 1);
