create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.device_tokens to authenticated;
grant all on public.device_tokens to service_role;

alter table public.device_tokens enable row level security;

create policy "Users manage own device tokens"
on public.device_tokens
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists device_tokens_user_idx
  on public.device_tokens (user_id);