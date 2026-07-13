-- Chapter99 — block soft-delete OR deactivate of the last active owner/super_admin.
-- Applied on live euiwkvozrhnbxttfuchh (pin_hash + active). Keep in sync with DB.
-- Does NOT change staff_pin_hash / hash_staff_pin.

create or replace function prevent_last_admin_staff_delete()
returns trigger
language plpgsql
as $$
declare
  other_count integer;
  deleted_sentinel constant text :=
    '$2a$06$O48RG1gWMyRk6Vgs0fQsXuwcmpKNuVSVcW9xni7W2ABVF1he.D9ZG';
  is_soft_delete boolean;
  is_deactivate boolean;
begin
  is_soft_delete :=
    coalesce(new.pin_hash, '') is distinct from coalesce(old.pin_hash, '')
    and coalesce(new.pin_hash, '') in (deleted_sentinel, '__deleted__', 'DELETED');

  is_deactivate :=
    coalesce(old.active, false) = true
    and coalesce(new.active, false) = false;

  if not is_soft_delete and not is_deactivate then
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
  before update of pin_hash, active on staff
  for each row
  execute function prevent_last_admin_staff_delete();
