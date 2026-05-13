<template>
  <div class="max-w-5xl mx-auto px-4 py-6">
    <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
      <h1 class="text-2xl font-bold text-gray-800 flex-1">後台 — 場次系列管理</h1>

      <select
        v-model="selectedSeasonId"
        @change="loadGroups"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">— 選擇季 —</option>
        <option v-for="s in adminStore.seasons" :key="s.id" :value="s.id">
          {{ s.year }} Q{{ s.quarter }}{{ s.is_active ? ' (啟用中)' : '' }}
        </option>
      </select>

      <button
        @click="openAddModal"
        :disabled="!selectedSeasonId"
        class="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg px-4 py-2 text-sm transition"
      >
        + 新增場次系列
      </button>
    </div>

    <div v-if="loadingSeasons || loadingGroups" class="text-gray-500">載入中…</div>

    <div v-else-if="!selectedSeasonId" class="text-gray-400 text-center py-12">請先選擇一個季</div>

    <div v-else>
      <!-- Desktop table -->
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-gray-100 text-gray-600 text-left">
              <th class="px-4 py-2">星期</th>
              <th class="px-4 py-2">場地</th>
              <th class="px-4 py-2">時段</th>
              <th class="px-4 py-2">金額</th>
              <th class="px-4 py-2">上限</th>
              <th class="px-4 py-2">場次數</th>
              <th class="px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="group in adminStore.groups" :key="group.id">
              <tr class="border-t border-gray-200 hover:bg-gray-50">
                <td class="px-4 py-2 font-medium">{{ dayLabel(group.day_of_week) }}場</td>
                <td class="px-4 py-2">{{ group.venue }}</td>
                <td class="px-4 py-2">{{ group.time_slot }}</td>
                <td class="px-4 py-2">NT$ {{ group.fee_amount.toLocaleString() }}</td>
                <td class="px-4 py-2">{{ group.max_players }} 人</td>
                <td class="px-4 py-2">{{ sessionCountMap[group.id] ?? '—' }}</td>
                <td class="px-4 py-2 space-x-2">
                  <button
                    @click="toggleSessions(group)"
                    class="text-gray-600 hover:underline text-sm"
                  >
                    {{ expandedGroupId === group.id ? '收合日期' : '檢視日期' }}
                  </button>
                  <button @click="openEditModal(group)" class="text-blue-600 hover:underline text-sm">編輯</button>
                  <button @click="handleDeleteGroup(group)" class="text-red-500 hover:underline text-sm">刪除</button>
                </td>
              </tr>
              <!-- 展開 sessions 列 -->
              <tr v-if="expandedGroupId === group.id" class="bg-blue-50">
                <td colspan="7" class="px-6 py-3">
                  <div v-if="loadingSessions" class="text-gray-400 text-sm">載入中…</div>
                  <div v-else-if="groupSessions.length === 0" class="text-gray-400 text-sm">此系列尚無場次</div>
                  <div v-else class="flex flex-wrap gap-2">
                    <div
                      v-for="s in groupSessions"
                      :key="s.id"
                      class="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs"
                    >
                      <span>{{ formatDate(s.play_date) }}</span>
                      <button
                        @click="handleDeleteSession(s, group)"
                        class="text-red-400 hover:text-red-600 ml-1"
                        title="刪除此場次"
                      >✕</button>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="!adminStore.groups.length">
              <td colspan="7" class="text-center py-8 text-gray-400">此季尚無場次系列</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <div class="md:hidden space-y-3">
        <div
          v-for="group in adminStore.groups"
          :key="group.id"
          class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
        >
          <div class="flex justify-between items-start mb-1">
            <span class="font-semibold text-gray-800">{{ dayLabel(group.day_of_week) }}場</span>
            <span class="text-sm text-orange-600 font-semibold">NT$ {{ group.fee_amount.toLocaleString() }}</span>
          </div>
          <p class="text-sm text-gray-600">{{ group.venue }} ／ {{ group.time_slot }}</p>
          <p class="text-sm text-gray-500">上限 {{ group.max_players }} 人 ／ 場次 {{ sessionCountMap[group.id] ?? '—' }} 場</p>
          <!-- 展開 sessions -->
          <div v-if="expandedGroupId === group.id" class="mt-2">
            <div v-if="loadingSessions" class="text-gray-400 text-xs">載入中…</div>
            <div v-else-if="groupSessions.length === 0" class="text-gray-400 text-xs">此系列尚無場次</div>
            <div v-else class="flex flex-wrap gap-1 mt-1">
              <div
                v-for="s in groupSessions"
                :key="s.id"
                class="flex items-center gap-1 bg-gray-100 rounded px-2 py-0.5 text-xs"
              >
                <span>{{ formatDate(s.play_date) }}</span>
                <button
                  @click="handleDeleteSession(s, group)"
                  class="text-red-400 hover:text-red-600"
                >✕</button>
              </div>
            </div>
          </div>
          <div class="flex gap-3 mt-3 flex-wrap">
            <button @click="toggleSessions(group)" class="text-gray-600 text-sm hover:underline">
              {{ expandedGroupId === group.id ? '收合日期' : '檢視日期' }}
            </button>
            <button @click="openEditModal(group)" class="text-blue-600 text-sm hover:underline">編輯</button>
            <button @click="handleDeleteGroup(group)" class="text-red-500 text-sm hover:underline">刪除</button>
          </div>
        </div>
        <p v-if="!adminStore.groups.length" class="text-center py-8 text-gray-400">此季尚無場次系列</p>
      </div>
    </div>

    <!-- 新增 Modal -->
    <div
      v-if="showAddModal"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
      @click.self="closeAddModal"
    >
      <div class="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
        <h2 class="text-lg font-bold text-gray-800 mb-4">新增場次系列</h2>

        <form @submit.prevent="handleAdd" class="space-y-3">
          <!-- 季（readonly） -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">季</label>
            <input
              :value="selectedSeasonLabel"
              type="text"
              readonly
              class="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500"
            />
          </div>

          <!-- 星期幾多選 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">星期幾（可多選）</label>
            <div class="grid grid-cols-4 gap-2">
              <label
                v-for="dow in DOW_OPTIONS"
                :key="dow.value"
                class="flex items-center gap-1.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  :value="dow.value"
                  v-model="addForm.selectedDays"
                  class="w-4 h-4 accent-blue-600"
                />
                <span class="text-sm">{{ dow.label }}</span>
              </label>
            </div>
          </div>

          <!-- 場地 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">場地</label>
            <input
              v-model="addForm.p_venue"
              type="text"
              placeholder="例：土城國小"
              required
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- 時段 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">時段</label>
            <input
              v-model="addForm.p_time_slot"
              type="text"
              placeholder="例：19:00-21:00"
              required
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- 金額 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">季繳金額（元）</label>
            <input
              v-model.number="addForm.p_fee_amount"
              type="number"
              min="0"
              required
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- 人數上限 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">人數上限</label>
            <input
              v-model.number="addForm.p_max_players"
              type="number"
              min="1"
              required
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- 備註 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">備註（選填）</label>
            <input
              v-model="addForm.p_notes"
              type="text"
              placeholder="選填"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <p v-if="addError" class="text-sm text-red-600">{{ addError }}</p>

          <div class="flex justify-end gap-3 pt-2">
            <button type="button" @click="closeAddModal" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
            <button
              type="submit"
              :disabled="addSubmitting || addForm.selectedDays.length === 0"
              class="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg px-5 py-2 text-sm transition"
            >
              {{ addSubmitting ? '儲存中…' : '儲存' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 編輯 Modal -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
      @click.self="closeEditModal"
    >
      <div class="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
        <h2 class="text-lg font-bold text-gray-800 mb-4">編輯場次系列</h2>

        <form @submit.prevent="handleEdit" class="space-y-3">
          <!-- 星期幾（disabled） -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">星期幾</label>
            <input
              :value="dayLabel(editForm.p_day_of_week)"
              type="text"
              readonly
              class="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500"
            />
          </div>

          <!-- 場地 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">場地</label>
            <input
              v-model="editForm.p_venue"
              type="text"
              required
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- 時段 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">時段</label>
            <input
              v-model="editForm.p_time_slot"
              type="text"
              required
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- 金額 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">季繳金額（元）</label>
            <input
              v-model.number="editForm.p_fee_amount"
              type="number"
              min="0"
              required
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- 人數上限 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">人數上限</label>
            <input
              v-model.number="editForm.p_max_players"
              type="number"
              min="1"
              required
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- 備註 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">備註（選填）</label>
            <input
              v-model="editForm.p_notes"
              type="text"
              placeholder="選填"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <p v-if="editError" class="text-sm text-red-600">{{ editError }}</p>

          <div class="flex justify-end gap-3 pt-2">
            <button type="button" @click="closeEditModal" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
            <button
              type="submit"
              :disabled="editSubmitting"
              class="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg px-5 py-2 text-sm transition"
            >
              {{ editSubmitting ? '儲存中…' : '儲存' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useAdminStore } from '../stores/admin.js'
import { supabase } from '../lib/supabase.js'

const adminStore = useAdminStore()

const loadingSeasons = ref(true)
const loadingGroups = ref(false)
const loadingSessions = ref(false)
const selectedSeasonId = ref('')
const expandedGroupId = ref(null)
const groupSessions = ref([])
const sessionCountMap = ref({})

// ISO 1=Mon...7=Sun
const DOW_MAP = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '日' }
const DOW_OPTIONS = [
  { value: 1, label: '週一' },
  { value: 2, label: '週二' },
  { value: 3, label: '週三' },
  { value: 4, label: '週四' },
  { value: 5, label: '週五' },
  { value: 6, label: '週六' },
  { value: 7, label: '週日' },
]

function dayLabel(dow) {
  return '週' + (DOW_MAP[dow] ?? dow)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const selectedSeasonLabel = computed(() => {
  const s = adminStore.seasons.find((s) => s.id === selectedSeasonId.value)
  return s ? `${s.year} Q${s.quarter}` : ''
})

// --- Add Modal ---
const showAddModal = ref(false)
const addSubmitting = ref(false)
const addError = ref('')
const addForm = reactive({
  selectedDays: [],
  p_venue: '',
  p_time_slot: '',
  p_fee_amount: 0,
  p_max_players: 20,
  p_notes: '',
})

function openAddModal() {
  addError.value = ''
  addForm.selectedDays = []
  addForm.p_venue = ''
  addForm.p_time_slot = ''
  addForm.p_fee_amount = 0
  addForm.p_max_players = 20
  addForm.p_notes = ''
  showAddModal.value = true
}

function closeAddModal() {
  showAddModal.value = false
}

async function handleAdd() {
  if (addForm.selectedDays.length === 0) return
  addSubmitting.value = true
  addError.value = ''

  const errors = []
  const succeeded = []
  for (const dow of addForm.selectedDays) {
    const result = await adminStore.upsertGroup({
      p_id: null,
      p_season_id: selectedSeasonId.value,
      p_day_of_week: dow,
      p_venue: addForm.p_venue,
      p_time_slot: addForm.p_time_slot,
      p_fee_amount: addForm.p_fee_amount,
      p_max_players: addForm.p_max_players,
      p_notes: addForm.p_notes || null,
    })
    if (result.ok) {
      succeeded.push(dow)
    } else {
      errors.push(`週${DOW_MAP[dow]}：${result.error}`)
    }
  }

  addSubmitting.value = false

  if (errors.length > 0) {
    // 把已成功的天從 selectedDays 移除，使用者再按儲存時只會重試失敗的
    addForm.selectedDays = addForm.selectedDays.filter((d) => !succeeded.includes(d))
    addError.value = '部分儲存失敗：' + errors.join('；') + '（已成功的不會重複新增；可修正後重試）'
    await loadGroups()
  } else {
    closeAddModal()
    await loadGroups()
  }
}

// --- Edit Modal ---
const showEditModal = ref(false)
const editSubmitting = ref(false)
const editError = ref('')
const editForm = reactive({
  p_id: null,
  p_season_id: '',
  p_day_of_week: 1,
  p_venue: '',
  p_time_slot: '',
  p_fee_amount: 0,
  p_max_players: 20,
  p_notes: '',
})

function openEditModal(group) {
  editError.value = ''
  editForm.p_id = group.id
  editForm.p_season_id = group.season_id
  editForm.p_day_of_week = group.day_of_week
  editForm.p_venue = group.venue
  editForm.p_time_slot = group.time_slot
  editForm.p_fee_amount = group.fee_amount
  editForm.p_max_players = group.max_players
  editForm.p_notes = group.notes ?? ''
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
}

async function handleEdit() {
  editSubmitting.value = true
  editError.value = ''

  const result = await adminStore.upsertGroup({
    p_id: editForm.p_id,
    p_season_id: editForm.p_season_id,
    p_day_of_week: editForm.p_day_of_week,
    p_venue: editForm.p_venue,
    p_time_slot: editForm.p_time_slot,
    p_fee_amount: editForm.p_fee_amount,
    p_max_players: editForm.p_max_players,
    p_notes: editForm.p_notes || null,
  })

  editSubmitting.value = false

  if (result.ok) {
    closeEditModal()
    await loadGroups()
  } else {
    editError.value = '儲存失敗：' + (result.error ?? '未知錯誤')
  }
}

// --- Sessions 展開 ---
async function toggleSessions(group) {
  if (expandedGroupId.value === group.id) {
    expandedGroupId.value = null
    groupSessions.value = []
    return
  }
  expandedGroupId.value = group.id
  loadingSessions.value = true
  const result = await adminStore.loadSessionsByGroup(group.id)
  groupSessions.value = result.data ?? adminStore.sessions
  // 更新 count
  sessionCountMap.value[group.id] = groupSessions.value.length
  loadingSessions.value = false
}

async function handleDeleteSession(session, group) {
  const dateLabel = formatDate(session.play_date)
  if (!confirm(`確定刪除 ${dateLabel} 的場次？`)) return
  const result = await adminStore.deleteSession(session.id)
  if (result.ok) {
    groupSessions.value = groupSessions.value.filter((s) => s.id !== session.id)
    sessionCountMap.value[group.id] = groupSessions.value.length
  } else {
    alert('刪除失敗：' + (result.error ?? '未知錯誤'))
  }
}

// --- Group 刪除 ---
async function handleDeleteGroup(group) {
  if (!confirm(`確定刪除「${dayLabel(group.day_of_week)}場」系列？\n會同時清掉該系列所有場次與報名紀錄，此操作無法復原。`)) return
  const result = await adminStore.deleteGroup(group.id)
  if (result.ok) {
    if (expandedGroupId.value === group.id) {
      expandedGroupId.value = null
      groupSessions.value = []
    }
    await loadGroups()
  } else {
    alert('刪除失敗：' + (result.error ?? '未知錯誤'))
  }
}

// --- Load ---
async function loadGroups() {
  if (!selectedSeasonId.value) return
  loadingGroups.value = true
  expandedGroupId.value = null
  groupSessions.value = []
  sessionCountMap.value = {}
  await adminStore.loadGroupsBySeason(selectedSeasonId.value)

  // 一次批次撈出所有 groups 的 sessions，計 count 填入 sessionCountMap
  const groupIds = adminStore.groups.map((g) => g.id)
  if (groupIds.length > 0) {
    const { data: allSessions } = await supabase
      .from('sessions')
      .select('group_id')
      .in('group_id', groupIds)
    const map = {}
    for (const s of allSessions ?? []) {
      map[s.group_id] = (map[s.group_id] ?? 0) + 1
    }
    sessionCountMap.value = map
  }

  loadingGroups.value = false
}

onMounted(async () => {
  await adminStore.loadAllSeasons()
  loadingSeasons.value = false
  const active = adminStore.seasons.find((s) => s.is_active)
  if (active) {
    selectedSeasonId.value = active.id
    await loadGroups()
  }
})
</script>
