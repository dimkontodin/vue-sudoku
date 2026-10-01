<script setup lang="ts">
import type { Difficulty } from '@vue-sudoku/sudoku-core'

defineProps<{
  difficulty: Difficulty
  elapsed: string
  isRunning: boolean
  /**
   * Omitted when the player has not asked to see it: a tally that ticks up the
   * moment a digit lands tells them which digit was wrong, same as auto-check.
   */
  mistakes?: number
  /** Never a spoiler, so it is always shown. */
  hintsUsed: number
}>()

const emit = defineEmits<{
  toggleTimer: []
}>()
</script>

<template>
  <div class="status">
    <span class="status__difficulty">{{ difficulty }}</span>

    <button
      type="button"
      class="status__timer"
      :aria-label="isRunning ? 'Pause timer' : 'Resume timer'"
      @click="emit('toggleTimer')"
    >
      <span class="status__time">{{ elapsed }}</span>
      <span class="status__icon" aria-hidden="true">{{ isRunning ? '❚❚' : '▶' }}</span>
    </button>

    <span class="status__counts">
      <span v-if="mistakes != null" class="status__count">
        Mistakes <strong>{{ mistakes }}</strong>
      </span>
      <span class="status__count">
        Hints <strong>{{ hintsUsed }}</strong>
      </span>
    </span>
  </div>
</template>

<style scoped lang="scss">
.status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $gap-md;
  width: 100%;
  max-width: $board-width;
  font-size: 0.85rem;
}

.status__difficulty {
  color: var(--color-text-muted);
  text-transform: capitalize;
}

.status__timer {
  display: flex;
  align-items: center;
  gap: $gap-xs;
  padding: 2px $gap-sm;
  border: 1px solid transparent;
  border-radius: $radius-sm;
  background: transparent;

  &:hover {
    border-color: var(--color-border);
  }
}

.status__time {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.status__icon {
  color: var(--color-text-muted);
  font-size: 0.6rem;
}

.status__counts {
  display: flex;
  gap: $gap-md;
}

.status__count {
  color: var(--color-text-muted);
}
</style>
