<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app">
    <header class="app__header">
      <h1 class="app__title">Sudoku</h1>
      <nav class="app__nav">
        <RouterLink to="/">Play</RouterLink>
        <RouterLink to="/solver">Solver</RouterLink>
        <RouterLink to="/stats">Stats</RouterLink>
      </nav>
    </header>

    <main class="app__main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped lang="scss">
.app {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $gap-lg;
  min-height: 100vh;
  padding: $gap-lg $gap-md;
}

.app__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $gap-sm;
}

.app__title {
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.app__nav {
  display: flex;
  gap: $gap-md;
  font-size: 0.9rem;

  a {
    color: var(--color-text-muted);
    text-decoration: none;

    &.router-link-exact-active {
      color: var(--color-primary);
    }
  }
}

.app__main {
  width: 100%;
  display: flex;
  justify-content: center;
}
</style>
