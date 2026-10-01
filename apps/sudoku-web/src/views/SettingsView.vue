<script setup lang="ts">
import { useGameplayPrefs } from '@vue-sudoku/sudoku-core'
import { THEME_CHOICES, useTheme, type ThemeChoice } from '@/composables/useTheme'

// Home for the standing preferences: choices that outlive a click, as opposed
// to the one-shot buttons under the board. Mirrors the mobile Settings tab.
const theme = useTheme()
const prefs = useGameplayPrefs()

const THEME_LABELS: Record<ThemeChoice, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}
</script>

<template>
  <section class="settings">
    <h2 class="settings__title">Settings</h2>

    <fieldset class="settings__group">
      <legend>Appearance</legend>
      <p class="settings__note">Theme. System follows your device setting.</p>
      <div class="settings__segments" role="radiogroup" aria-label="Theme">
        <label
          v-for="choice in THEME_CHOICES"
          :key="choice"
          class="settings__segment"
          :class="{ 'is-active': theme.choice.value === choice }"
        >
          <input
            type="radio"
            name="theme"
            :value="choice"
            :checked="theme.choice.value === choice"
            @change="theme.set(choice)"
          />
          {{ THEME_LABELS[choice] }}
        </label>
      </div>
    </fieldset>

    <fieldset class="settings__group">
      <legend>Gameplay</legend>

      <label class="settings__toggle">
        <input
          type="checkbox"
          :checked="prefs.autoCheck.value"
          @change="prefs.setAutoCheck(($event.target as HTMLInputElement).checked)"
        />
        <span>
          <strong>Auto-check</strong>
          <span class="settings__note">Flag a wrong digit as soon as it goes in.</span>
        </span>
      </label>

      <label class="settings__toggle">
        <input
          type="checkbox"
          :checked="prefs.mistakesVisible.value"
          :disabled="prefs.autoCheck.value"
          @change="prefs.setShowMistakes(($event.target as HTMLInputElement).checked)"
        />
        <span>
          <strong>Show mistakes</strong>
          <span class="settings__note">
            {{
              prefs.autoCheck.value
                ? 'Always shown while auto-check is on.'
                : 'The counter gives away which digit was wrong. Hints used is always shown.'
            }}
          </span>
        </span>
      </label>
    </fieldset>
  </section>
</template>

<style scoped lang="scss">
.settings {
  display: flex;
  flex-direction: column;
  gap: $gap-lg;
  width: 100%;
  max-width: $board-width;
}

.settings__title {
  font-size: 1.1rem;
  font-weight: 600;
}

.settings__group {
  display: flex;
  flex-direction: column;
  gap: $gap-md;
  padding: $gap-md;
  border: 1px solid var(--color-border);
  border-radius: $radius-md;
  background: var(--color-surface);

  legend {
    padding: 0 $gap-xs;
    color: var(--color-text-muted);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
}

.settings__note {
  display: block;
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.settings__segments {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: $radius-sm;
  overflow: hidden;
}

.settings__segment {
  flex: 1;
  padding: $gap-xs $gap-sm;
  background: var(--color-surface-raised);
  font-size: 0.85rem;
  text-align: center;
  cursor: pointer;

  &.is-active {
    background: color-mix(in srgb, var(--color-primary) 18%, var(--color-surface-raised));
    color: var(--color-primary);
    font-weight: 600;
  }

  // The radio itself is replaced by the segment; it stays focusable.
  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  &:has(input:focus-visible) {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }
}

.settings__toggle {
  display: flex;
  align-items: flex-start;
  gap: $gap-sm;
  cursor: pointer;

  input {
    margin-top: 0.25rem;
  }

  &:has(input:disabled) {
    cursor: default;
  }
}
</style>
