<script setup lang="ts">
import type { HintStage } from '@vue-sudoku/sudoku-core'

defineProps<{
  stage: HintStage
  stuck: boolean
  headline: string
  detail: string
  /** True when the step only removes candidates, so notes must be visible. */
  needsNotes: boolean
}>()

const emit = defineEmits<{ next: []; apply: []; dismiss: [] }>()

const NEXT_LABEL: Record<HintStage, string> = {
  none: 'Hint',
  technique: 'Show me where',
  located: 'Apply it',
}
</script>

<template>
  <div v-if="stage !== 'none' || stuck" class="hint" role="status">
    <div class="hint__body">
      <p class="hint__headline">{{ headline }}</p>
      <p v-if="detail" class="hint__detail">{{ detail }}</p>
      <p v-if="needsNotes && stage === 'located'" class="hint__aside">
        This one removes pencil marks — turn notes on to see the effect.
      </p>
    </div>

    <div class="hint__actions">
      <button
        v-if="!stuck"
        type="button"
        class="hint__button is-primary"
        @click="stage === 'located' ? emit('apply') : emit('next')"
      >
        {{ NEXT_LABEL[stage] }}
      </button>
      <button type="button" class="hint__button" @click="emit('dismiss')">Dismiss</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: $gap-sm;
  width: 100%;
  max-width: $board-width;
  padding: $gap-sm $gap-md;
  border: 1px solid color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
  border-radius: $radius-md;
  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));
}

.hint__body {
  flex: 1 1 14rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hint__headline {
  color: var(--color-primary);
  font-size: 0.9rem;
  font-weight: 600;
}

.hint__detail,
.hint__aside {
  color: var(--color-text-muted);
  font-size: 0.78rem;
  line-height: 1.4;
}

.hint__aside {
  font-style: italic;
}

.hint__actions {
  display: flex;
  gap: $gap-xs;
}

.hint__button {
  padding: $gap-xs $gap-sm;
  border: 1px solid var(--color-border);
  border-radius: $radius-sm;
  background: var(--color-surface-raised);
  font-size: 0.8rem;
  white-space: nowrap;

  &.is-primary {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-primary-contrast);
    font-weight: 600;
  }
}
</style>
