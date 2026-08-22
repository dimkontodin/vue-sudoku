<script setup lang="ts">
defineProps<{
  /** Index i holds how many of digit i+1 are still unplaced. */
  remainingCounts: number[]
  noteMode: boolean
  canUndo: boolean
  canRedo: boolean
}>()

const emit = defineEmits<{
  digit: [digit: number]
  erase: []
  toggleNotes: []
  undo: []
  redo: []
}>()

const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
</script>

<template>
  <div class="pad">
    <div class="pad__digits">
      <button
        v-for="digit in digits"
        :key="digit"
        type="button"
        class="pad__digit"
        :class="{ 'is-exhausted': remainingCounts[digit - 1] === 0 }"
        :aria-label="`Enter ${digit}, ${remainingCounts[digit - 1] ?? 0} remaining`"
        @click="emit('digit', digit)"
      >
        <span class="pad__digit-value">{{ digit }}</span>
        <span class="pad__digit-count" aria-hidden="true">
          {{ remainingCounts[digit - 1] ?? 0 }}
        </span>
      </button>
    </div>

    <div class="pad__actions">
      <button
        type="button"
        class="pad__action"
        :class="{ 'is-active': noteMode }"
        :aria-pressed="noteMode"
        @click="emit('toggleNotes')"
      >
        Notes {{ noteMode ? 'on' : 'off' }}
      </button>

      <button type="button" class="pad__action" :disabled="!canUndo" @click="emit('undo')">
        Undo
      </button>
      <button type="button" class="pad__action" :disabled="!canRedo" @click="emit('redo')">
        Redo
      </button>
      <button type="button" class="pad__action" @click="emit('erase')">Erase</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pad {
  display: flex;
  flex-direction: column;
  gap: $gap-sm;
  width: 100%;
  max-width: $board-width;
}

.pad__digits {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: $gap-xs;
}

.pad__digit {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: $gap-xs 0;
  border: 1px solid var(--color-border);
  border-radius: $radius-sm;
  background: var(--color-surface-raised);
  font-variant-numeric: tabular-nums;

  &:hover:not(.is-exhausted) {
    border-color: var(--color-primary);
  }

  // Kept clickable — it is still a legal way to clear a wrong entry.
  &.is-exhausted {
    opacity: 0.4;
  }
}

.pad__digit-value {
  font-size: 1.2rem;
  line-height: 1;
}

.pad__digit-count {
  color: var(--color-text-muted);
  font-size: 0.6rem;
  line-height: 1;
}

.pad__actions {
  display: flex;
  flex-wrap: wrap;
  gap: $gap-xs;
}

.pad__action {
  flex: 1 1 auto;
  padding: $gap-xs $gap-sm;
  border: 1px solid var(--color-border);
  border-radius: $radius-sm;
  background: var(--color-surface-raised);
  font-size: 0.85rem;

  &.is-active {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 18%, var(--color-surface-raised));
    color: var(--color-primary);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
</style>
