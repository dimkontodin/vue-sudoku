// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import GameStatusBar from '../GameStatusBar.vue'

const BASE = { difficulty: 'easy', elapsed: '00:10', isRunning: true, hintsUsed: 2 } as const

describe('GameStatusBar', () => {
  it('leaves the mistakes counter out unless it is given one', () => {
    const text = mount(GameStatusBar, { props: BASE }).text()

    expect(text).not.toContain('Mistakes')
  })

  it('shows the mistakes counter when it is given one, including zero', () => {
    const text = mount(GameStatusBar, { props: { ...BASE, mistakes: 0 } }).text()

    expect(text).toContain('Mistakes')
  })

  it('always shows hints used, which leaks nothing', () => {
    const text = mount(GameStatusBar, { props: BASE }).text()

    expect(text).toMatch(/Hints\s*2/)
  })
})
