import { createRouter, createWebHistory } from 'vue-router'
import GameView from '@/views/GameView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'game',
      component: GameView,
    },
    {
      path: '/enter',
      name: 'enter',
      // Lazy: pulls in the logical solver for grading, which the game view
      // only needs once a hint is asked for.
      component: () => import('@/views/EnterView.vue'),
    },
    {
      path: '/solver',
      name: 'solver',
      // Lazy-loaded: the visualiser pulls in the worker client, which the
      // game itself does not need on first paint.
      component: () => import('@/views/SolverView.vue'),
    },
    {
      path: '/stats',
      name: 'stats',
      // Lazy-loaded: stats are a secondary screen, no need to ship them
      // in the initial chunk.
      component: () => import('@/views/StatsView.vue'),
    },
  ],
})

export default router
