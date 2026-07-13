-- Chapter99 — block soft-delete of the last active owner/super_admin per shop.
-- Run in Supabase SQL Editor (project euiwkvozrhnbxttfuchh).
-- Does NOT change staff_pin_hash / hash_staff_pin.

create or replace function prevent_last_admin_staff_delete()
returns trigger
language plpgsql
as $$
declare
  other_count integer;
  new_hash text := coalesce(new.pin_hash, '');
  old_hash text := coalesce(old.pin_hash, '');
  deleted_sentinel constant text :=
    '$2a$06$O48RG1gWMyRk6Vgs0fQsXuwcmpKNuVSVcW9xni7W2ABVF1he.D9ZG';
  is_soft_delete boolean;
begin
  is_soft_delete :=
    new_hash is distinct from old_hash
    and (
      new_hash = deleted_sentinel
      or new_hash = '__deleted__'
      or new_hash = 'DELETED'
    );

  if not is_soft_delete then
    return new;
  end if;

  if lower(coalesce(new.role, '')) not in ('owner', 'super_admin') then
    return new;
  end if;

  select count(*)::integer
  into other_count
  from staff s
  where s.shop_id = new.shop_id
    and s.id is distinct from new.id
    and lower(coalesce(s.role, '')) in ('owner', 'super_admin')
    and coalesce(s.active, false) = true
    and coalesce(s.pin_hash, '') not in (deleted_sentinel, '__deleted__', 'DELETED');

  if other_count = 0 then
    raise exception 'Can''t remove the last owner/admin for this shop.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists staff_prevent_last_admin_delete on staff;
create trigger staff_prevent_last_admin_delete
  before update of pin_hash on staff
  for each row
  execute function prevent_last_admin_staff_delete();
