import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase.js'

export const useRegistrationStore = defineStore('registration', {
  state: () => ({
    regs: [],
    loading: false,
    error: null,
  }),

  actions: {
    /**
     * 對每個 (groupId × name) 組合逐筆 insert registration。
     * - 個人模式：names 傳 [姓名]
     * - 整隊模式：names 傳 [`{隊名}1`, `{隊名}2`, ...]
     * 回傳 { ok, errors: [{ groupId, name, reason }] }
     */
    async register(names, groupIds) {
      // 向後相容：若傳進來是字串，自動包成陣列
      const nameList = Array.isArray(names) ? names : [names]
      const errors = []

      for (const groupId of groupIds) {
        for (const rawName of nameList) {
          const playerName = (rawName ?? '').toString().trim()
          if (!playerName) continue
          const { error } = await supabase
            .from('registrations')
            .insert({ group_id: groupId, player_name: playerName })

          if (error) {
            // PostgreSQL unique violation code = 23505
            const reason =
              error.code === '23505' ? 'duplicate' : error.message || String(error)
            errors.push({ groupId, name: playerName, reason })
          }
        }
      }

      if (errors.length > 0) {
        return { ok: false, errors }
      }
      return { ok: true, errors: [] }
    },

    /**
     * 取消報名：刪除指定 registration 列。
     */
    async cancel(regId) {
      const { error } = await supabase
        .from('registrations')
        .delete()
        .eq('id', regId)

      if (error) throw error
    },

    /**
     * 依姓名查詢目前 active season 的所有報名紀錄。
     * 回傳 [{ registration, group, sessions[] }] 或 throw。
     */
    async fetchByName(name) {
      this.loading = true
      this.error = null
      try {
        // Step 1: 取 active season
        const { data: season, error: seasonErr } = await supabase
          .from('seasons')
          .select('*')
          .eq('is_active', true)
          .maybeSingle()

        if (seasonErr) throw seasonErr
        if (!season) {
          this.regs = []
          return []
        }

        // Step 2: 取該季所有 session_groups
        const { data: groups, error: groupsErr } = await supabase
          .from('session_groups')
          .select('*')
          .eq('season_id', season.id)

        if (groupsErr) throw groupsErr

        const groupIds = (groups || []).map((g) => g.id)
        if (groupIds.length === 0) {
          this.regs = []
          return []
        }

        // Step 3: 取該名字在這些 group 的 registrations
        const { data: regs, error: regsErr } = await supabase
          .from('registrations')
          .select('*')
          .in('group_id', groupIds)
          .eq('player_name', name.trim())

        if (regsErr) throw regsErr

        if (!regs || regs.length === 0) {
          this.regs = []
          return []
        }

        // Step 4: 取有報名的 groups 的 sessions
        const regGroupIds = [...new Set(regs.map((r) => r.group_id))]
        const { data: sessions, error: sessErr } = await supabase
          .from('sessions')
          .select('id, group_id, play_date')
          .in('group_id', regGroupIds)
          .order('play_date')

        if (sessErr) throw sessErr

        // 整理 sessions by group
        const sessionsByGroup = {}
        for (const s of sessions || []) {
          if (!sessionsByGroup[s.group_id]) sessionsByGroup[s.group_id] = []
          sessionsByGroup[s.group_id].push({ id: s.id, play_date: s.play_date })
        }

        // 整理 group map
        const groupMap = {}
        for (const g of groups || []) {
          groupMap[g.id] = g
        }

        const result = regs.map((reg) => ({
          registration: reg,
          group: groupMap[reg.group_id] || null,
          sessions: sessionsByGroup[reg.group_id] || [],
        }))

        this.regs = result
        return result
      } catch (err) {
        this.error = err.message || String(err)
        this.regs = []
        return []
      } finally {
        this.loading = false
      }
    },
  },
})
