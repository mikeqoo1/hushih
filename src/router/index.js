import { createRouter, createWebHashHistory } from 'vue-router'
import RegisterView from '../views/RegisterView.vue'
import StatusView from '../views/StatusView.vue'
import AdminLoginView from '../views/AdminLoginView.vue'
import AdminSeasonsView from '../views/AdminSeasonsView.vue'
import AdminGroupsView from '../views/AdminGroupsView.vue'
import AdminRegistrationsView from '../views/AdminRegistrationsView.vue'

const routes = [
  { path: '/', component: RegisterView },
  { path: '/status', component: StatusView },
  { path: '/admin', component: AdminLoginView },
  { path: '/admin/seasons', component: AdminSeasonsView },
  { path: '/admin/groups', component: AdminGroupsView },
  { path: '/admin/registrations', component: AdminRegistrationsView },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to) => {
  if (to.path.startsWith('/admin/') && to.path !== '/admin') {
    const token = sessionStorage.getItem('admin_token')
    if (token !== 'ok') return { path: '/admin' }
  }
})

export default router
