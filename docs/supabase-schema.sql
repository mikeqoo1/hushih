-- ============================================================
-- 快樂籃球 — 球友季繳報名系統 Supabase Schema (v2 / session groups)
-- 在 Supabase SQL Editor 一次貼上執行
--
-- ⚠️ 警告：本檔開頭會 DROP 既有的 seasons / session_groups / sessions
--          / registrations，重貼會洗掉所有報名資料！
--          (admin_config 保留，密碼不會被清掉)
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- 0. 砍掉舊版（MVP per-session 模型）
-- ============================================================
drop table if exists registrations  cascade;
drop table if exists sessions       cascade;
drop table if exists session_groups cascade;
drop table if exists seasons        cascade;

-- ============================================================
-- 1. 表格 DDL
-- ============================================================

-- 1.1 seasons — 季繳期間（移除 fee_amount，金額放在 session_groups）
create table seasons (
  id          uuid primary key default gen_random_uuid(),
  year        int  not null,
  quarter     int  not null check (quarter between 1 and 4),
  start_month int  not null check (start_month between 1 and 12),
  end_month   int  not null check (end_month between 1 and 12),
  is_active   bool not null default false,
  created_at  timestamptz not null default now(),
  unique (year, quarter),
  check (start_month <= end_month)  -- 不支援跨年季，避免 generate_series 靜默產生 0 場次
);

-- 1.2 session_groups — 場次系列（每週固定的一組場次）
-- day_of_week 採 ISO 8601: 1=Mon, 2=Tue, ..., 7=Sun
create table session_groups (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references seasons(id) on delete cascade,
  day_of_week int  not null check (day_of_week between 1 and 7),
  venue       text not null,
  time_slot   text not null,
  fee_amount  int  not null default 0,
  max_players int  not null default 20,
  notes       text,
  created_at  timestamptz not null default now()
);
create index session_groups_season_idx on session_groups(season_id);

-- 1.3 sessions — 展開出的具體日期（一個 group 對應 N 個 sessions）
create table sessions (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references session_groups(id) on delete cascade,
  play_date  date not null,
  created_at timestamptz not null default now(),
  unique (group_id, play_date)
);
create index sessions_group_idx     on sessions(group_id);
create index sessions_play_date_idx on sessions(play_date);

-- 1.4 registrations — 球友對「系列」報名（一個系列一筆）
create table registrations (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references session_groups(id) on delete cascade,
  player_name text not null,
  paid        bool not null default false,
  created_at  timestamptz not null default now(),
  unique (group_id, player_name)
);
create index registrations_group_idx  on registrations(group_id);
create index registrations_player_idx on registrations(player_name);

-- 1.5 admin_config — 保留（不在這次重建範圍內，僅補建若不存在）
create table if not exists admin_config (
  id            int primary key default 1 check (id = 1),
  password_hash text not null,
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 2. Row Level Security (RLS)
-- ============================================================
alter table seasons        enable row level security;
alter table session_groups enable row level security;
alter table sessions       enable row level security;
alter table registrations  enable row level security;
alter table admin_config   enable row level security;

-- 先 drop 既有 policy（讓重貼 schema 可重複執行；admin_config 不被 DROP，policy 會留下來）
drop policy if exists "anon read seasons"  on seasons;
drop policy if exists "anon read groups"   on session_groups;
drop policy if exists "anon read sessions" on sessions;
drop policy if exists "anon read regs"     on registrations;
drop policy if exists "no read admin"      on admin_config;
drop policy if exists "anon insert reg"    on registrations;
drop policy if exists "anon delete own"    on registrations;

-- anon 可讀（前端報名/查詢用）
create policy "anon read seasons"  on seasons        for select to anon using (true);
create policy "anon read groups"   on session_groups for select to anon using (true);
create policy "anon read sessions" on sessions       for select to anon using (true);
create policy "anon read regs"     on registrations  for select to anon using (true);

-- admin_config 不開放讀；只透過 RPC 驗證
create policy "no read admin"      on admin_config   for select to anon using (false);

-- anon 對 registrations 可 insert / delete（球友報名與取消）
create policy "anon insert reg"  on registrations for insert to anon with check (true);
create policy "anon delete own"  on registrations for delete to anon using (true);

-- seasons / groups / sessions / admin_config 寫入只透過 RPC（security definer）
revoke insert, update, delete on seasons        from anon;
revoke insert, update, delete on session_groups from anon;
revoke insert, update, delete on sessions       from anon;
revoke insert, update, delete on admin_config   from anon;

-- ============================================================
-- 3. RPC
-- ============================================================

-- 3.1 verify_admin_password — 只回 boolean
create or replace function verify_admin_password(p_password text)
returns boolean
language plpgsql security definer as $$
declare stored text;
begin
  select password_hash into stored from admin_config where id = 1;
  return stored is not null
     and stored = encode(digest(p_password, 'sha256'), 'hex');
end;
$$;
revoke all on function verify_admin_password(text) from public;
grant execute on function verify_admin_password(text) to anon;

-- 3.2 admin_upsert_season — 不含 fee_amount
-- p_id = null 新增；非 null 更新指定 id
create or replace function admin_upsert_season(
  p_password    text,
  p_id          uuid,
  p_year        int,
  p_quarter     int,
  p_start_month int,
  p_end_month   int,
  p_is_active   bool
) returns uuid
language plpgsql security definer as $$
declare new_id uuid;
begin
  if not verify_admin_password(p_password) then
    raise exception 'unauthorized';
  end if;

  -- 設為 active 時關掉其他季（保留自己）
  if p_is_active then
    update seasons set is_active = false
     where is_active = true
       and (p_id is null or id <> p_id);
  end if;

  if p_id is null then
    insert into seasons (year, quarter, start_month, end_month, is_active)
    values (p_year, p_quarter, p_start_month, p_end_month, p_is_active)
    returning id into new_id;
  else
    update seasons set
      year        = p_year,
      quarter     = p_quarter,
      start_month = p_start_month,
      end_month   = p_end_month,
      is_active   = p_is_active
    where id = p_id
    returning id into new_id;
  end if;

  return new_id;
end;
$$;
grant execute on function admin_upsert_season(text, uuid, int, int, int, int, bool) to anon;

-- 3.3 admin_delete_season
create or replace function admin_delete_season(
  p_password  text,
  p_season_id uuid
) returns void
language plpgsql security definer as $$
begin
  if not verify_admin_password(p_password) then
    raise exception 'unauthorized';
  end if;
  delete from seasons where id = p_season_id;
end;
$$;
grant execute on function admin_delete_season(text, uuid) to anon;

-- 3.4 admin_upsert_group
-- 新增時依該季的起訖月，把符合 day_of_week 的日期一次展開到 sessions
-- 編輯時不改 season_id / day_of_week，只改 venue/time_slot/fee/max/notes
create or replace function admin_upsert_group(
  p_password    text,
  p_id          uuid,
  p_season_id   uuid,
  p_day_of_week int,
  p_venue       text,
  p_time_slot   text,
  p_fee_amount  int,
  p_max_players int,
  p_notes       text
) returns uuid
language plpgsql security definer as $$
declare
  new_id  uuid;
  s_year  int;
  s_start int;
  s_end   int;
begin
  if not verify_admin_password(p_password) then
    raise exception 'unauthorized';
  end if;

  if p_id is null then
    -- 新增 group
    insert into session_groups (season_id, day_of_week, venue, time_slot, fee_amount, max_players, notes)
    values (p_season_id, p_day_of_week, p_venue, p_time_slot, p_fee_amount, p_max_players, p_notes)
    returning id into new_id;

    -- 展開出 sessions
    select year, start_month, end_month
      into s_year, s_start, s_end
      from seasons where id = p_season_id;

    insert into sessions (group_id, play_date)
    select new_id, d::date
    from generate_series(
      make_date(s_year, s_start, 1),
      (make_date(s_year, s_end, 1) + interval '1 month' - interval '1 day')::date,
      '1 day'::interval
    ) as d
    where extract(isodow from d) = p_day_of_week
    on conflict (group_id, play_date) do nothing;
  else
    -- 編輯：只更新軟欄位
    update session_groups set
      venue       = p_venue,
      time_slot   = p_time_slot,
      fee_amount  = p_fee_amount,
      max_players = p_max_players,
      notes       = p_notes
    where id = p_id
    returning id into new_id;
  end if;

  return new_id;
end;
$$;
grant execute on function admin_upsert_group(text, uuid, uuid, int, text, text, int, int, text) to anon;

-- 3.5 admin_delete_group — cascade 刪 sessions + registrations
create or replace function admin_delete_group(
  p_password text,
  p_group_id uuid
) returns void
language plpgsql security definer as $$
begin
  if not verify_admin_password(p_password) then
    raise exception 'unauthorized';
  end if;
  delete from session_groups where id = p_group_id;
end;
$$;
grant execute on function admin_delete_group(text, uuid) to anon;

-- 3.6 admin_delete_session — 刪單一日期（國定假日/雨天取消）
create or replace function admin_delete_session(
  p_password   text,
  p_session_id uuid
) returns void
language plpgsql security definer as $$
begin
  if not verify_admin_password(p_password) then
    raise exception 'unauthorized';
  end if;
  delete from sessions where id = p_session_id;
end;
$$;
grant execute on function admin_delete_session(text, uuid) to anon;

-- 3.7 admin_set_paid — 標記繳費
create or replace function admin_set_paid(
  p_password text,
  p_reg_id   uuid,
  p_paid     bool
) returns void
language plpgsql security definer as $$
begin
  if not verify_admin_password(p_password) then
    raise exception 'unauthorized';
  end if;
  update registrations set paid = p_paid where id = p_reg_id;
end;
$$;
grant execute on function admin_set_paid(text, uuid, bool) to anon;

-- 3.8 admin_change_password
create or replace function admin_change_password(
  p_password     text,
  p_new_password text
) returns void
language plpgsql security definer as $$
begin
  if not verify_admin_password(p_password) then
    raise exception 'unauthorized';
  end if;
  update admin_config
  set password_hash = encode(digest(p_new_password, 'sha256'), 'hex'),
      updated_at    = now()
  where id = 1;
end;
$$;
grant execute on function admin_change_password(text, text) to anon;

-- ============================================================
-- 4. 初始管理員密碼（請自行執行一次）
-- ============================================================
-- 把 'CHANGE_ME_BEFORE_RUNNING' 換成你的密碼後執行；若 admin_config 已有資料則跳過
--
-- insert into admin_config (id, password_hash)
-- values (1, encode(digest('CHANGE_ME_BEFORE_RUNNING', 'sha256'), 'hex'))
-- on conflict (id) do nothing;
