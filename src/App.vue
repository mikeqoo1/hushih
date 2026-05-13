<template>
  <div class="min-h-screen flex flex-col">
    <!-- 主導覽 -->
    <nav class="bg-orange-500 text-white shadow-md">
      <div class="max-w-5xl mx-auto px-4 flex items-center h-14 gap-6">
        <span class="font-bold text-lg tracking-wide">快樂籃球</span>
        <router-link
          to="/"
          class="hover:text-orange-100 transition-colors"
          active-class="underline font-semibold"
        >
          報名
        </router-link>
        <router-link
          to="/status"
          class="hover:text-orange-100 transition-colors"
          active-class="underline font-semibold"
        >
          查詢
        </router-link>
        <router-link
          to="/admin"
          class="ml-auto hover:text-orange-100 transition-colors"
          active-class="underline font-semibold"
        >
          後台
        </router-link>
      </div>
    </nav>

    <!-- 後台子導覽：只在 /admin/* (非 /admin 登入頁) 顯示 -->
    <nav
      v-if="showAdminSubNav"
      class="bg-orange-50 border-b border-orange-200"
    >
      <div class="max-w-5xl mx-auto px-4 flex items-center h-12 gap-1 overflow-x-auto">
        <router-link
          to="/admin/seasons"
          class="px-3 py-1.5 rounded-md text-sm text-orange-800 hover:bg-orange-100 whitespace-nowrap transition-colors"
          active-class="bg-orange-200 font-semibold"
        >
          季繳設定
        </router-link>
        <router-link
          to="/admin/groups"
          class="px-3 py-1.5 rounded-md text-sm text-orange-800 hover:bg-orange-100 whitespace-nowrap transition-colors"
          active-class="bg-orange-200 font-semibold"
        >
          場次系列
        </router-link>
        <router-link
          to="/admin/registrations"
          class="px-3 py-1.5 rounded-md text-sm text-orange-800 hover:bg-orange-100 whitespace-nowrap transition-colors"
          active-class="bg-orange-200 font-semibold"
        >
          報名名單
        </router-link>
        <button
          @click="handleLogout"
          class="ml-auto px-3 py-1.5 rounded-md text-sm text-red-600 hover:bg-red-50 whitespace-nowrap transition-colors"
        >
          登出
        </button>
      </div>
    </nav>

    <main class="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminStore } from './stores/admin.js'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()

const ADMIN_SUB_PATHS = ['/admin/seasons', '/admin/groups', '/admin/registrations']
const showAdminSubNav = computed(() =>
  ADMIN_SUB_PATHS.some((p) => route.path.startsWith(p))
)

function handleLogout() {
  adminStore.logout()
  router.push('/admin')
}
</script>
