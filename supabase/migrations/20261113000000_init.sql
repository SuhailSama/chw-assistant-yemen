-- CHW Assistant schema: visits + referrals with row-level security.
-- Roles live in the user's JWT (app_metadata.role), which only the
-- admin-users edge function can write.

create schema if not exists app;
grant usage on schema app to authenticated;

-- Role of the caller, or null while a temporary password is still pending.
create or replace function app.role()
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when coalesce((auth.jwt() -> 'app_metadata' ->> 'must_change_password')::boolean, false) then null
    else auth.jwt() -> 'app_metadata' ->> 'role'
  end
$$;

-- Ownership fields are stamped server-side so a client cannot spoof them.
create or replace function app.stamp_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.chw_id := auth.uid();
  new.chw_username := coalesce(auth.jwt() -> 'app_metadata' ->> 'username', '');
  new.created_at := now();
  return new;
end
$$;

grant execute on function app.role(), app.stamp_owner() to authenticated;

create table public.visits (
  id           uuid primary key,
  chw_id       uuid not null references auth.users (id),
  chw_username text not null,
  data         jsonb not null check (pg_column_size(data) < 16384),
  created_at   timestamptz not null default now()
);

create table public.referrals (
  id           uuid primary key,
  chw_id       uuid not null references auth.users (id),
  chw_username text not null,
  data         jsonb not null check (pg_column_size(data) < 16384),
  created_at   timestamptz not null default now()
);

create index visits_chw_created_idx    on public.visits    (chw_id, created_at desc);
create index referrals_chw_created_idx on public.referrals (chw_id, created_at desc);

create trigger visits_stamp_owner    before insert on public.visits
  for each row execute function app.stamp_owner();
create trigger referrals_stamp_owner before insert on public.referrals
  for each row execute function app.stamp_owner();

alter table public.visits    enable row level security;
alter table public.referrals enable row level security;

revoke all on public.visits, public.referrals from anon, authenticated;
grant select, insert on public.visits, public.referrals to authenticated;

-- Records are append-only: no update or delete policies exist.
create policy visits_insert on public.visits for insert to authenticated
  with check ((select app.role()) in ('CHW', 'Supervisor', 'Admin'));
create policy visits_select on public.visits for select to authenticated
  using (
    (select app.role()) in ('Supervisor', 'Admin')
    or ((select app.role()) = 'CHW' and chw_id = (select auth.uid()))
  );

create policy referrals_insert on public.referrals for insert to authenticated
  with check ((select app.role()) in ('CHW', 'Supervisor', 'Admin'));
create policy referrals_select on public.referrals for select to authenticated
  using (
    (select app.role()) in ('Supervisor', 'Admin')
    or ((select app.role()) = 'CHW' and chw_id = (select auth.uid()))
  );

-- Touches the database so the scheduled keep-alive counts as activity.
create or replace function public.ping()
returns boolean
language sql
stable
set search_path = ''
as $$ select true $$;
revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
