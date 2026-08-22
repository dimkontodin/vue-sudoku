import { createRouter } from '@ionic/vue-router'
import { createWebHistory } from 'vue-router'
import TabsLayout from '../app/TabsLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/tabs/play' },
    {
      path: '/tabs/',
      component: TabsLayout,
      children: [
        { path: '', redirect: '/tabs/play' },
        { path: 'play', name: 'play', component: () => import('../app/views/PlayView.vue') },
        { path: 'enter', name: 'enter', component: () => import('../app/views/EnterView.vue') },
        { path: 'solver', name: 'solver', component: () => import('../app/views/SolverView.vue') },
        { path: 'stats', name: 'stats', component: () => import('../app/views/StatsView.vue') },
      ],
    },
  ],
})

export default router
