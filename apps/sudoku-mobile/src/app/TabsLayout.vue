<script setup lang="ts">
import { IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/vue'
</script>

<template>
  <IonTabs>
    <IonRouterOutlet />
    <IonTabBar slot="bottom">
      <IonTabButton tab="play" href="/tabs/play">
        <IonLabel>Play</IonLabel>
      </IonTabButton>
      <IonTabButton tab="enter" href="/tabs/enter">
        <IonLabel>Enter</IonLabel>
      </IonTabButton>
      <IonTabButton tab="solver" href="/tabs/solver">
        <IonLabel>Solver</IonLabel>
      </IonTabButton>
      <IonTabButton tab="stats" href="/tabs/stats">
        <IonLabel>Stats</IonLabel>
      </IonTabButton>
    </IonTabBar>
  </IonTabs>
</template>
