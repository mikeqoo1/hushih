<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
    <div class="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">
      <h1 class="text-2xl font-bold text-gray-800 mb-6 text-center">後台登入</h1>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">管理密碼</label>
          <input
            v-model="pwd"
            type="password"
            placeholder="請輸入管理密碼"
            autocomplete="current-password"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            :disabled="loading"
          />
        </div>

        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>

        <button
          type="submit"
          :disabled="loading || !pwd"
          class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg py-2 transition"
        >
          {{ loading ? '驗證中…' : '登入' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../stores/admin.js'

const router = useRouter()
const adminStore = useAdminStore()

const pwd = ref('')
const loading = ref(false)
const errorMsg = ref('')

onMounted(() => {
  if (adminStore.isAuthed) {
    router.replace('/admin/seasons')
  }
})

async function handleLogin() {
  if (!pwd.value) return
  loading.value = true
  errorMsg.value = ''
  const result = await adminStore.login(pwd.value)
  loading.value = false
  if (result.ok) {
    router.push('/admin/seasons')
  } else {
    errorMsg.value = '密碼錯誤，請重試。'
    pwd.value = ''
  }
}
</script>
