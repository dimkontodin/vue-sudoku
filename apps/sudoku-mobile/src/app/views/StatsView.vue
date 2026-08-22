<script setup lang="ts">
import { computed } from 'vue'
import { IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/vue'
import { formatMs, useStats } from '@sudoku-web/sudoku-core'

const stats = useStats()

const percent = (rate: number) => `${Math.round(rate * 100)}%`

const hasAnyGames = computed(() => stats.totals.value.started > 0)

const formatDate = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar><IonTitle>Stats</IonTitle></IonToolbar>
    </IonHeader>

    <IonContent class="ion-padding">
      <div class="stats">
        <div v-if="!hasAnyGames" class="stats__empty">
          <p>No games yet — play one first.</p>
        </div>

        <template v-else>
          <div class="stats__totals">
            <div>
              <dt>Started</dt>
              <dd>{{ stats.totals.value.started }}</dd>
            </div>
            <div>
              <dt>Won</dt>
              <dd>{{ stats.totals.value.won }}</dd>
            </div>
            <div>
              <dt>Win rate</dt>
              <dd>{{ percent(stats.totals.value.winRate) }}</dd>
            </div>
          </div>

          <table class="stats__table">
            <caption>By difficulty</caption>
            <thead>
              <tr>
                <th scope="col">Diff.</th>
                <th scope="col">Played</th>
                <th scope="col">Won</th>
                <th scope="col">Rate</th>
                <th scope="col">Best</th>
                <th scope="col">Avg</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in stats.summaries.value" :key="row.difficulty">
                <th scope="row" class="stats__difficulty">{{ row.difficulty }}</th>
                <td>{{ row.started }}</td>
                <td>{{ row.won }}</td>
                <td>{{ percent(row.winRate) }}</td>
                <td>{{ row.bestMs === null ? '—' : formatMs(row.bestMs) }}</td>
                <td>{{ row.averageMs === null ? '—' : formatMs(row.averageMs) }}</td>
              </tr>
            </tbody>
          </table>

          <table v-if="stats.recentWins.value.length" class="stats__table">
            <caption>Recent wins</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Diff.</th>
                <th scope="col">Time</th>
                <th scope="col">Mist.</th>
                <th scope="col">Hints</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(win, index) in stats.recentWins.value" :key="`${win.date}-${index}`">
                <td>{{ formatDate(win.date) }}</td>
                <td class="stats__difficulty">{{ win.difficulty }}</td>
                <td>{{ formatMs(win.timeMs) }}</td>
                <td>{{ win.mistakes }}</td>
                <td>{{ win.hintsUsed }}</td>
              </tr>
            </tbody>
          </table>

          <IonButton fill="outline" size="small" @click="stats.clear()">Clear stats</IonButton>
        </template>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.stats {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gap-lg);
  width: 100%;
  max-width: var(--board-width);
  margin: 0 auto;
}

.stats__empty {
  color: var(--ion-color-medium, #92949c);
}

.stats__totals {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--gap-md);
  width: 100%;
}

.stats__totals div {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--gap-sm);
  border-radius: var(--radius-md);
  background: var(--ion-color-light, #f4f5f8);
}

.stats__totals dt {
  color: var(--ion-color-medium, #92949c);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stats__totals dd {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.stats__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.stats__table th,
.stats__table td {
  padding: var(--gap-xs) var(--gap-sm);
  border-bottom: 1px solid var(--ion-color-light-shade, #d7d8da);
  text-align: right;
}

.stats__table thead th {
  color: var(--ion-color-medium, #92949c);
  font-size: 0.65rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stats__table th:first-child,
.stats__table td:first-child {
  text-align: left;
}

.stats__table caption {
  padding-bottom: var(--gap-xs);
  color: var(--ion-color-medium, #92949c);
  font-size: 0.75rem;
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stats__difficulty {
  font-weight: 500;
  text-transform: capitalize;
}
</style>
