import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase.js'

export const useAdminStore = defineStore('admin', {
  state: () => ({
    password: sessionStorage.getItem('admin_password') ?? '',
    seasons: [],
    groups: [],
    sessions: [],
    registrations: [],
  }),

  getters: {
    isAuthed: (state) => state.password !== '',
  },

  actions: {
    async login(pwd) {
      try {
        const { data, error } = await supabase.rpc('verify_admin_password', { p_password: pwd })
        if (error) {
          return { ok: false, error: 'rpc_error' }
        }
        if (data === true) {
          sessionStorage.setItem('admin_token', 'ok')
          sessionStorage.setItem('admin_password', pwd)
          this.password = pwd
          return { ok: true }
        }
        return { ok: false, error: 'password_invalid' }
      } catch {
        return { ok: false, error: 'rpc_error' }
      }
    },

    logout() {
      sessionStorage.removeItem('admin_token')
      sessionStorage.removeItem('admin_password')
      this.password = ''
    },

    async callRpc(fnName, payload = {}) {
      try {
        const { data, error } = await supabase.rpc(fnName, {
          p_password: this.password,
          ...payload,
        })
        if (error) {
          return { ok: false, data: null, error: error.message }
        }
        return { ok: true, data, error: null }
      } catch (err) {
        return { ok: false, data: null, error: err.message }
      }
    },

    // --- Season CRUD ---
    async loadAllSeasons() {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .order('year', { ascending: false })
        .order('quarter', { ascending: false })
      if (!error) this.seasons = data ?? []
      return { ok: !error, data, error: error?.message }
    },

    async upsertSeason(payload) {
      return this.callRpc('admin_upsert_season', payload)
    },

    async deleteSeason(id) {
      return this.callRpc('admin_delete_season', { p_season_id: id })
    },

    // --- Group CRUD ---
    async loadGroupsBySeason(seasonId) {
      const { data, error } = await supabase
        .from('session_groups')
        .select('*')
        .eq('season_id', seasonId)
        .order('day_of_week')
        .order('time_slot')
      if (!error) this.groups = data ?? []
      return { ok: !error, data, error: error?.message }
    },

    async upsertGroup(payload) {
      return this.callRpc('admin_upsert_group', payload)
    },

    async deleteGroup(id) {
      return this.callRpc('admin_delete_group', { p_group_id: id })
    },

    // --- Session CRUD ---
    async loadSessionsByGroup(groupId) {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('group_id', groupId)
        .order('play_date')
      if (!error) this.sessions = data ?? []
      return { ok: !error, data, error: error?.message }
    },

    async deleteSession(sessionId) {
      return this.callRpc('admin_delete_session', { p_session_id: sessionId })
    },

    // --- Registration ---
    async loadRegistrationsBySeason(seasonId) {
      // Step 1: 取該季所有 group ids
      const { data: groups, error: gErr } = await supabase
        .from('session_groups')
        .select('id')
        .eq('season_id', seasonId)
      if (gErr) {
        return { ok: false, data: null, error: gErr.message }
      }
      const groupIds = (groups ?? []).map((g) => g.id)
      if (groupIds.length === 0) {
        this.registrations = []
        return { ok: true, data: [], error: null }
      }
      // Step 2: 取這些 groups 的所有 registrations
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .in('group_id', groupIds)
        .order('created_at')
      if (!error) this.registrations = data ?? []
      return { ok: !error, data, error: error?.message }
    },

    async setPaid(regId, paid) {
      return this.callRpc('admin_set_paid', { p_reg_id: regId, p_paid: paid })
    },

    // 後台刪除任一筆報名（例如球友臨時退出、隊員名單調整）
    // RLS 已允許 anon delete registrations；與球友自助取消走同一條路徑
    async deleteRegistration(regId) {
      const { error } = await supabase
        .from('registrations')
        .delete()
        .eq('id', regId)
      return { ok: !error, error: error?.message }
    },
  },
})
