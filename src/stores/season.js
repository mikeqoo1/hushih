import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase.js'

export const useSeasonStore = defineStore('season', {
  state: () => ({
    activeSeason: null,
    groups: [],
    loading: false,
    error: null,
  }),

  actions: {
    async loadActiveSeason() {
      this.loading = true
      this.error = null
      try {
        // 1. 取得 is_active season
        const { data: season, error: seasonErr } = await supabase
          .from('seasons')
          .select('*')
          .eq('is_active', true)
          .maybeSingle()

        if (seasonErr) throw seasonErr

        this.activeSeason = season

        if (!season) {
          this.groups = []
          return
        }

        // 2. 取得該季所有 session_groups
        const { data: groupsRaw, error: groupsErr } = await supabase
          .from('session_groups')
          .select('*')
          .eq('season_id', season.id)
          .order('day_of_week')
          .order('time_slot')

        if (groupsErr) throw groupsErr

        if (!groupsRaw || groupsRaw.length === 0) {
          this.groups = []
          return
        }

        const groupIds = groupsRaw.map((g) => g.id)

        // 3. 取得這些 groups 的 sessions
        const { data: sessionsRaw, error: sessionsErr } = await supabase
          .from('sessions')
          .select('id, group_id, play_date')
          .in('group_id', groupIds)
          .order('play_date')

        if (sessionsErr) throw sessionsErr

        // 4. 取得這些 groups 的 registrations count
        const { data: regsRaw, error: regsErr } = await supabase
          .from('registrations')
          .select('group_id')
          .in('group_id', groupIds)

        if (regsErr) throw regsErr

        // 整理 sessions by group
        const sessionsByGroup = {}
        for (const s of sessionsRaw || []) {
          if (!sessionsByGroup[s.group_id]) sessionsByGroup[s.group_id] = []
          sessionsByGroup[s.group_id].push({ id: s.id, play_date: s.play_date })
        }

        // 計算每個 group 的報名人數
        const countMap = {}
        for (const reg of regsRaw || []) {
          countMap[reg.group_id] = (countMap[reg.group_id] || 0) + 1
        }

        this.groups = groupsRaw.map((g) => ({
          ...g,
          sessions: sessionsByGroup[g.id] || [],
          registrations_count: countMap[g.id] || 0,
        }))
      } catch (err) {
        this.error = err.message || String(err)
        this.activeSeason = null
        this.groups = []
      } finally {
        this.loading = false
      }
    },

    async refresh() {
      await this.loadActiveSeason()
    },
  },
})
