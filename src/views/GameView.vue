<script setup lang="ts">
// Placeholder. This becomes the only "smart" component: it wires the
// composables (useSudoku, useTimer, useHistory) to the dumb board components.
</script>

<template>
  <section class="game">
    <p class="game__placeholder">Board goes here.</p>
  </section>
</template>

<style scoped lang="scss">
.game {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $gap-md;
}

.game__placeholder {
  color: var(--color-text-muted);
}
</style>
