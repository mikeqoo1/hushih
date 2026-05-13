<template>
  <div class="max-w-5xl mx-auto px-4 py-6">
    <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
      <h1 class="text-2xl font-bold text-gray-800 flex-1">後台 — 報名名單</h1>

      <select
        v-model="selectedSeasonId"
        @change="loadData"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">— 選擇季 —</option>
        <option v-for="s in adminStore.seasons" :key="s.id" :value="s.id">
          {{ s.year }} Q{{ s.quarter }}{{ s.is_active ? ' (啟用中)' : '' }}
        </option>
      </select>

      <button
        @click="handleExportCsv"
        :disabled="!selectedSeasonId || groupedData.length === 0"
        class="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold rounded-lg px-4 py-2 text-sm transition"
      >
        匯出當季 CSV
      </button>
    </div>

    <div v-if="loading" class="text-gray-500">載入中…</div>

    <div v-else-if="!selectedSeasonId" class="text-gray-400 text-center py-12">請先選擇一個季</div>

    <div v-else-if="groupedData.length === 0" class="text-gray-400 text-center py-12">
      目前無報名
    </div>

    <div v-else class="space-y-6">
      <div
        v-for="item in groupedData"
        :key="item.group.id"
        class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
      >
        <!-- Group header -->
        <div class="bg-gray-50 border-b border-gray-200 px-5 py-3">
          <div class="flex items-center justify-between gap-2">
            <div>
              <span class="font-semibold text-gray-800">
                {{ dayLabel(item.group.day_of_week) }}場 — {{ item.group.venue }} ／ {{ item.group.time_slot }} ／ NT$ {{ item.group.fee_amount.toLocaleString() }}
              </span>
            </div>
            <span class="text-sm font-medium text-gray-600 flex-shrink-0">
              已報 {{ item.registrations.length }} / {{ item.group.max_players }} 人
            </span>
          </div>
          <!-- 展開日期 toggle -->
          <button
            @click="toggleDates(item.group.id)"
            class="mt-1 text-xs text-blue-600 hover:underline"
          >
            {{ expandedDateGroupId === item.group.id ? '收合日期' : '展開日期' }}
          </button>
          <div v-if="expandedDateGroupId === item.group.id" class="mt-2 flex flex-wrap gap-1">
            <span
              v-for="s in item.sessions"
              :key="s.id"
              class="text-xs bg-blue-50 border border-blue-200 rounded px-2 py-0.5"
            >
              {{ formatDate(s.play_date) }}
            </span>
            <span v-if="item.sessions.length === 0" class="text-xs text-gray-400">尚無場次</span>
          </div>
        </div>

        <!-- Registrations list -->
        <div v-if="item.registrations.length === 0" class="px-5 py-4 text-sm text-gray-400">
          尚無報名
        </div>
        <ul v-else class="divide-y divide-gray-100">
          <li
            v-for="reg in item.registrations"
            :key="reg.id"
            class="px-5 py-3 flex items-center gap-3 flex-wrap"
          >
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                :checked="reg.paid"
                @change="handlePaidChange(reg, $event)"
                class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span class="text-sm text-gray-700 font-medium">{{ reg.player_name }}</span>
            </label>
            <span
              :class="reg.paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
              class="px-2 py-0.5 rounded-full text-xs font-medium"
            >
              {{ reg.paid ? '已繳費' : '未繳費' }}
            </span>
            <span class="text-xs text-gray-400 ml-auto">{{ formatDateTime(reg.created_at) }}</span>
            <button
              @click="handleDelete(reg, item.group)"
              :disabled="deletingId === reg.id"
              class="text-red-500 hover:text-red-700 disabled:text-red-300 text-sm hover:underline"
            >
              {{ deletingId === reg.id ? '刪除中…' : '刪除' }}
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAdminStore } from '../stores/admin.js'
import { exportCsv } from '../lib/csv.js'
import { supabase } from '../lib/supabase.js'

const adminStore = useAdminStore()

const loading = ref(true)
const selectedSeasonId = ref('')
const expandedDateGroupId = ref(null)
const deletingId = ref(null)

// sessions for all groups in the selected season, keyed by group_id
const sessionsByGroup = ref({})

const DOW_MAP = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '日' }
function dayLabel(dow) {
  return '週' + (DOW_MAP[dow] ?? dow)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(async () => {
  await adminStore.loadAllSeasons()
  const active = adminStore.seasons.find((s) => s.is_active)
  if (active) {
    selectedSeasonId.value = active.id
    await loadData()
  } else {
    loading.value = false
  }
})

async function loadData() {
  if (!selectedSeasonId.value) return
  loading.value = true
  expandedDateGroupId.value = null

  // 1. 載入該季的 groups
  await adminStore.loadGroupsBySeason(selectedSeasonId.value)

  // 2. 取出所有 group ids，一次取 sessions
  const groupIds = adminStore.groups.map((g) => g.id)
  if (groupIds.length > 0) {
    const { data: sessionsAll } = await supabase
      .from('sessions')
      .select('id, group_id, play_date')
      .in('group_id', groupIds)
      .order('play_date')
    const map = {}
    for (const s of sessionsAll || []) {
      if (!map[s.group_id]) map[s.group_id] = []
      map[s.group_id].push(s)
    }
    sessionsByGroup.value = map
  } else {
    sessionsByGroup.value = {}
  }

  // 3. 載入 registrations
  await adminStore.loadRegistrationsBySeason(selectedSeasonId.value)

  loading.value = false
}

// 按 group 分組
const groupedData = computed(() => {
  return adminStore.groups.map((group) => {
    const registrations = adminStore.registrations.filter((r) => r.group_id === group.id)
    const sessions = sessionsByGroup.value[group.id] || []
    return { group, registrations, sessions }
  })
})

function toggleDates(groupId) {
  expandedDateGroupId.value = expandedDateGroupId.value === groupId ? null : groupId
}

async function handlePaidChange(reg, event) {
  const checked = event.target.checked
  const result = await adminStore.setPaid(reg.id, checked)
  if (result.ok) {
    reg.paid = checked
  } else {
    event.target.checked = !checked
    alert('更新失敗：' + (result.error ?? '未知錯誤'))
  }
}

async function handleDelete(reg, group) {
  const groupLabel = `${dayLabel(group.day_of_week)}場`
  if (!confirm(`確定刪除「${reg.player_name}」在 ${groupLabel} 的報名？此操作無法復原。`)) return
  deletingId.value = reg.id
  const result = await adminStore.deleteRegistration(reg.id)
  if (result.ok) {
    const idx = adminStore.registrations.findIndex((r) => r.id === reg.id)
    if (idx !== -1) adminStore.registrations.splice(idx, 1)
  } else {
    alert('刪除失敗：' + (result.error ?? '未知錯誤'))
  }
  deletingId.value = null
}

function handleExportCsv() {
  const season = adminStore.seasons.find((s) => s.id === selectedSeasonId.value)
  if (!season) return

  const today = new Date()
  const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '')
  const filename = `hushih-${season.year}-Q${season.quarter}-${yyyymmdd}.csv`

  const headers = ['年', '季', '星期', '場地', '時段', '金額', '姓名', '已繳費', '報名時間']

  const rows = []
  for (const item of groupedData.value) {
    for (const reg of item.registrations) {
      rows.push({ season, group: item.group, reg })
    }
  }

  exportCsv(filename, rows, headers, ({ season: s, group, reg }) => [
    String(s.year),
    `Q${s.quarter}`,
    dayLabel(group.day_of_week),
    group.venue,
    group.time_slot,
    String(group.fee_amount),
    reg.player_name,
    reg.paid ? '是' : '否',
    formatDateTime(reg.created_at),
  ])
}
</script>
