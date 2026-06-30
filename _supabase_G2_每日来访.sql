-- ============================================================
-- 玄玑 · G2 每日来访埋点（数据地基·为融资算留存/连击用）
-- 在 Supabase SQL Editor 粘贴整段，点 Run 跑一次即可。
-- 只建「每日来访」需要的东西，不建 G3 功德花/卡片/道身（那些以后做）。
-- 幂等：可重复跑（if not exists / or replace），不会报错、不会重复建。
-- 前提：v1 建表已跑过（profiles 表 + merit 字段已存在）。
-- ============================================================

-- ① profiles 加来访相关字段 ----------------------------------
--   merit 已在 v1 存在(荣誉总账)；balance=可花余额(连击送的功德也进这里，以后花功德用)；
--   last_visit=最近来访日期；streak=连续来访天数。
alter table profiles add column if not exists balance    integer not null default 0;  -- 可消耗功德余额
alter table profiles add column if not exists last_visit date;                        -- 最近来访日期
alter table profiles add column if not exists streak     integer not null default 0;  -- 连续来访天数

-- ② 来访/功德流水表（每天一条来访记录，且防重复领） ----------
create table if not exists merit_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  action     text not null,         -- 行为码：这一步只用 'daily'
  amount     integer not null,      -- 本次发的功德
  dedup_key  text,                  -- 防重复键：'daily:2026-06-30'，同键只允许一条
  created_at timestamptz not null default now()
);
-- 防重复领核心：同一用户 + 同一 dedup_key 只能有一条（一天的 daily 只发一次）
create unique index if not exists merit_log_dedup
  on merit_log(user_id, dedup_key) where dedup_key is not null;
create index if not exists merit_log_user on merit_log(user_id, created_at desc);

-- RLS：本人只读自己的流水；写流水统一走下面的函数(security definer)，防前端伪造
alter table merit_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='merit_log' and policyname='本人读自己流水') then
    create policy "本人读自己流水" on merit_log for select using (auth.uid() = user_id);
  end if;
end $$;

-- ③ G2 核心函数：每日来访签到（每天一次，自动算连击 + 发功德） ----
--   逻辑：今天没签过 → 发每日功德 + 连击加成；连击断了归零重来。
--   返回 jsonb：{earned, streak, already}（already=true 表示今天已签）
--   前端现在只管调它埋点、忽略返回值；以后要给用户看就接这个返回。
create or replace function daily_visit()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p   record;
  new_streak integer;
  base  integer := 5;       -- 每日来访基准功德
  bonus integer;            -- 连击加成
  total integer;
  today date := current_date;
begin
  if uid is null then return jsonb_build_object('earned',0,'streak',0,'already',false); end if;

  select last_visit, streak into p from profiles where id = uid for update;

  -- 今天已签到过 → 不重复发
  if p.last_visit = today then
    return jsonb_build_object('earned',0,'streak',p.streak,'already',true);
  end if;

  -- 算连击：昨天来过=连击+1；否则归零重来(从1开始)
  if p.last_visit = today - 1 then
    new_streak := coalesce(p.streak,0) + 1;
  else
    new_streak := 1;
  end if;

  -- 连击加成：第2天起每天+2，封顶+10（streak=1时bonus=0）
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

-- ============================================================
-- 完成。前端调用(已接好)：await sb.rpc('daily_visit')
-- 验证数据有没有进来(在 SQL Editor 里跑)：
--   select id, last_visit, streak, merit, balance from profiles order by last_visit desc nulls last;
--   select * from merit_log order by created_at desc limit 20;
-- ============================================================
