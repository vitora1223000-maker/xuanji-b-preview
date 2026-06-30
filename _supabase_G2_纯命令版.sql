alter table profiles add column if not exists balance    integer not null default 0;
alter table profiles add column if not exists last_visit date;
alter table profiles add column if not exists streak     integer not null default 0;

create table if not exists merit_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  action     text not null,
  amount     integer not null,
  dedup_key  text,
  created_at timestamptz not null default now()
);

create unique index if not exists merit_log_dedup
  on merit_log(user_id, dedup_key) where dedup_key is not null;
create index if not exists merit_log_user on merit_log(user_id, created_at desc);

alter table merit_log enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='merit_log' and policyname='own_merit_read') then
    create policy "own_merit_read" on merit_log for select using (auth.uid() = user_id);
  end if;
end $$;

create or replace function daily_visit()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p   record;
  new_streak integer;
  base  integer := 5;
  bonus integer;
  total integer;
  today date := current_date;
begin
  if uid is null then return jsonb_build_object('earned',0,'streak',0,'already',false); end if;

  select last_visit, streak into p from profiles where id = uid for update;

  if p.last_visit = today then
    return jsonb_build_object('earned',0,'streak',p.streak,'already',true);
  end if;

  if p.last_visit = today - 1 then
    new_streak := coalesce(p.streak,0) + 1;
  else
    new_streak := 1;
  end if;

  bonus := least((new_streak - 1) * 2, 10);
  total := base + bonus;

  update profiles
    set last_visit = today,
        streak     = new_streak,
        merit      = merit + total,
        balance    = balance + total
    where id = uid;

  insert into merit_log(user_id, action, amount, dedup_key)
    values (uid, 'daily', total, 'daily:' || today::text);

  return jsonb_build_object('earned', total, 'streak', new_streak, 'already', false);
end;
$$;
