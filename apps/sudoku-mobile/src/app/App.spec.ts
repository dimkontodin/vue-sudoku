import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IonicVue } from '@ionic/vue'
import App from './App.vue'

describe('App', () => {
  it('renders the Sudoku title', () => {
    const wrapper = mount(App, {
      global: { plugins: [IonicVue] },
    })

    expect(wrapper.text()).toContain('Sudoku')
  })
})
