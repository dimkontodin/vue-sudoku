import './assets/main.scss'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { useTheme } from './composables/useTheme'

// Before mount, so the first paint is already in the chosen theme.
useTheme()

const app = createApp(App)

app.use(router)

app.mount('#app')
