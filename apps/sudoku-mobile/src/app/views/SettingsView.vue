<script setup lang="ts">
import {
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/vue'
import { useGameplayPrefs } from '../composables/useGameplayPrefs'
import { useHaptics } from '../composables/useHaptics'
import { useTheme, type ThemeChoice } from '../composables/useTheme'

// A home for the standing preferences. Haptics used to be item five of the Play
// tab's overflow sheet and auto-check item two, mixed in with one-shot actions
// like "Fill notes" and a destructive Restart — and auto-check was not even
// persisted. Choices that outlive a tap do not belong in an action sheet.
const theme = useTheme()
const haptics = useHaptics()
const prefs = useGameplayPrefs()
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>Settings</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent class="ion-padding">
      <IonList :inset="true">
        <IonListHeader><IonLabel>Appearance</IonLabel></IonListHeader>
        <IonItem :lines="'none'">
          <IonLabel>
            <h3>Theme</h3>
            <IonNote>System follows your device setting.</IonNote>
          </IonLabel>
        </IonItem>
        <IonItem :lines="'none'">
          <IonSegment
            :value="theme.choice.value"
            @ion-change="theme.set(($event.detail.value ?? 'system') as ThemeChoice)"
          >
            <IonSegmentButton value="system"><IonLabel>System</IonLabel></IonSegmentButton>
            <IonSegmentButton value="light"><IonLabel>Light</IonLabel></IonSegmentButton>
            <IonSegmentButton value="dark"><IonLabel>Dark</IonLabel></IonSegmentButton>
          </IonSegment>
        </IonItem>
      </IonList>

      <IonList :inset="true">
        <IonListHeader><IonLabel>Gameplay</IonLabel></IonListHeader>
        <IonItem>
          <IonToggle
            :checked="prefs.autoCheck.value"
            @ion-change="prefs.setAutoCheck($event.detail.checked)"
          >
            <IonLabel>
              <h3>Auto-check</h3>
              <IonNote>Flag a wrong digit as soon as it goes in.</IonNote>
            </IonLabel>
          </IonToggle>
        </IonItem>
        <IonItem>
          <IonToggle
            :checked="prefs.mistakesVisible.value"
            :disabled="prefs.autoCheck.value"
            @ion-change="prefs.setShowMistakes($event.detail.checked)"
          >
            <IonLabel>
              <h3>Show mistakes</h3>
              <IonNote>
                {{
                  prefs.autoCheck.value
                    ? 'Always shown while auto-check is on.'
                    : 'The counter gives away which digit was wrong. Hints used is always shown.'
                }}
              </IonNote>
            </IonLabel>
          </IonToggle>
        </IonItem>
        <IonItem :lines="'none'">
          <IonToggle
            :checked="haptics.isEnabled.value"
            @ion-change="haptics.setEnabled($event.detail.checked)"
          >
            <IonLabel>
              <h3>Haptics</h3>
              <IonNote>Vibrate on taps, mistakes and wins.</IonNote>
            </IonLabel>
          </IonToggle>
        </IonItem>
      </IonList>
    </IonContent>
  </IonPage>
</template>

<style scoped>
ion-note {
  display: block;
  font-size: 0.8rem;
  /* Ionic's ion-note default sits at ~3.5:1 on the light background. */
  color: var(--text-muted);
  white-space: normal;
}

ion-segment {
  width: 100%;
}

/* Ionic uppercases segment labels in MD mode, which truncated "System" to
   "SYST…" at 360px. Sentence case fits, and matches the Solver's segments. */
ion-segment-button {
  --padding-start: 2px;
  --padding-end: 2px;
  min-width: 0;
}

ion-segment-button ion-label {
  font-size: 0.85rem;
  text-transform: none;
}
</style>
