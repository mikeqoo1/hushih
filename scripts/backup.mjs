#!/usr/bin/env node
// ============================================================
// 一鍵備份 Supabase 雲端資料。產出兩種用途的檔案：
//
//   (A) 伺服器還原用  backup/<stamp>/
//         ├─ seasons.json / session_groups.json / sessions.json / registrations.json
//         ├─ seed.sql      （重灌 SQL，已依外鍵排序）
//         └─ RESTORE.md     （還原步驟）
//       並把 backup/latest 軟連結指向這次的 <stamp>。
//
//   (B) 前端 fallback 用  src/data/snapshot.json
//       這份會「打包進網站」。萬一雲端被清空或連不上，公開頁面
//       （報名頁 / 名單頁）會自動改用這份快照「唯讀」顯示最新資料，
//       不會變成一片空白或錯誤。見 src/lib/publicData.js。
//
// 讀取 .env.local 的 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY。
// 需 Node 18+（用內建 fetch）。
//
// 用法：
//   npm run backup
//   node scripts/backup.mjs
// ============================================================

import { readFileSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TABLES, buildSeedSql } from './json-to-seed.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv(file) {
  const env = {}
  let raw
  try {
    raw = readFileSync(join(ROOT, file), 'utf8')
  } catch {
    return env
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

function stampNow() {
  // YYYYMMDD-HHMMSS（本地時間），與既有 backup 目錄命名一致
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  )
}

async function dumpTable(url, key, table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) {
    throw new Error(`dump ${table} 失敗：HTTP ${res.status} ${await res.text()}`)
  }
  const rows = await res.json()
  if (!Array.isArray(rows)) {
    throw new Error(`dump ${table} 失敗：回傳不是陣列 — ${JSON.stringify(rows).slice(0, 200)}`)
  }
  return rows
}

const RESTORE_MD = `# 還原說明 — 球友季繳報名系統資料

本目錄是 Supabase 雲端資料的備份（透過 anon key + REST API dump）。

## 檔案

| 檔案 | 內容 |
|---|---|
| \`seasons.json\` / \`session_groups.json\` / \`sessions.json\` / \`registrations.json\` | 各表原始資料（JSON，含 UUID 與 created_at） |
| \`seed.sql\` | 由上述 JSON 產生的重灌 SQL（INSERT，已依外鍵排序、\`on conflict (id) do nothing\`） |
| \`RESTORE.md\` | 本說明 |

> ⚠️ **沒有 \`admin_config\`（後台密碼）**：該表 RLS 設定 anon 讀不到，無法匯出。還原後請自行設一組新密碼（見下方步驟 3）。

## 還原到任一 Postgres / Supabase 專案

1. **建表 + RLS + RPC**：先執行專案根目錄的 \`docs/supabase-schema.sql\`。
   > 注意：此檔開頭會 \`DROP\` 既有的 seasons / session_groups / sessions / registrations，是乾淨重建。

2. **灌入資料**：執行本目錄的 \`seed.sql\`。

3. **設定後台密碼**（把 \`YOUR_PASSWORD\` 換成你要的密碼）：
   \`\`\`sql
   insert into admin_config (id, password_hash)
   values (1, encode(digest('YOUR_PASSWORD', 'sha256'), 'hex'))
   on conflict (id) do update set password_hash = excluded.password_hash;
   \`\`\`

## 重新 dump 一份最新的（雲端還活著時）

\`\`\`bash
npm run backup
\`\`\`

這會：建一個新的 \`backup/<timestamp>/\`、更新 \`backup/latest\`、重產 \`seed.sql\`，
並同步更新前端 fallback 快照 \`src/data/snapshot.json\`（記得 commit + 重新部署才會生效）。
`

async function main() {
  const env = { ...loadEnv('.env.local'), ...process.env }
  const url = (env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
  const key = env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('找不到 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY（請確認 .env.local）')
    process.exit(1)
  }

  console.log(`從 ${url} 抓取資料…`)
  const rowsByTable = {}
  for (const { name } of TABLES) {
    rowsByTable[name] = await dumpTable(url, key, name)
    console.log(`  ${name}: ${rowsByTable[name].length} 筆`)
  }

  const stamp = stampNow()
  const dir = join(ROOT, 'backup', stamp)
  mkdirSync(dir, { recursive: true })

  // (A) 伺服器還原用：每表 JSON + seed.sql + RESTORE.md
  for (const { name } of TABLES) {
    writeFileSync(join(dir, `${name}.json`), JSON.stringify(rowsByTable[name], null, 2) + '\n')
  }
  const { sql, count } = buildSeedSql(rowsByTable, `backup/${stamp}`)
  writeFileSync(join(dir, 'seed.sql'), sql)
  writeFileSync(join(dir, 'RESTORE.md'), RESTORE_MD)

  // backup/latest → <stamp>
  const latest = join(ROOT, 'backup', 'latest')
  rmSync(latest, { force: true, recursive: true })
  symlinkSync(stamp, latest)

  // (B) 前端 fallback 快照（會打包進網站）
  const snapshot = {
    meta: {
      generatedAt: new Date().toISOString(),
      stamp,
      source: url,
      counts: Object.fromEntries(TABLES.map((t) => [t.name, rowsByTable[t.name].length])),
      note:
        '前端 fallback 快照。雲端讀取失敗或資料被清空時，公開頁面（報名頁／名單頁）改用此資料唯讀顯示。' +
        '由 scripts/backup.mjs 產生，需 commit 並重新部署才會生效。',
    },
    tables: {
      seasons: rowsByTable.seasons,
      session_groups: rowsByTable.session_groups,
      sessions: rowsByTable.sessions,
      registrations: rowsByTable.registrations,
    },
  }
  const dataDir = join(ROOT, 'src', 'data')
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(join(dataDir, 'snapshot.json'), JSON.stringify(snapshot, null, 2) + '\n')

  console.log('')
  console.log(`✅ 伺服器還原檔：backup/${stamp}/（seed.sql 共 ${count} 筆）+ backup/latest`)
  console.log(`✅ 前端快照：src/data/snapshot.json（${snapshot.meta.generatedAt}）`)
  console.log('')
  console.log('下一步：git add + commit，重新部署網站，fallback 才會帶到最新資料。')
}

main().catch((err) => {
  console.error('備份失敗：', err.message || err)
  process.exit(1)
})
