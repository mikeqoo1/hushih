#!/usr/bin/env node
// 把 backup/<stamp>/*.json（Supabase REST dump）轉成可重灌的 seed.sql
//
// 用法：
//   node scripts/json-to-seed.mjs backup/latest
//   node scripts/json-to-seed.mjs backup/20260615-091401
//
// 產出：<dir>/seed.sql
// 重灌順序已依外鍵排好：seasons → session_groups → sessions → registrations。
// 不含 admin_config（anon 讀不到，請於還原後另設密碼，見 backup README）。

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// 表名 → 欄位（順序即 INSERT 欄位順序；同時定義 FK 灌入順序）
const TABLES = [
  { name: 'seasons',        cols: ['id', 'year', 'quarter', 'start_month', 'end_month', 'is_active', 'created_at'] },
  { name: 'session_groups', cols: ['id', 'season_id', 'day_of_week', 'venue', 'time_slot', 'fee_amount', 'max_players', 'notes', 'created_at'] },
  { name: 'sessions',       cols: ['id', 'group_id', 'play_date', 'created_at'] },
  { name: 'registrations',  cols: ['id', 'group_id', 'player_name', 'paid', 'created_at'] },
]

const dir = process.argv[2]
if (!dir) {
  console.error('用法: node scripts/json-to-seed.mjs <備份目錄，如 backup/latest>')
  process.exit(1)
}

function sqlValue(v) {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return String(v)
  // 其餘一律當字串（含 uuid / date / timestamptz）：單引號 escape
  return `'${String(v).replace(/'/g, "''")}'`
}

let out = `-- ============================================================
-- seed.sql — 由 ${dir} 的 JSON dump 產生
-- 還原步驟：
--   1. 先跑 docs/supabase-schema.sql 建表 + RLS + RPC（注意它會 DROP 舊資料）
--   2. 再跑本檔灌入資料
--   3. 另設後台密碼（見 backup 目錄 RESTORE 說明）
-- ============================================================

begin;

`

let grand = 0
for (const { name, cols } of TABLES) {
  const rows = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'))
  out += `-- ${name} (${rows.length} 筆)\n`
  if (rows.length === 0) {
    out += `-- (無資料)\n\n`
    continue
  }
  out += `insert into ${name} (${cols.join(', ')}) values\n`
  out += rows
    .map((r) => '  (' + cols.map((c) => sqlValue(r[c])).join(', ') + ')')
    .join(',\n')
  out += `\non conflict (id) do nothing;\n\n`
  grand += rows.length
}

out += `commit;\n\n-- 共 ${grand} 筆\n`

const target = join(dir, 'seed.sql')
writeFileSync(target, out)
console.log(`已寫出 ${target}（共 ${grand} 筆）`)
