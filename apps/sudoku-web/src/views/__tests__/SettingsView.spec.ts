// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { useGameplayPrefs } from '@vue-sudoku/sudoku-core'
import { useTheme } from '@/composables/useTheme'
import SettingsView from '../SettingsView.vue'

const checkbox = (wrapper: ReturnType<typeof mount>, label: string) =>
  wrapper
    .findAll('.settings__toggle')
    .find((row) => row.text().includes(label))!
    .find('input')

beforeEach(() => {
  localStorage.clear()
  useGameplayPrefs().setAutoCheck(false)
  useGameplayPrefs().setShowMistakes(false)
  useTheme().set('system')
})

describe('SettingsView', () => {
  it('writes auto-check and show-mistakes through to the shared preferences', async () => {
    const wrapper = mount(SettingsView)

    await checkbox(wrapper, 'Show mistakes').setValue(true)
    expect(useGameplayPrefs().showMistakes.value).toBe(true)

    await checkbox(wrapper, 'Auto-check').setValue(true)
    expect(useGameplayPrefs().autoCheck.value).toBe(true)
  })

  it('locks Show mistakes on while auto-check is on, since the board flags digits anyway', async () => {
    const wrapper = mount(SettingsView)
    expect(checkbox(wrapper, 'Show mistakes').element.disabled).toBe(false)

    await checkbox(wrapper, 'Auto-check').setValue(true)

    const showMistakes = checkbox(wrapper, 'Show mistakes').element
    expect(showMistakes.disabled).toBe(true)
    expect(showMistakes.checked).toBe(true)
  })

  it('applies the theme choice to the document and remembers it', async () => {
    const wrapper = mount(SettingsView)

    await wrapper.find('input[value="dark"]').setValue()
    expect(document.documentElement.dataset.theme).toBe('dark')

    await wrapper.find('input[value="system"]').setValue()
    expect(document.documentElement.dataset.theme).toBeUndefined()

    await wrapper.find('input[value="light"]').setValue()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(JSON.parse(localStorage.getItem('vue-sudoku:theme')!).choice).toBe('light')
  })
})
