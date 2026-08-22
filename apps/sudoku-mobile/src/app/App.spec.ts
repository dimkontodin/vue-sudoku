import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IonicVue } from '@ionic/vue'
import router from '../router'
import App from './App.vue'

describe('App', () => {
  it('renders the Play tab by default', async () => {
    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: { plugins: [IonicVue, router] },
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(wrapper.text()).toContain('Play')
  })
})
