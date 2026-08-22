<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { Difficulty } from '@sudoku-web/sudoku-core'

const props = defineProps<{
  open: boolean
  difficulty: Difficulty
  elapsed: string
  mistakes: number
  hintsUsed: number
  isBestTime: boolean
}>()

const emit = defineEmits<{ newGame: []; dismiss: [] }>()

const panel = ref<HTMLElement | null>(null)

// Move focus into the dialog when it opens so keyboard and screen-reader users
// land on it rather than being left behind on the board.
watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    panel.value?.focus()
  },
)
</script>

<template>
  <!-- Teleported to body so the board's stacking context and overflow cannot
       clip or trap the overlay. -->
  <Teleport to="body">
    <Transition name="win">
      <div v-if="open" class="win" @click.self="emit('dismiss')">
        <div
          ref="panel"
          class="win__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="win-title"
          tabindex="-1"
          @keydown.esc="emit('dismiss')"
        >
          <h2 id="win-title" class="win__title">Solved</h2>
          <p v-if="isBestTime" class="win__badge">New best time</p>

          <dl class="win__stats">
            <div>
              <dt>Time</dt>
              <dd>{{ elapsed }}</dd>
            </div>
            <div>
              <dt>Difficulty</dt>
              <dd class="win__difficulty">{{ difficulty }}</dd>
            </div>
            <div>
              <dt>Mistakes</dt>
              <dd>{{ mistakes }}</dd>
            </div>
            <div>
              <dt>Hints</dt>
              <dd>{{ hintsUsed }}</dd>
            </div>
          </dl>

          <div class="win__actions">
            <button type="button" class="win__button is-primary" @click="emit('newGame')">
              New game
            </button>
            <button type="button" class="win__button" @click="emit('dismiss')">Keep looking</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.win {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $gap-md;
  background: rgb(0 0 0 / 55%);
}

.win__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $gap-md;
  width: 100%;
  max-width: 20rem;
  padding: $gap-lg;
  border-radius: $radius-lg;
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-md);
  text-align: center;

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
}

.win__title {
  color: var(--color-primary);
  font-size: 1.5rem;
}

.win__badge {
  padding: 2px $gap-sm;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 20%, transparent);
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 600;
}

.win__stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $gap-sm $gap-md;
  width: 100%;
  margin: 0;

  div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  dt {
    color: var(--color-text-muted);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
    font-size: 1.1rem;
    font-weight: 600;
  }
}

.win__difficulty {
  text-transform: capitalize;
}

.win__actions {
  display: flex;
  gap: $gap-sm;
  width: 100%;
}

.win__button {
  flex: 1;
  padding: $gap-sm;
  border: 1px solid var(--color-border);
  border-radius: $radius-sm;
  background: transparent;
  font-size: 0.85rem;

  &.is-primary {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-primary-contrast);
    font-weight: 600;
  }
}

.win-enter-active,
.win-leave-active {
  transition: opacity 0.2s ease;

  .win__panel {
    transition: transform 0.2s ease;
  }
}

.win-enter-from,
.win-leave-to {
  opacity: 0;

  .win__panel {
    transform: scale(0.94);
  }
}

// Respect a reduced-motion preference: the dialog still appears, it just
// does not animate in.
@media (prefers-reduced-motion: reduce) {
  .win-enter-active,
  .win-leave-active {
    transition: none;

    .win__panel {
      transition: none;
    }
  }
}
</style>
