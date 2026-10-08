-- CORTES AI credit system: authoritative backend balance and atomic reservations.
create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid null,
  amount integer not null,
  kind text not null,
  created_at timestamptz not null default now()
);

alter table public.credit_ledger enable row level security;
drop policy if exists "Users can view own credit ledger" on public.credit_ledger;
create policy "Users can view own credit ledger" on public.credit_ledger
  for select using (auth.uid() = user_id);

create index if not exists credit_ledger_user_created_idx
  on public.credit_ledger(user_id, created_at desc);

create or replace function public.reserve_processing_credits(target uuid, amount integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
  unlimited boolean;
begin
  if auth.uid() is null or auth.uid() <> target then
    return false;
  end if;

  if amount <= 0 then
    return false;
  end if;

  select coalesce(credit_balance, 0), coalesce(unlimited_credits, false)
    into current_balance, unlimited
  from public.profiles
  where id = target
  for update;

  if not found then
    return false;
  end if;

  if unlimited then
    insert into public.credit_ledger(user_id, amount, kind)
    values (target, 0, 'processing_unlimited');
    return true;
  end if;

  if current_balance < amount then
    return false;
  end if;

  update public.profiles
    set credit_balance = current_balance - amount
    where id = target;

  insert into public.credit_ledger(user_id, amount, kind)
    values (target, -amount, 'processing');

  return true;
end;
$$;

revoke all on function public.reserve_processing_credits(uuid, integer) from public;
grant execute on function public.reserve_processing_credits(uuid, integer) to authenticated;


create or replace function public.refund_credits(target uuid, amount integer, reason text default 'refund')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if amount <= 0 then return false; end if;
  if auth.uid() is not null and auth.uid() <> target then return false; end if;

  update public.profiles
    set credit_balance = coalesce(credit_balance, 0) + amount
    where id = target
      and coalesce(unlimited_credits, false) = false;

  if not found then
    return false;
  end if;

  insert into public.credit_ledger(user_id, actor_id, amount, kind)
  values (target, nullif(auth.uid()::text, '')::uuid, amount, reason);

  return true;
end;
$$;

create or replace function public.reserve_export_credits(target uuid, amount integer default 1)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
  unlimited boolean;
begin
  if auth.uid() is null or auth.uid() <> target or amount <= 0 then return false; end if;

  select coalesce(credit_balance, 0), coalesce(unlimited_credits, false)
    into current_balance, unlimited
  from public.profiles
  where id = target
  for update;

  if not found then return false; end if;

  if unlimited then
    insert into public.credit_ledger(user_id, amount, kind)
    values (target, 0, 'export_unlimited');
    return true;
  end if;

  if current_balance < amount then return false; end if;

  update public.profiles
    set credit_balance = current_balance - amount
    where id = target;

  insert into public.credit_ledger(user_id, amount, kind)
  values (target, -amount, 'export');

  return true;
end;
$$;

revoke all on function public.refund_credits(uuid, integer, text) from public;
grant execute on function public.refund_credits(uuid, integer, text) to authenticated, service_role;

revoke all on function public.reserve_export_credits(uuid, integer) from public;
grant execute on function public.reserve_export_credits(uuid, integer) to authenticated;
