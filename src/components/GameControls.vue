<script setup lang="ts">
defineProps<{
  canHint: boolean
  instantFeedback: boolean
  isChecking: boolean
}>()

const emit = defineEmits<{
  hint: []
  check: []
  toggleInstantFeedback: []
  restart: []
}>()
</script>

<template>
  <div class="controls">
    <button type="button" class="controls__button" :disabled="!canHint" @click="emit('hint')">
      Hint
    </button>

    <button
      type="button"
      class="controls__button"
      :class="{ 'is-active': isChecking }"
      @click="emit('check')"
    >
      Check
    </button>

    <button
      type="button"
      class="controls__button"
      :class="{ 'is-active': instantFeedback }"
      :aria-pressed="instantFeedback"
      @click="emit('toggleInstantFeedback')"
    >
      Auto-check {{ instantFeedback ? 'on' : 'off' }}
    </button>

    <button type="button" class="controls__button" @click="emit('restart')">Restart</button>
  </div>
</template>

<style scoped lang="scss">
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: $gap-xs;
  width: 100%;
  max-width: $board-width;
}

.controls__button {
  flex: 1 1 auto;
  padding: $gap-xs $gap-sm;
  border: 1px solid var(--color-border);
  border-radius: $radius-sm;
  background: var(--color-surface-raised);
  font-size: 0.85rem;
  white-space: nowrap;

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
