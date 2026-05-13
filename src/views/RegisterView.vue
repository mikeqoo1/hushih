<template>
  <div class="min-h-screen py-4">
    <div class="max-w-md mx-auto">
      <!-- Toast 通知列 -->
      <div class="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all',
            toast.type === 'success'
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white',
          ]"
        >
          {{ toast.message }}
        </div>
      </div>

      <!-- 載入中 -->
      <div v-if="seasonStore.loading" class="text-center py-12 text-gray-400">
        載入中…
      </div>

      <!-- 錯誤 -->
      <div v-else-if="seasonStore.error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        載入失敗：{{ seasonStore.error }}
      </div>

      <!-- 沒有 active season -->
      <div
        v-else-if="!seasonStore.activeSeason"
        class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center text-yellow-800"
      >
        目前沒有開放報名的季
      </div>

      <!-- 有 active season -->
      <div v-else>
        <!-- 標題區 -->
        <div class="bg-orange-500 text-white rounded-xl px-5 py-4 mb-5 shadow">
          <h1 class="text-lg font-bold">
            快樂籃球 — {{ seasonStore.activeSeason.year }} Q{{ seasonStore.activeSeason.quarter }} 季繳報名
          </h1>
          <p class="text-orange-100 text-sm mt-1">
            {{ seasonStore.activeSeason.start_month }} 月～{{ seasonStore.activeSeason.end_month }} 月
          </p>
        </div>

        <!-- 無 groups -->
        <div
          v-if="seasonStore.groups.length === 0"
          class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center text-yellow-800 mb-5"
        >
          目前沒有開放報名的場次系列
        </div>

        <!-- 場次系列卡片列表 -->
        <div v-else class="flex flex-col gap-3 mb-5">
          <div
            v-for="group in seasonStore.groups"
            :key="group.id"
            @click="!isFull(group) && toggleGroup(group.id)"
            :class="[
              'bg-white rounded-xl shadow px-4 py-4 border-2 transition-all',
              isFull(group)
                ? 'opacity-60 cursor-not-allowed border-gray-200'
                : selectedGroupIds.includes(group.id)
                  ? 'border-orange-400 cursor-pointer'
                  : 'border-transparent cursor-pointer hover:border-orange-200',
            ]"
          >
            <div class="flex items-start gap-3">
              <!-- Checkbox -->
              <input
                type="checkbox"
                :id="'group-' + group.id"
                :value="group.id"
                :checked="selectedGroupIds.includes(group.id)"
                :disabled="isFull(group)"
                @click.stop
                @change="toggleGroup(group.id)"
                class="mt-1 w-5 h-5 accent-orange-500 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <!-- 內容 -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-bold text-gray-800 text-base">
                    {{ dayLabel(group.day_of_week) }}場
                  </span>
                  <span class="text-sm font-semibold text-orange-600 flex-shrink-0">
                    NT$ {{ group.fee_amount.toLocaleString() }}
                  </span>
                </div>
                <p class="text-sm text-gray-500 mt-0.5">
                  {{ group.venue }} ／ {{ group.time_slot }}
                </p>
                <p class="text-xs text-gray-400 mt-1">
                  日期：{{ formatSessionDates(group.sessions) }}
                </p>
                <div class="flex items-center justify-between mt-1">
                  <span class="text-xs text-gray-500">
                    已報 {{ group.registrations_count }} / {{ group.max_players }} 人
                  </span>
                  <span
                    v-if="isFull(group)"
                    class="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full"
                  >
                    已額滿
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 報名表單區 -->
        <div class="bg-white rounded-xl shadow px-4 py-4 mb-5 space-y-3">
          <!-- 模式切換 -->
          <div class="flex rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              @click="mode = 'individual'"
              :class="[
                'flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                mode === 'individual' ? 'bg-white text-orange-600 shadow' : 'text-gray-600',
              ]"
            >個人報名</button>
            <button
              type="button"
              @click="mode = 'team'"
              :class="[
                'flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                mode === 'team' ? 'bg-white text-orange-600 shadow' : 'text-gray-600',
              ]"
            >整隊報名</button>
          </div>

          <!-- 個人模式 -->
          <div v-if="mode === 'individual'">
            <label for="player-name" class="block text-sm font-medium text-gray-700 mb-1">
              姓名 <span class="text-red-500">*</span>
            </label>
            <input
              id="player-name"
              v-model="playerName"
              type="text"
              maxlength="30"
              placeholder="請輸入您的姓名"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>

          <!-- 整隊模式 -->
          <div v-else class="space-y-3">
            <div>
              <label for="team-name" class="block text-sm font-medium text-gray-700 mb-1">
                隊名 <span class="text-red-500">*</span>
              </label>
              <input
                id="team-name"
                v-model="teamName"
                type="text"
                maxlength="20"
                placeholder="例：快樂龍戰隊"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
            <div>
              <label for="team-size" class="block text-sm font-medium text-gray-700 mb-1">
                人數 <span class="text-red-500">*</span>
              </label>
              <input
                id="team-size"
                v-model.number="teamSize"
                type="number"
                min="1"
                max="20"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>

            <!-- 預覽會新增的名字 -->
            <div
              v-if="teamMembers.length > 0"
              class="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-800"
            >
              將以下列名字報名：
              <span class="font-medium">{{ teamMembers.join('、') }}</span>
            </div>

            <!-- 容量不足警告 -->
            <div
              v-if="overCapacityGroups.length > 0"
              class="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700"
            >
              ⚠ 下列系列剩餘空位不足 {{ teamSize }} 人：
              <ul class="list-disc pl-5 mt-1">
                <li v-for="info in overCapacityGroups" :key="info.id">
                  {{ info.label }}（剩 {{ info.remaining }} 位）
                </li>
              </ul>
            </div>
          </div>

          <!-- 合計 -->
          <div class="flex items-center justify-between text-sm pt-1 border-t border-gray-100">
            <span class="text-gray-600">
              應繳合計
              <span v-if="mode === 'team' && teamSize > 1" class="text-xs text-gray-400">
                （{{ selectedGroupIds.length }} 系列 × {{ teamSize }} 人）
              </span>
            </span>
            <span class="font-bold text-orange-600 text-base">
              NT$ {{ totalFee.toLocaleString() }}
            </span>
          </div>

          <button
            @click="handleSubmit"
            :disabled="!canSubmit || submitting"
            class="w-full py-3 rounded-xl font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
            :class="
              canSubmit && !submitting
                ? 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700'
                : 'bg-gray-300 cursor-not-allowed'
            "
          >
            {{ submitting ? '送出中…' : '送出報名' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSeasonStore } from '../stores/season.js'
import { useRegistrationStore } from '../stores/registration.js'

const seasonStore = useSeasonStore()
const registrationStore = useRegistrationStore()

const mode = ref('individual')
const playerName = ref('')
const teamName = ref('')
const teamSize = ref(5)
const selectedGroupIds = ref([])
const submitting = ref(false)
const toasts = ref([])
let toastCounter = 0

function addToast(message, type = 'success', durationMs = 4000) {
  const id = ++toastCounter
  toasts.value.push({ id, message, type })
  setTimeout(() => {
    const idx = toasts.value.findIndex((t) => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }, durationMs)
}

function isFull(group) {
  return group.registrations_count >= group.max_players
}

function toggleGroup(groupId) {
  const idx = selectedGroupIds.value.indexOf(groupId)
  if (idx === -1) {
    selectedGroupIds.value.push(groupId)
  } else {
    selectedGroupIds.value.splice(idx, 1)
  }
}

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

// 整隊模式：預覽會新增的名字
const teamMembers = computed(() => {
  if (mode.value !== 'team') return []
  const base = teamName.value.trim()
  const size = Math.max(1, Math.min(20, parseInt(teamSize.value) || 0))
  if (!base || size <= 0) return []
  return Array.from({ length: size }, (_, i) => `${base}${i + 1}`)
})

// 整隊模式：列出剩餘空位不足的系列
const overCapacityGroups = computed(() => {
  if (mode.value !== 'team') return []
  const size = Math.max(1, parseInt(teamSize.value) || 0)
  return selectedGroupIds.value
    .map((gid) => {
      const g = seasonStore.groups.find((g) => g.id === gid)
      if (!g) return null
      const remaining = g.max_players - g.registrations_count
      if (remaining >= size) return null
      return {
        id: gid,
        label: `${dayLabel(g.day_of_week)}場`,
        remaining,
      }
    })
    .filter(Boolean)
})

const totalFee = computed(() => {
  const perPerson = mode.value === 'team' ? Math.max(0, parseInt(teamSize.value) || 0) : 1
  return selectedGroupIds.value.reduce((sum, gid) => {
    const g = seasonStore.groups.find((g) => g.id === gid)
    return sum + (g ? g.fee_amount * perPerson : 0)
  }, 0)
})

const canSubmit = computed(() => {
  if (selectedGroupIds.value.length === 0) return false
  if (mode.value === 'individual') {
    return playerName.value.trim().length > 0
  }
  // team
  if (!teamName.value.trim()) return false
  const size = parseInt(teamSize.value) || 0
  if (size < 1 || size > 20) return false
  if (overCapacityGroups.value.length > 0) return false
  return true
})

async function handleSubmit() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true

  const names = mode.value === 'team' ? teamMembers.value : [playerName.value.trim()]
  const ids = [...selectedGroupIds.value]

  const result = await registrationStore.register(names, ids)

  await seasonStore.refresh()

  if (result.ok) {
    if (mode.value === 'team') {
      addToast(`整隊報名完成（${names.length} 人 × ${ids.length} 系列）！`, 'success')
    } else {
      addToast('報名完成！', 'success')
    }
    playerName.value = ''
    teamName.value = ''
    teamSize.value = 5
    selectedGroupIds.value = []
  } else {
    // 依 group 彙總錯誤
    const byGroup = new Map()
    for (const err of result.errors) {
      if (!byGroup.has(err.groupId)) byGroup.set(err.groupId, [])
      byGroup.get(err.groupId).push(err)
    }
    const perGroupExpected = names.length
    for (const [gid, errs] of byGroup) {
      const group = seasonStore.groups.find((g) => g.id === gid)
      const groupLabel = group ? `${dayLabel(group.day_of_week)}場` : gid
      const dupCount = errs.filter((e) => e.reason === 'duplicate').length
      const otherCount = errs.length - dupCount

      if (perGroupExpected === 1) {
        if (dupCount === 1) {
          addToast(`已報過 ${groupLabel}`, 'error')
        } else {
          addToast(`${groupLabel} 報名失敗：${errs[0].reason}`, 'error')
        }
      } else if (dupCount === perGroupExpected) {
        addToast(`${groupLabel} 整隊已報過`, 'error')
      } else if (dupCount > 0 && otherCount === 0) {
        addToast(`${groupLabel}：${dupCount}/${perGroupExpected} 已重複`, 'error')
      } else {
        addToast(`${groupLabel}：${errs.length}/${perGroupExpected} 失敗`, 'error')
      }
    }
    const failedIds = new Set(result.errors.map((e) => e.groupId))
    selectedGroupIds.value = selectedGroupIds.value.filter((id) => failedIds.has(id))
  }

  submitting.value = false
}

onMounted(() => {
  seasonStore.loadActiveSeason()
})
</script>
