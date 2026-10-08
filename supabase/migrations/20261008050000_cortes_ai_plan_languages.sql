-- CORTES AI: language entitlement for paid plans
-- Pro includes access to dubbing/translation in 350 languages.
-- This is an entitlement flag/count; the actual language provider must be connected server-side.

alter table public.billing_plans
  add column if not exists supported_languages integer not null default 0;

update public.billing_plans
set supported_languages = case
  when id = 'pro' then 350
  when id = 'studio' then 350
  else 0
end;

comment on column public.billing_plans.supported_languages is
  'Number of languages included in the plan for translation/dubbing features. Pro and Studio include 350.';
