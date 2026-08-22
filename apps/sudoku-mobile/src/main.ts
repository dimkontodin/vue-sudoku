import './styles.css'
import '@ionic/vue/css/core.css'

import { createApp } from 'vue'
import { IonicVue } from '@ionic/vue'
import App from './app/App.vue'

const app = createApp(App)

app.use(IonicVue)

app.mount('#root')
