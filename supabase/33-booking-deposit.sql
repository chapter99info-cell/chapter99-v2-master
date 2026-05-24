-- Online booking deposits (Stripe prepayment)

alter table bookings
  add column if not exists deposit_amount numeric(10,2);

alter table bookings
  add column if not exists deposit_paid boolean default false;

alter table bookings
  add column if not exists deposit_paid_at timestamptz;

alter table bookings
  add column if not exists deposit_stripe_session_id text;

alter table bookings
  add column if not exists deposit_stripe_payment_intent text;

alter table bookings
  add column if not exists deposit_refunded boolean default false;

alter table bookings
  add column if not exists deposit_refunded_at timestamptz;

alter table shops
  add column if not exists deposit_enabled boolean default false;

alter table shops
  add column if not exists deposit_type text default 'percent';

alter table shops
  add column if not exists deposit_percent integer default 20;

alter table shops
  add column if not exists deposit_fixed_amount numeric(10,2) default 20.00;

alter table shops
  add column if not exists deposit_refund_hours integer default 24;

-- Add check constraint only if missing
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'shops_deposit_type_check'
  ) then
    alter table shops
      add constraint shops_deposit_type_check
      check (deposit_type in ('percent', 'fixed'));
  end if;
end $$;

comment on column shops.deposit_enabled is 'Require Stripe deposit for public online bookings';
comment on column bookings.deposit_amount is 'Deposit charged at booking (AUD)';

-- Skip Alerts notification until deposit is paid (pending_deposit = unpaid hold)
create or replace function notify_new_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_name text := 'Walk-in guest';
  v_service_name text := 'Service';
  v_therapist text;
  v_room text;
  v_payload jsonb;
begin
  if NEW.shop_id is null then
    return NEW;
  end if;

  if NEW.status = 'pending_deposit' then
    return NEW;
  end if;

  if NEW.client_id is not null then
    select coalesce(nullif(trim(c.name), ''), 'Walk-in guest')
    into v_client_name
    from clients c
    where c.id = NEW.client_id;
  end if;

  if NEW.service_id is not null then
    select coalesce(nullif(trim(s.name_en), ''), 'Service')
    into v_service_name
    from services s
    where s.id = NEW.service_id;
  end if;

  v_therapist := nullif(trim(coalesce(NEW.therapist_name, '')), '');
  if v_therapist is null and NEW.staff_id is not null then
    select nullif(trim(s.name_en), '')
    into v_therapist
    from staff s
    where s.id = NEW.staff_id;
  end if;

  if NEW.room_id is not null then
    select nullif(trim(r.name), '')
    into v_room
    from rooms r
    where r.id = NEW.room_id;
  end if;

  v_payload := jsonb_build_object(
    'type', 'booking',
    'clientName', v_client_name,
    'serviceName', v_service_name,
    'appointmentAt', NEW.start_time,
    'therapist', v_therapist,
    'room', v_room,
    'source', coalesce(NEW.source, 'online'),
    'bookedAt', coalesce(NEW.created_at, now())
  );

  insert into notifications (shop_id, booking_id, message, is_read)
  values (NEW.shop_id, NEW.id, v_payload::text, false);

  return NEW;
end;
$$;
