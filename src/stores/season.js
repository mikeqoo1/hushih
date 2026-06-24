import { defineStore } from 'pinia'
import { loadActiveSeasonBundle } from '../lib/publicData.js'

export const useSeasonStore = defineStore('season', {
  state: () => ({
    activeSeason: null,
    groups: [],
    loading: false,
    error: null,
    // fallback 狀態：'live' = 即時雲端；'snapshot' = 雲端掛了改用備份快照（唯讀）
    source: 'live',
    // 當 source === 'snapshot' 時，備份產生的 ISO 時間（給畫面顯示日期用）
    snapshotAt: null,
  }),

  getters: {
    // 是否正在用備份快照（畫面應顯示提示、停用報名）
    usingFallback: (state) => state.source === 'snapshot',
  },

  actions: {
    async loadActiveSeason() {
      this.loading = true
      this.error = null
      try {
        const bundle = await loadActiveSeasonBundle()

        this.source = bundle.source
        this.snapshotAt = bundle.source === 'snapshot' ? bundle.generatedAt : null
        this.activeSeason = bundle.season

        if (!bundle.season) {
          this.groups = []
          return
        }

        // sessions by group
        const sessionsByGroup = {}
        for (const s of bundle.sessions) {
          if (!sessionsByGroup[s.group_id]) sessionsByGroup[s.group_id] = []
          sessionsByGroup[s.group_id].push({ id: s.id, play_date: s.play_date })
        }

        // 每個 group 的報名人數
        const countMap = {}
        for (const reg of bundle.registrations) {
          countMap[reg.group_id] = (countMap[reg.group_id] || 0) + 1
        }

        this.groups = bundle.groups.map((g) => ({
          ...g,
          sessions: sessionsByGroup[g.id] || [],
          registrations_count: countMap[g.id] || 0,
        }))
      } catch (err) {
        this.error = err.message || String(err)
        this.activeSeason = null
        this.groups = []
        this.source = 'live'
        this.snapshotAt = null
      } finally {
        this.loading = false
      }
    },

    async refresh() {
      await this.loadActiveSeason()
    },
  },
})
