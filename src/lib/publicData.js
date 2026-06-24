// ============================================================
// 公開頁面（報名頁 / 名單頁）的資料來源 — 內建雲端→備份的 fallback。
//
// 正常情況：讀 Supabase 即時資料（source: 'live'）。
// 萬一雲端被清空或連不上：自動改用打包進網站的快照 src/data/snapshot.json
//   （source: 'snapshot'），讓畫面仍顯示最近一次備份的最新資料（唯讀）。
//
// 快照由 `npm run backup` 產生並 commit。fallback 觸發時機：
//   - 雲端查詢「報錯」（專案被刪 / 暫停 / 連線失敗）→ 用快照。
//   - 雲端「逾時無回應」（專案被暫停常會卡住不回）→ 用快照（見 LIVE_TIMEOUT_MS）。
//   - seasons 表「整個清空」（一筆都沒有）→ 視為被清掉 → 用快照。
//   - 有季但沒有開放中的季 → 視為正常「季之間」→ 不套快照，照常顯示空狀態。
// ============================================================

import { supabase } from './supabase.js'
import snapshot from '../data/snapshot.json'

const SNAP = (snapshot && snapshot.tables) || {}
export const snapshotMeta = (snapshot && snapshot.meta) || null

// 雲端讀取逾時（毫秒）。超過就放棄等待、改用備份快照，
// 避免專案被暫停 / 網路卡住時畫面永遠停在「載入中…」。
const LIVE_TIMEOUT_MS = 5000

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label || 'request'} timeout after ${ms}ms`)), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

export function snapshotHasData() {
  return Array.isArray(SNAP.seasons) && SNAP.seasons.length > 0
}

/** 備份產生日期的友善標籤，如 "2026/06/24"；無快照回空字串。 */
export function snapshotDateLabel() {
  const iso = snapshotMeta && snapshotMeta.generatedAt
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`
}

function emptyLive() {
  return {
    source: 'live',
    reason: null,
    generatedAt: null,
    season: null,
    groups: [],
    sessions: [],
    registrations: [],
  }
}

function bundleFromSnapshot(reason) {
  const seasons = SNAP.seasons || []
  const season = seasons.find((s) => s.is_active) || seasons[0] || null
  const groups = (SNAP.session_groups || [])
    .filter((g) => !season || g.season_id === season.id)
    .slice()
    .sort((a, b) => a.day_of_week - b.day_of_week || String(a.time_slot).localeCompare(String(b.time_slot)))
  const groupIds = new Set(groups.map((g) => g.id))
  const sessions = (SNAP.sessions || [])
    .filter((s) => groupIds.has(s.group_id))
    .slice()
    .sort((a, b) => String(a.play_date).localeCompare(String(b.play_date)))
  const registrations = (SNAP.registrations || [])
    .filter((r) => groupIds.has(r.group_id))
    .slice()
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
  return {
    source: 'snapshot',
    reason, // 'error' | 'wiped'
    generatedAt: (snapshotMeta && snapshotMeta.generatedAt) || null,
    season,
    groups,
    sessions,
    registrations,
  }
}

// 真正打 Supabase 的部分（不含逾時包裝）。
async function fetchLive() {
  // 先抓「所有季」一次，用來分辨「被清空」與「只是沒開放」兩種狀況
  const { data: allSeasons, error: seasonErr } = await supabase.from('seasons').select('*')
  if (seasonErr) throw seasonErr

  if (!allSeasons || allSeasons.length === 0) {
    // 雲端一個季都沒有 → 視為資料被清掉，改用備份
    return snapshotHasData() ? bundleFromSnapshot('wiped') : emptyLive()
  }

  const season = allSeasons.find((s) => s.is_active) || null
  if (!season) {
    // 有季但沒有開放中的 → 正常的「季與季之間」，照常顯示空狀態（不套過期快照）
    return emptyLive()
  }

  const { data: groups, error: groupsErr } = await supabase
    .from('session_groups')
    .select('*')
    .eq('season_id', season.id)
    .order('day_of_week')
    .order('time_slot')
  if (groupsErr) throw groupsErr

  const groupIds = (groups || []).map((g) => g.id)
  let sessions = []
  let registrations = []
  if (groupIds.length > 0) {
    const [sRes, rRes] = await Promise.all([
      supabase
        .from('sessions')
        .select('id, group_id, play_date')
        .in('group_id', groupIds)
        .order('play_date'),
      supabase
        .from('registrations')
        .select('*')
        .in('group_id', groupIds)
        .order('created_at'),
    ])
    if (sRes.error) throw sRes.error
    if (rRes.error) throw rRes.error
    sessions = sRes.data || []
    registrations = rRes.data || []
  }

  return {
    source: 'live',
    reason: null,
    generatedAt: null,
    season,
    groups: groups || [],
    sessions,
    registrations,
  }
}

/**
 * 讀取「目前開放中的季 + 其場次系列 / 場次 / 報名」的完整資料包。
 * 回傳 { source, reason, generatedAt, season, groups, sessions, registrations }。
 * 報名頁與名單頁都用這支，行為一致。
 */
export async function loadActiveSeasonBundle({ timeoutMs = LIVE_TIMEOUT_MS } = {}) {
  try {
    return await withTimeout(fetchLive(), timeoutMs, 'supabase')
  } catch (err) {
    // 連線失敗 / 專案被刪或暫停 / 逾時 → 有快照就用快照頂著，否則把錯誤丟出去
    if (snapshotHasData()) return bundleFromSnapshot('error')
    throw err
  }
}
