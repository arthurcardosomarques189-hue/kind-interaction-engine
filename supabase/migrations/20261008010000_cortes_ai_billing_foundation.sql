-- CORTES AI billing foundation + idempotent credit refunds
-- Provider-neutral: connect Mercado Pago (or another gateway) through server-side secrets/webhooks.

create table if not exists public.billing_plans (
  id text primary key,
  name text not null,
  price_brl numeric(10,2) not null default 0,
  billing_interval text not null default 'month' check (billing_interval in ('month','year','one_time')),
  credits integer not null default 0,
  active boolean not null default true,
  provider_plan_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.billing_plans(id,name,price_brl,billing_interval,credits)
values
 ('free','Free',0,'month',20),
 ('creator','Creator',29.90,'month',300),
 ('pro','Pro',59.90,'month',800),
 ('studio','Studio',149.90,'month',2500)
on conflict (id) do update set
  name=excluded.name, price_brl=excluded.price_brl,
  billing_interval=excluded.billing_interval, credits=excluded.credits;

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null references public.billing_plans(id),
  provider text not null default 'mercado_pago',
  provider_subscription_id text,
  status text not null default 'pending' check (status in ('pending','authorized','active','paused','cancelled','expired','past_due')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_subscription_id)
);

create index if not exists billing_subscriptions_user_idx
  on public.billing_subscriptions(user_id, created_at desc);

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text references public.billing_plans(id),
  subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  provider text not null default 'mercado_pago',
  provider_payment_id text,
  status text not null default 'pending' check (status in ('pending','approved','authorized','rejected','cancelled','refunded','partially_refunded','charged_back')),
  amount_brl numeric(10,2) not null default 0,
  credits_granted integer not null default 0,
  raw_status text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_payment_id)
);

create index if not exists billing_payments_user_idx
  on public.billing_payments(user_id, created_at desc);

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, event_id)
);

alter table public.billing_plans enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_webhook_events enable row level security;

drop policy if exists "Anyone can view active billing plans" on public.billing_plans;
create policy "Anyone can view active billing plans" on public.billing_plans
  for select using (active = true);

drop policy if exists "Users can view own billing subscriptions" on public.billing_subscriptions;
create policy "Users can view own billing subscriptions" on public.billing_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "Users can view own billing payments" on public.billing_payments;
create policy "Users can view own billing payments" on public.billing_payments
  for select using (auth.uid() = user_id);

revoke all on public.billing_webhook_events from public, anon, authenticated;
revoke insert, update, delete on public.billing_plans from public, anon, authenticated;
revoke insert, update, delete on public.billing_subscriptions from public, anon, authenticated;
revoke insert, update, delete on public.billing_payments from public, anon, authenticated;
grant select on public.billing_plans to anon, authenticated;
grant select on public.billing_subscriptions to authenticated;
grant select on public.billing_payments to authenticated;

-- Idempotency key for every credit mutation tied to a business event.
alter table public.credit_ledger add column if not exists reference_id text;
create unique index if not exists credit_ledger_reference_uidx
  on public.credit_ledger(reference_id)
  where reference_id is not null;

-- Users must never be able to call the generic refund primitive.
revoke all on function public.refund_credits(uuid, integer, text) from public, authenticated;
grant execute on function public.refund_credits(uuid, integer, text) to service_role;

create or replace function public.refund_processing_for_project(
  target uuid,
  project_id uuid,
  amount integer,
  reason text default 'processing_refund'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reference text := 'processing:' || project_id::text;
begin
  if auth.uid() is null or auth.uid() <> target or amount <= 0 then return false; end if;
  if not exists (select 1 from public.projects where id = project_id and user_id = target) then return false; end if;
  if exists (select 1 from public.credit_ledger where reference_id = reference) then return true; end if;

  update public.profiles
    set credit_balance = coalesce(credit_balance, 0) + amount
    where id = target and coalesce(unlimited_credits, false) = false;

  if not found then return false; end if;

  insert into public.credit_ledger(user_id, amount, kind, reference_id)
  values (target, amount, reason, reference);
  return true;
end;
$$;

create or replace function public.refund_export_for_export(
  target uuid,
  export_id uuid,
  amount integer default 1,
  reason text default 'export_refund'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reference text := 'export:' || export_id::text;
begin
  if auth.uid() is null or auth.uid() <> target or amount <= 0 then return false; end if;
  if not exists (select 1 from public.exports where id = export_id and user_id = target) then return false; end if;
  if exists (select 1 from public.credit_ledger where reference_id = reference) then return true; end if;

  update public.profiles
    set credit_balance = coalesce(credit_balance, 0) + amount
    where id = target and coalesce(unlimited_credits, false) = false;

  if not found then return false; end if;

  insert into public.credit_ledger(user_id, amount, kind, reference_id)
  values (target, amount, reason, reference);
  return true;
end;
$$;

revoke all on function public.refund_processing_for_project(uuid, uuid, integer, text) from public;
grant execute on function public.refund_processing_for_project(uuid, uuid, integer, text) to authenticated, service_role;
revoke all on function public.refund_export_for_export(uuid, uuid, integer, text) from public;
grant execute on function public.refund_export_for_export(uuid, uuid, integer, text) to authenticated, service_role;

-- Server-side webhook/payment code can grant purchased credits atomically.
create or replace function public.grant_plan_credits(target uuid, plan text, reference text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  amount integer;
begin
  if reference is null or length(trim(reference)) = 0 then return false; end if;
  if exists (select 1 from public.credit_ledger where reference_id = reference) then return true; end if;

  select credits into amount from public.billing_plans where id = plan and active = true;
  if amount is null or amount <= 0 then return false; end if;

  update public.profiles
    set credit_balance = coalesce(credit_balance, 0) + amount,
        plan = case plan when 'creator' then 'Creator' when 'pro' then 'Pro' when 'studio' then 'Studio' else public.profiles.plan end
    where id = target and coalesce(unlimited_credits, false) = false;

  if not found then return false; end if;

  insert into public.credit_ledger(user_id, actor_id, amount, kind, reference_id)
  values (target, null, amount, 'plan_purchase', reference);
  return true;
end;
$$;

revoke all on function public.grant_plan_credits(uuid, text, text) from public, anon, authenticated;
grant execute on function public.grant_plan_credits(uuid, text, text) to service_role;
