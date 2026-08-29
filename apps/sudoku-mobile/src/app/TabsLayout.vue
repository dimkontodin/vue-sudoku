<script setup lang="ts">
import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/vue'
import { barChart, create, flash, grid } from 'ionicons/icons'
</script>

<template>
  <IonTabs>
    <IonRouterOutlet />
    <IonTabBar slot="bottom">
      <IonTabButton tab="play" href="/tabs/play">
        <IonIcon :icon="grid" aria-hidden="true" />
        <IonLabel>Play</IonLabel>
      </IonTabButton>
      <IonTabButton tab="enter" href="/tabs/enter">
        <IonIcon :icon="create" aria-hidden="true" />
        <IonLabel>Enter</IonLabel>
      </IonTabButton>
      <IonTabButton tab="solver" href="/tabs/solver">
        <IonIcon :icon="flash" aria-hidden="true" />
        <IonLabel>Solver</IonLabel>
      </IonTabButton>
      <IonTabButton tab="stats" href="/tabs/stats">
        <IonIcon :icon="barChart" aria-hidden="true" />
        <IonLabel>Stats</IonLabel>
      </IonTabButton>
    </IonTabBar>
  </IonTabs>
</template>
