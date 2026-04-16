-- Run this in the Supabase SQL editor to create all required tables.

create table if not exists public.recipes (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  name         text not null,
  source_url   text,
  servings     integer not null default 2,
  notes        text,
  ingredients  jsonb not null default '[]',
  method       jsonb not null default '[]',
  image_url    text,
  tags         text[] not null default '{}'
);

create table if not exists public.meal_plans (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  week_start     date not null,
  day_of_week    text not null check (day_of_week in ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  recipe_id      uuid not null references public.recipes(id) on delete cascade,
  num_people     integer not null default 2,
  is_double_batch boolean not null default false,
  unique (week_start, day_of_week)
);

create table if not exists public.shopping_lists (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  week_start              date not null unique,
  items                   jsonb not null default '[]',
  meal_plan_ids           uuid[] not null default '{}',
  pushed_to_reminders_at  timestamptz
);
