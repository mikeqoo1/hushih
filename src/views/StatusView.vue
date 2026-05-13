<template>
  <div class="min-h-screen py-4">
    <div class="max-w-md mx-auto">
      <h1 class="text-xl font-bold text-gray-800 mb-5">當季報名狀態</h1>

      <!-- 載入中 -->
      <div v-if="overviewLoading" class="text-center py-12 text-gray-400">載入中…</div>

      <!-- 錯誤 -->
      <div
        v-else-if="overviewError"
        class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-4"
      >
        載入失敗：{{ overviewError }}
      </div>

      <!-- 沒有 active season -->
      <div
        v-else-if="!activeSeason"
        class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center text-yellow-800 text-sm"
      >
        目前沒有開放報名的季
      </div>

      <div v-else>
        <!-- 標題：季資訊 -->
        <div class="bg-orange-500 text-white rounded-xl px-4 py-3 mb-4 shadow text-sm">
          <span class="font-bold">{{ activeSeason.year }} Q{{ activeSeason.quarter }}</span>
          <span class="text-orange-100 ml-2">
            {{ activeSeason.start_month }} 月～{{ activeSeason.end_month }} 月
          </span>
        </div>

        <!-- 無 groups -->
        <div
          v-if="overview.length === 0"
          class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center text-yellow-800 text-sm"
        >
          目前沒有開放報名的場次系列
        </div>

        <!-- 系列列表 -->
        <div v-else class="space-y-3 mb-6">
          <div
            v-for="item in overview"
            :key="item.group.id"
            class="bg-white rounded-xl shadow overflow-hidden"
          >
            <!-- 系列 header -->
            <div class="bg-gray-50 border-b border-gray-200 px-4 py-3">
              <div class="flex items-center justify-between gap-2 mb-0.5">
                <span class="font-bold text-gray-800">
                  {{ dayLabel(item.group.day_of_week) }}場
                </span>
                <span class="text-sm font-semibold text-orange-600 flex-shrink-0">
                  NT$ {{ item.group.fee_amount.toLocaleString() }}
                </span>
              </div>
              <p class="text-xs text-gray-500">
                {{ item.group.venue }} ／ {{ item.group.time_slot }}
              </p>
              <p class="text-xs text-gray-400 mt-1">
                日期：{{ formatSessionDates(item.sessions) }}
              </p>
              <p class="text-xs text-gray-500 mt-1">
                已報 <span class="font-semibold">{{ item.registrations.length }}</span> / {{ item.group.max_players }} 人
              </p>
            </div>

            <!-- 報名名單 -->
            <div v-if="item.registrations.length === 0" class="px-4 py-3 text-xs text-gray-400">
              尚無報名
            </div>
            <ul v-else class="divide-y divide-gray-100">
              <li
                v-for="reg in item.registrations"
                :key="reg.id"
                class="px-4 py-2 flex items-center gap-2 text-sm"
              >
                <span class="text-gray-700">{{ reg.player_name }}</span>
                <span
                  :class="[
                    'ml-auto text-xs px-2 py-0.5 rounded-full font-medium',
                    reg.paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
                  ]"
                >
                  {{ reg.paid ? '已繳費' : '未繳費' }}
                </span>
              </li>
            </ul>
          </div>
        </div>

        <!-- 我要取消我的報名 -->
        <details class="bg-white rounded-xl shadow px-4 py-3 mb-4">
          <summary class="text-sm font-medium text-gray-700 cursor-pointer select-none">
            我要取消我的報名
          </summary>
          <div class="pt-3 space-y-3">
            <div class="flex gap-2">
              <input
                v-model="queryName"
                type="text"
                maxlength="30"
                placeholder="輸入您的姓名"
                @keydown.enter="handleQuery"
                class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
              <button
                @click="handleQuery"
                :disabled="!queryName.trim() || querying"
                class="px-4 py-2 rounded-lg font-semibold text-white text-sm transition-colors focus:outline-none"
                :class="
                  queryName.trim() && !querying
                    ? 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700'
                    : 'bg-gray-300 cursor-not-allowed'
                "
              >
                {{ querying ? '查詢中…' : '查詢' }}
              </button>
            </div>

            <p v-if="cancelError" class="text-red-600 text-xs">{{ cancelError }}</p>

            <!-- 查到後的個人清單 -->
            <template v-if="hasQueried">
              <div
                v-if="myItems.length === 0"
                class="text-yellow-700 text-xs bg-yellow-50 border border-yellow-200 rounded px-3 py-2"
              >
                找不到「{{ lastQueried }}」的報名紀錄
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="item in myItems"
                  :key="item.registration.id"
                  class="border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2 text-sm"
                >
                  <span class="font-medium text-gray-800">
                    {{ dayLabel(item.group.day_of_week) }}場
                  </span>
                  <span class="text-xs text-gray-500">
                    NT$ {{ item.group.fee_amount.toLocaleString() }}
                  </span>
                  <span
                    :class="[
                      'text-xs px-2 py-0.5 rounded-full',
                      item.registration.paid
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500',
                    ]"
                  >
                    {{ item.registration.paid ? '已繳費' : '未繳費' }}
                  </span>
                  <button
                    @click="handleCancel(item)"
                    :disabled="cancellingId === item.registration.id"
                    class="ml-auto text-xs text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {{ cancellingId === item.registration.id ? '取消中…' : '取消' }}
                  </button>
                </div>

                <!-- 合計 -->
                <div class="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs space-y-1">
                  <div class="flex justify-between">
                    <span class="text-gray-600">已繳費</span>
                    <span class="font-semibold text-green-700">NT$ {{ paidTotal.toLocaleString() }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">未繳費</span>
                    <span class="font-semibold text-red-600">NT$ {{ unpaidTotal.toLocaleString() }}</span>
                  </div>
                  <div class="flex justify-between border-t border-orange-200 pt-1">
                    <span class="text-gray-700 font-medium">合計</span>
                    <span class="font-bold text-orange-700">NT$ {{ (paidTotal + unpaidTotal).toLocaleString() }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../lib/supabase.js'
import { useRegistrationStore } from '../stores/registration.js'

const registrationStore = useRegistrationStore()

// --- Overview state ---
const overviewLoading = ref(true)
const overviewError = ref('')
const activeSeason = ref(null)
const overview = ref([]) // [{ group, sessions, registrations }]

// --- Cancel section state ---
const queryName = ref('')
const querying = ref(false)
const hasQueried = ref(false)
const lastQueried = ref('')
const myItems = ref([])
const cancellingId = ref(null)
const cancelError = ref('')

// ISO 1=Mon...7=Sun → 中文
const DOW_MAP = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '日' }
function dayLabel(dow) {
  return '週' + (DOW_MAP[dow] ?? dow)
}

function formatSessionDates(sessions) {
  if (!sessions || sessions.length === 0) return '（尚無日期）'
  return sessions
    .map((s) => {
      const d = new Date(s.play_date + 'T00:00:00')
      return `${d.getMonth() + 1}/${d.getDate()}`
    })
    .join(', ')
}

async function loadOverview() {
  overviewLoading.value = true
  overviewError.value = ''
  try {
    const { data: season, error: seasonErr } = await supabase
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .maybeSingle()
    if (seasonErr) throw seasonErr
    activeSeason.value = season
    if (!season) {
      overview.value = []
      return
    }

    const { data: groups, error: gErr } = await supabase
      .from('session_groups')
      .select('*')
      .eq('season_id', season.id)
      .order('day_of_week')
      .order('time_slot')
    if (gErr) throw gErr

    const groupIds = (groups || []).map((g) => g.id)
    if (groupIds.length === 0) {
      overview.value = []
      return
    }

    const [{ data: sessions, error: sErr }, { data: regs, error: rErr }] = await Promise.all([
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
    if (sErr) throw sErr
    if (rErr) throw rErr

    const sessionsByGroup = {}
    for (const s of sessions || []) {
      if (!sessionsByGroup[s.group_id]) sessionsByGroup[s.group_id] = []
      sessionsByGroup[s.group_id].push(s)
    }
    const regsByGroup = {}
    for (const r of regs || []) {
      if (!regsByGroup[r.group_id]) regsByGroup[r.group_id] = []
      regsByGroup[r.group_id].push(r)
    }
    overview.value = (groups || []).map((g) => ({
      group: g,
      sessions: sessionsByGroup[g.id] || [],
      registrations: regsByGroup[g.id] || [],
    }))
  } catch (err) {
    overviewError.value = err.message || String(err)
  } finally {
    overviewLoading.value = false
  }
}

const paidTotal = computed(() => {
  return myItems.value
    .filter((i) => i.registration.paid)
    .reduce((sum, i) => sum + (i.group?.fee_amount || 0), 0)
})

const unpaidTotal = computed(() => {
  return myItems.value
    .filter((i) => !i.registration.paid)
    .reduce((sum, i) => sum + (i.group?.fee_amount || 0), 0)
})

async function handleQuery() {
  const name = queryName.value.trim()
  if (!name || querying.value) return

  querying.value = true
  cancelError.value = ''
  hasQueried.value = false

  try {
    const result = await registrationStore.fetchByName(name)
    myItems.value = result
    lastQueried.value = name
    hasQueried.value = true
  } catch (err) {
    cancelError.value = `查詢失敗：${err.message || String(err)}`
  } finally {
    querying.value = false
  }
}

async function handleCancel(item) {
  const regId = item.registration.id
  if (cancellingId.value) return
  if (!confirm(`確定取消「${item.registration.player_name}」在 ${dayLabel(item.group.day_of_week)}場 的報名？`)) return
  cancellingId.value = regId
  cancelError.value = ''

  try {
    await registrationStore.cancel(regId)
    // 從個人清單移除
    myItems.value = myItems.value.filter((i) => i.registration.id !== regId)
    // 也同步從 overview 移除（讓上方清單即時更新）
    for (const o of overview.value) {
      const idx = o.registrations.findIndex((r) => r.id === regId)
      if (idx !== -1) o.registrations.splice(idx, 1)
    }
  } catch (err) {
    cancelError.value = `取消失敗：${err.message || String(err)}`
  } finally {
    cancellingId.value = null
  }
}

onMounted(() => {
  loadOverview()
})
</script>
