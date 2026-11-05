# 還原說明 — 球友季繳報名系統資料

本目錄是 Supabase 雲端資料的備份（透過 anon key + REST API dump）。

## 檔案

| 檔案 | 內容 |
|---|---|
| `seasons.json` / `session_groups.json` / `sessions.json` / `registrations.json` | 各表原始資料（JSON，含 UUID 與 created_at） |
| `seed.sql` | 由上述 JSON 產生的重灌 SQL（INSERT，已依外鍵排序、`on conflict (id) do nothing`） |
| `RESTORE.md` | 本說明 |

> ⚠️ **沒有 `admin_config`（後台密碼）**：該表 RLS 設定 anon 讀不到，無法匯出。還原後請自行設一組新密碼（見下方步驟 3）。

## 還原到任一 Postgres / Supabase 專案

1. **建表 + RLS + RPC**：先執行專案根目錄的 `docs/supabase-schema.sql`。
   > 注意：此檔開頭會 `DROP` 既有的 seasons / session_groups / sessions / registrations，是乾淨重建。

2. **灌入資料**：執行本目錄的 `seed.sql`。

3. **設定後台密碼**（把 `YOUR_PASSWORD` 換成你要的密碼）：
   ```sql
   insert into admin_config (id, password_hash)
   values (1, encode(digest('YOUR_PASSWORD', 'sha256'), 'hex'))
   on conflict (id) do update set password_hash = excluded.password_hash;
   ```

## 重新 dump 一份最新的（雲端還活著時）

```bash
npm run backup
```

這會：建一個新的 `backup/<timestamp>/`、更新 `backup/latest`、重產 `seed.sql`，
並同步更新前端 fallback 快照 `src/data/snapshot.json`（記得 commit + 重新部署才會生效）。
