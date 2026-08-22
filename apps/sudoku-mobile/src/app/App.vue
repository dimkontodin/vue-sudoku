<script setup lang="ts">
import { IonApp, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/vue'
import GameView from './GameView.vue'
</script>

<template>
  <IonApp>
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Sudoku</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent class="ion-padding">
        <GameView />
      </IonContent>
    </IonPage>
  </IonApp>
</template>
