<script setup lang="ts">
import { IonButton, IonModal } from '@ionic/vue'
import type { Difficulty } from '@sudoku-web/sudoku-core'

defineProps<{
  open: boolean
  difficulty: Difficulty
  elapsed: string
  mistakes: number
  hintsUsed: number
  isBestTime: boolean
}>()

const emit = defineEmits<{ newGame: []; dismiss: [] }>()
</script>

<template>
  <IonModal :is-open="open" @did-dismiss="emit('dismiss')">
    <div class="win">
      <h2 class="win__title">Solved</h2>
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
        <IonButton expand="block" @click="emit('newGame')">New game</IonButton>
        <IonButton expand="block" fill="outline" @click="emit('dismiss')">Keep looking</IonButton>
      </div>
    </div>
  </IonModal>
</template>

<style scoped>
.win {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gap-md);
  padding: var(--gap-lg);
  text-align: center;
}

.win__title {
  color: var(--ion-color-primary, #3880ff);
  font-size: 1.5rem;
}

.win__badge {
  padding: 2px var(--gap-sm);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ion-color-primary, #3880ff) 20%, transparent);
  color: var(--ion-color-primary, #3880ff);
  font-size: 0.75rem;
  font-weight: 600;
}

.win__stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--gap-sm) var(--gap-md);
  width: 100%;
  margin: 0;
}

.win__stats div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.win__stats dt {
  color: var(--ion-color-medium, #92949c);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.win__stats dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
  font-size: 1.1rem;
  font-weight: 600;
}

.win__difficulty {
  text-transform: capitalize;
}

.win__actions {
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
  width: 100%;
}

.win__actions ion-button {
  margin: 0;
}
</style>
