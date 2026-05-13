<template>
  <div class="max-w-5xl mx-auto px-4 py-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-800">後台 — 季繳設定</h1>
      <button
        @click="openModal(null)"
        class="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-4 py-2 transition"
      >
        + 新增季繳
      </button>
    </div>

    <div v-if="loading" class="text-gray-500">載入中…</div>

    <div v-else>
      <!-- Desktop table -->
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-gray-100 text-gray-600 text-left">
              <th class="px-4 py-2">年</th>
              <th class="px-4 py-2">季</th>
              <th class="px-4 py-2">起始月</th>
              <th class="px-4 py-2">結束月</th>
              <th class="px-4 py-2">狀態</th>
              <th class="px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="s in adminStore.seasons"
              :key="s.id"
              class="border-t border-gray-200 hover:bg-gray-50"
            >
              <td class="px-4 py-2">{{ s.year }}</td>
              <td class="px-4 py-2">Q{{ s.quarter }}</td>
              <td class="px-4 py-2">{{ s.start_month }} 月</td>
              <td class="px-4 py-2">{{ s.end_month }} 月</td>
              <td class="px-4 py-2">
                <span
                  :class="s.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'"
                  class="px-2 py-0.5 rounded-full text-xs font-medium"
                >
                  {{ s.is_active ? '啟用中' : '停用' }}
                </span>
              </td>
              <td class="px-4 py-2 space-x-2">
                <button
                  @click="openModal(s)"
                  class="text-blue-600 hover:underline text-sm"
                >編輯</button>
                <button
                  @click="handleDelete(s)"
                  class="text-red-500 hover:underline text-sm"
                >刪除</button>
              </td>
            </tr>
            <tr v-if="!adminStore.seasons.length">
              <td colspan="6" class="text-center py-8 text-gray-400">尚無季繳資料</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile card list -->
      <div class="md:hidden space-y-3">
        <div
          v-for="s in adminStore.seasons"
          :key="s.id"
          class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
        >
          <div class="flex justify-between items-start mb-2">
            <span class="font-semibold text-gray-800">{{ s.year }} Q{{ s.quarter }}</span>
            <span
              :class="s.is_active
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'"
              class="px-2 py-0.5 rounded-full text-xs font-medium"
            >
              {{ s.is_active ? '啟用中' : '停用' }}
            </span>
          </div>
          <p class="text-sm text-gray-600">期間：{{ s.start_month }} 月 ～ {{ s.end_month }} 月</p>
          <div class="flex gap-3 mt-3">
            <button @click="openModal(s)" class="text-blue-600 text-sm hover:underline">編輯</button>
            <button @click="handleDelete(s)" class="text-red-500 text-sm hover:underline">刪除</button>
          </div>
        </div>
        <p v-if="!adminStore.seasons.length" class="text-center py-8 text-gray-400">尚無季繳資料</p>
      </div>
    </div>

    <!-- Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
      @click.self="closeModal"
    >
      <div class="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md">
        <h2 class="text-lg font-bold text-gray-800 mb-4">{{ form.id ? '編輯季繳' : '新增季繳' }}</h2>

        <form @submit.prevent="handleSubmit" class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">年份</label>
              <input
                v-model.number="form.p_year"
                type="number"
                min="2020"
                max="2099"
                required
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">季</label>
              <select
                v-model.number="form.p_quarter"
                required
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">Q1</option>
                <option value="2">Q2</option>
                <option value="3">Q3</option>
                <option value="4">Q4</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">起始月</label>
              <input
                v-model.number="form.p_start_month"
                type="number"
                min="1"
                max="12"
                required
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">結束月</label>
              <input
                v-model.number="form.p_end_month"
                type="number"
                min="1"
                max="12"
                required
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div class="flex items-center gap-2">
            <input
              id="is_active"
              v-model="form.p_is_active"
              type="checkbox"
              class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label for="is_active" class="text-sm text-gray-700">設為啟用（會自動停用其他季）</label>
          </div>

          <p v-if="submitError" class="text-sm text-red-600">{{ submitError }}</p>

          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              @click="closeModal"
              class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >取消</button>
            <button
              type="submit"
              :disabled="submitting"
              class="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg px-5 py-2 text-sm transition"
            >
              {{ submitting ? '儲存中…' : '儲存' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useAdminStore } from '../stores/admin.js'

const adminStore = useAdminStore()
const loading = ref(true)
const showModal = ref(false)
const submitting = ref(false)
const submitError = ref('')

const form = reactive({
  id: null,
  p_year: new Date().getFullYear(),
  p_quarter: 1,
  p_start_month: 1,
  p_end_month: 3,
  p_is_active: false,
})

onMounted(async () => {
  await adminStore.loadAllSeasons()
  loading.value = false
})

function openModal(season) {
  submitError.value = ''
  if (season) {
    form.id = season.id
    form.p_year = season.year
    form.p_quarter = season.quarter
    form.p_start_month = season.start_month
    form.p_end_month = season.end_month
    form.p_is_active = season.is_active
  } else {
    form.id = null
    form.p_year = new Date().getFullYear()
    form.p_quarter = 1
    form.p_start_month = 1
    form.p_end_month = 3
    form.p_is_active = false
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

async function handleSubmit() {
  submitting.value = true
  submitError.value = ''
  const payload = {
    p_id: form.id,
    p_year: form.p_year,
    p_quarter: form.p_quarter,
    p_start_month: form.p_start_month,
    p_end_month: form.p_end_month,
    p_is_active: form.p_is_active,
  }
  const result = await adminStore.upsertSeason(payload)
  submitting.value = false
  if (result.ok) {
    closeModal()
    await adminStore.loadAllSeasons()
  } else {
    submitError.value = '儲存失敗：' + (result.error ?? '未知錯誤')
  }
}

async function handleDelete(season) {
  if (!confirm(`確定刪除 ${season.year} Q${season.quarter}？此操作會同時刪掉該季所有場次與報名。`)) return
  const result = await adminStore.deleteSeason(season.id)
  if (result.ok) {
    await adminStore.loadAllSeasons()
  } else {
    alert('刪除失敗：' + (result.error ?? '未知錯誤'))
  }
}
</script>
