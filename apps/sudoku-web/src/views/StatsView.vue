<script setup lang="ts">
import { computed } from 'vue'
import { formatMs, useStats } from '@vue-sudoku/sudoku-core'

const stats = useStats()

const percent = (rate: number) => `${Math.round(rate * 100)}%`

const hasAnyGames = computed(() => stats.totals.value.started > 0)

const formatDate = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}
</script>

<template>
  <section class="stats">
    <div v-if="!hasAnyGames" class="stats__empty">
      <p>No games yet.</p>
      <RouterLink to="/">Play one</RouterLink>
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
        <caption class="stats__caption">
          By difficulty
        </caption>
        <thead>
          <tr>
            <th scope="col">Difficulty</th>
            <th scope="col">Played</th>
            <th scope="col">Won</th>
            <th scope="col">Rate</th>
            <th scope="col">Best</th>
            <th scope="col">Average</th>
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
        <caption class="stats__caption">
          Recent wins
        </caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Difficulty</th>
            <th scope="col">Time</th>
            <th scope="col">Mistakes</th>
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

      <button type="button" class="stats__clear" @click="stats.clear()">Clear stats</button>
    </template>
  </section>
</template>

<style scoped lang="scss">
.stats {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $gap-lg;
  width: 100%;
  max-width: $board-width;
}

.stats__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $gap-sm;
  color: var(--color-text-muted);
}

.stats__totals {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $gap-md;
  width: 100%;

  div {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: $gap-sm;
    border-radius: $radius-md;
    background: var(--color-surface);
  }

  dt {
    color: var(--color-text-muted);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  dd {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
}

.stats__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;

  th,
  td {
    padding: $gap-xs $gap-sm;
    border-bottom: 1px solid var(--color-border);
    text-align: right;
  }

  thead th {
    color: var(--color-text-muted);
    font-size: 0.7rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  th:first-child,
  td:first-child {
    text-align: left;
  }
}

.stats__caption {
  padding-bottom: $gap-xs;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stats__difficulty {
  font-weight: 500;
  text-transform: capitalize;
}

.stats__clear {
  align-self: flex-start;
  padding: $gap-xs $gap-sm;
  border: 1px solid var(--color-border);
  border-radius: $radius-sm;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.8rem;
}
</style>
