// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { setNote } from '@sudoku-web/sudoku-core'
import SudokuCell from '../SudokuCell.vue'

type CellProps = InstanceType<typeof SudokuCell>['$props']

function mountCell(overrides: Partial<CellProps> = {}) {
  return mount(SudokuCell, {
    props: {
      index: 0,
      value: 0,
      notes: 0,
      isGiven: false,
      isSelected: false,
      isPeer: false,
      isSameValue: false,
      hasConflict: false,
      ...overrides,
    } as CellProps,
  })
}

describe('SudokuCell', () => {
  it('renders its value', () => {
    expect(mountCell({ value: 7 }).text()).toBe('7')
  })

  it('renders nothing when empty and un-noted', () => {
    expect(mountCell().text()).toBe('')
  })

  describe('state classes', () => {
    it('applies none of them by default', () => {
      const classes = mountCell().classes()
      expect(classes).toContain('cell')
      expect(classes).not.toContain('is-given')
      expect(classes).not.toContain('is-selected')
      expect(classes).not.toContain('is-peer')
      expect(classes).not.toContain('is-same-value')
      expect(classes).not.toContain('has-conflict')
    })

    it.each([
      ['isGiven', 'is-given'],
      ['isSelected', 'is-selected'],
      ['isPeer', 'is-peer'],
      ['isSameValue', 'is-same-value'],
      ['hasConflict', 'has-conflict'],
    ] as const)('maps %s to .%s', (prop, className) => {
      expect(mountCell({ [prop]: true }).classes()).toContain(className)
    })

    it('combines several at once', () => {
      const classes = mountCell({ isSelected: true, hasConflict: true, value: 5 }).classes()
      expect(classes).toContain('is-selected')
      expect(classes).toContain('has-conflict')
    })

    it('updates when a prop changes', async () => {
      const wrapper = mountCell()
      expect(wrapper.classes()).not.toContain('is-selected')

      await wrapper.setProps({ isSelected: true })
      expect(wrapper.classes()).toContain('is-selected')
    })
  })

  describe('notes', () => {
    it('renders the noted digits and blanks the rest', () => {
      const notes = setNote(setNote(0, 2), 9)
      const wrapper = mountCell({ notes })

      const cells = wrapper.findAll('.cell__note')
      expect(cells).toHaveLength(9)
      expect(cells[1]!.text()).toBe('2')
      expect(cells[8]!.text()).toBe('9')
      expect(cells[0]!.text()).toBe('')
    })

    it('shows the value instead of notes when both are set', () => {
      const wrapper = mountCell({ value: 4, notes: setNote(0, 3) })

      expect(wrapper.find('.cell__notes').exists()).toBe(false)
      expect(wrapper.text()).toBe('4')
    })
  })

  describe('accessibility', () => {
    it('describes an empty cell by position', () => {
      // index 20 is row 3, column 3 (both 1-based).
      expect(mountCell({ index: 20 }).attributes('aria-label')).toBe('Row 3, column 3, empty')
    })

    it('describes a given cell', () => {
      expect(mountCell({ index: 0, value: 6, isGiven: true }).attributes('aria-label')).toBe(
        'Row 1, column 1, 6, given',
      )
    })

    it('describes a user-entered value without the given marker', () => {
      expect(mountCell({ index: 80, value: 2 }).attributes('aria-label')).toBe('Row 9, column 9, 2')
    })

    it('lists notes for an empty cell', () => {
      const notes = setNote(setNote(0, 1), 5)
      expect(mountCell({ notes }).attributes('aria-label')).toBe(
        'Row 1, column 1, empty, notes 1 5',
      )
    })

    it('reflects selection through aria-pressed', () => {
      expect(mountCell({ isSelected: true }).attributes('aria-pressed')).toBe('true')
      expect(mountCell().attributes('aria-pressed')).toBe('false')
    })
  })

  it('emits its index when clicked', async () => {
    const wrapper = mountCell({ index: 42 })
    await wrapper.trigger('click')

    expect(wrapper.emitted('select')).toEqual([[42]])
  })

  it('emits even when it is a given, leaving the rule to the game', async () => {
    // The cell is dumb on purpose: useSudoku decides that givens are immutable.
    const wrapper = mountCell({ index: 3, isGiven: true, value: 8 })
    await wrapper.trigger('click')

    expect(wrapper.emitted('select')).toEqual([[3]])
  })
})
