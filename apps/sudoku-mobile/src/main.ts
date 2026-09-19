import './styles.css'
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
// Every screen uses `class="ion-padding"` on its IonContent; without this the
// rule simply does not exist and all four render flush against the screen edge.
import '@ionic/vue/css/padding.css'
// The class palette, not the system one: useTheme owns .ion-palette-dark so the
// player can override the OS. 'system' still follows it.
import '@ionic/vue/css/palettes/dark.class.css'
import './theme/variables.css'

import { createApp } from 'vue'
import { IonicVue } from '@ionic/vue'
import App from './app/App.vue'
import router from './router'
import { useTheme } from './app/composables/useTheme'

// Before mount, so the first paint is already in the right palette.
useTheme()

const app = createApp(App)

app.use(IonicVue)
app.use(router)

router.isReady().then(() => app.mount('#root'))
