<script setup lang="ts">
import { IonButton } from '@ionic/vue'

defineProps<{
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
        <span class="pad__digit-count" aria-hidden="true">{{ remainingCounts[digit - 1] ?? 0 }}</span>
      </button>
    </div>

    <div class="pad__actions">
      <IonButton size="small" :fill="noteMode ? 'solid' : 'outline'" @click="emit('toggleNotes')">
        Notes {{ noteMode ? 'on' : 'off' }}
      </IonButton>
      <IonButton size="small" fill="outline" :disabled="!canUndo" @click="emit('undo')">Undo</IonButton>
      <IonButton size="small" fill="outline" :disabled="!canRedo" @click="emit('redo')">Redo</IonButton>
      <IonButton size="small" fill="outline" @click="emit('erase')">Erase</IonButton>
    </div>
  </div>
</template>

<style scoped>
.pad {
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
  width: 100%;
  max-width: var(--board-width);
}

.pad__digits {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: var(--gap-xs);
}

.pad__digit {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: var(--gap-xs) 0;
  border: 1px solid var(--ion-color-light-shade, #d7d8da);
  border-radius: var(--radius-sm);
  background: var(--ion-color-light, #f4f5f8);
  font-variant-numeric: tabular-nums;
}

.pad__digit.is-exhausted {
  opacity: 0.4;
}

.pad__digit-value {
  font-size: 1.1rem;
  line-height: 1;
}

.pad__digit-count {
  color: var(--ion-color-medium, #92949c);
  font-size: 0.55rem;
  line-height: 1;
}

.pad__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gap-xs);
}

.pad__actions ion-button {
  flex: 1 1 auto;
  margin: 0;
}
</style>
