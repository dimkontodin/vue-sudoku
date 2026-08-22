<script setup lang="ts">
import type { Difficulty } from '@vue-sudoku/sudoku-core'

defineProps<{
  difficulty: Difficulty
  elapsed: string
  isRunning: boolean
  /** Wired up in Phase 5 along with auto-check. */
  mistakes?: number
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

    <span v-if="mistakes != null" class="status__mistakes">
      Mistakes <strong>{{ mistakes }}</strong>
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

.status__mistakes {
  color: var(--color-text-muted);
}
</style>
