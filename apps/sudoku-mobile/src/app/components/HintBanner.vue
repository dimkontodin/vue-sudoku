<script setup lang="ts">
import { IonButton } from '@ionic/vue'
import type { HintStage } from '@sudoku-web/sudoku-core'

defineProps<{
  stage: HintStage
  stuck: boolean
  headline: string
  detail: string
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
    <p class="hint__headline">{{ headline }}</p>
    <p v-if="detail" class="hint__detail">{{ detail }}</p>
    <p v-if="needsNotes && stage === 'located'" class="hint__aside">
      This one removes pencil marks — turn notes on to see the effect.
    </p>

    <div class="hint__actions">
      <IonButton v-if="!stuck" size="small" @click="stage === 'located' ? emit('apply') : emit('next')">
        {{ NEXT_LABEL[stage] }}
      </IonButton>
      <IonButton size="small" fill="outline" @click="emit('dismiss')">Dismiss</IonButton>
    </div>
  </div>
</template>

<style scoped>
.hint {
  display: flex;
  flex-direction: column;
  gap: var(--gap-xs);
  width: 100%;
  max-width: var(--board-width);
  padding: var(--gap-sm) var(--gap-md);
  border: 1px solid var(--ion-color-primary, #3880ff);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--ion-color-primary, #3880ff) 8%, var(--ion-background-color, #fff));
}

.hint__headline {
  color: var(--ion-color-primary, #3880ff);
  font-size: 0.9rem;
  font-weight: 600;
}

.hint__detail,
.hint__aside {
  color: var(--ion-color-medium, #92949c);
  font-size: 0.78rem;
  line-height: 1.4;
}

.hint__aside {
  font-style: italic;
}

.hint__actions {
  display: flex;
  gap: var(--gap-xs);
  margin-top: var(--gap-xs);
}

.hint__actions ion-button {
  margin: 0;
}
</style>
