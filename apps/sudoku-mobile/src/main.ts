import './styles.css'
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
// Follows the OS setting, which is what a native app is expected to do.
import '@ionic/vue/css/palettes/dark.system.css'

import { createApp } from 'vue'
import { IonicVue } from '@ionic/vue'
import App from './app/App.vue'
import router from './router'

const app = createApp(App)

app.use(IonicVue)
app.use(router)

router.isReady().then(() => app.mount('#root'))
