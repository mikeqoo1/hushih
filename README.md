# 快樂籃球 — 球友季繳報名系統

我想做一個 github pages 可以讓球友上來登記報名季繳

然後可以有一個簡單的後台管理畫面 讓我設定季繳的月份 打球的日期 跟季繳場地的地點和時段

技術的部份 可以選用 vue3 來實做

---

## 本地開發

**需求：Node 20**

```bash
# 1. 安裝依賴
npm install

# 2. 建立環境變數（見下方「Supabase 設定」）
cp .env.example .env.local
# 編輯 .env.local，填入 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY

# 3. 啟動開發伺服器
npm run dev

# 4. 建置（生產）
npm run build
```

---

## Supabase 設定

1. 到 [https://supabase.com](https://supabase.com) 新增一個專案。

2. 進入專案 → **SQL Editor**，把 `docs/supabase-schema.sql` 全部內容貼上並執行。
   這會建立 5 張表（`seasons`、`session_groups`、`sessions`、`registrations`、`admin_config`）、RLS 政策與所有 RPC 函數。

   > **警告：重貼 schema 會 DROP 舊報名、場次與場次系列資料（`registrations`、`sessions`、`session_groups`、`seasons` 均會被清除）。`admin_config` 不在 DROP 範圍內，密碼不會被清掉。**

3. 在 SQL Editor 設定後台初始密碼（把 `CHANGE_ME_BEFORE_RUNNING` 換成你想要的密碼）：

   ```sql
   insert into admin_config (id, password_hash)
   values (1, encode(digest('CHANGE_ME_BEFORE_RUNNING', 'sha256'), 'hex'));
   ```

4. 到專案 **Settings → API**，複製：
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`

5. 填入本地 `.env.local`：

   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

---

## 部署到 GitHub Pages

1. 到 GitHub repo → **Settings → Secrets and variables → Actions**，新增兩個 Repository secrets：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. Push 到 `main` 分支，GitHub Actions（`.github/workflows/deploy.yml`）會自動 build 並部署到 `gh-pages` 分支。

3. 第一次需到 **Settings → Pages → Source**，選擇 `Deploy from a branch`，Branch 選 `gh-pages`，目錄選 `/ (root)`，儲存。

4. 部署完成後可透過 `https://<你的帳號>.github.io/hushih/` 訪問。

---

## 修改後台密碼

到 Supabase SQL Editor，執行（把 `old_password` 與 `new_password` 換成實際值）：

```sql
select admin_change_password('old_password', 'new_password');
```

或直接 update（等同效果）：

```sql
update admin_config
set password_hash = encode(digest('new_password', 'sha256'), 'hex'),
    updated_at    = now()
where id = 1;
```

---

## 報名模型說明

系統採用「場次系列（session_groups）」為報名單位：

- **一個季（season）** 可包含多個場次系列（例如：週一場、週四場）。
- **報名以「場次系列」為單位**：球友一次勾選整季（例如勾「週一場」即報名整季所有週一場次），費用一次計清。
- **個別場次（sessions）由系統依季的起訖月自動展開**（例如 Q3 7～9 月的所有週一），不需手動新增每一場。
- **國定假日或雨天取消**：後台「場次系列」頁面可「檢視日期」，逐筆刪除不需要的場次。刪除後球友報名頁的日期清單同步消失。

### 後台操作流程

1. **先建季**：到「季繳設定」新增季，填入年份、季別、起始/結束月，設為啟用。
2. **再建場次系列**：到「場次系列」選擇季，點「新增場次系列」，勾選星期幾（可多選），填場地、時段、金額、上限，送出後系統自動展開所有對應日期。
3. **管理報名**：球友到首頁報名後，後台「報名名單」可查看各系列的報名狀況並標記繳費。

---

## 系統限制與後續規劃

### 已知限制（MVP）
- **重名**：球友只填姓名，同名會共用報名紀錄。實務上球隊內罕見，若發生可由後台用 `created_at` 辨識。
- **anon key 公開**：Supabase anon key 隨前端 bundle 公開，任何人都能透過該 key 對 `registrations` 表 INSERT/DELETE/SELECT；RLS 已限制其他表只能 SELECT，寫入走密碼驗證 RPC。寫入 RPC 安全，但 `registrations` 仍可能被惡意大量寫入或刪除。若上線後遭到濫用，建議加上 Cloudflare Turnstile / hCaptcha 或頻率限制。
- **密碼演算法**：SHA-256 無 salt，僅擋誤觸後台用，並非高安全資產。若需要可改用 `pgcrypto` 的 `crypt()` + bcrypt。
- **無付款流程**：應繳金額僅做紀錄；實際收款仍透過 LINE/轉帳處理。
- **單隊使用**：系統假設只服務一支球隊，多隊（multi-tenant）需重新設計。

### 後續可能加的功能
- 球友 LINE Notify / Email 提醒
- 出席率統計、個人歷史紀錄
- 線上金流串接（藍新、TapPay）
- 手機後四碼欄位（解決重名）
- 後台手動 import 既有報名（CSV 倒灌）
