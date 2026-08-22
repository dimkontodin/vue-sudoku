<script setup lang="ts">
import type { Difficulty } from '@/core/types'

// `defineModel` is the modern shorthand for the modelValue prop plus the
// update:modelValue emit, so the parent can just write v-model.
const model = defineModel<Difficulty>({ required: true })

defineProps<{ disabled?: boolean }>()

const options: Difficulty[] = ['easy', 'medium', 'hard', 'expert']
</script>

<template>
  <div class="picker" role="group" aria-label="Difficulty">
    <button
      v-for="option in options"
      :key="option"
      type="button"
      class="picker__option"
      :class="{ 'is-active': model === option }"
      :aria-pressed="model === option"
      :disabled="disabled"
      @click="model = option"
    >
      {{ option }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.picker {
  display: flex;
  gap: $gap-xs;
}

.picker__option {
  padding: $gap-xs $gap-sm;
  border: 1px solid var(--color-border);
  border-radius: $radius-sm;
  background: var(--color-surface-raised);
  font-size: 0.8rem;
  text-transform: capitalize;

  &.is-active {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 18%, var(--color-surface-raised));
    color: var(--color-primary);
    font-weight: 600;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
</style>
