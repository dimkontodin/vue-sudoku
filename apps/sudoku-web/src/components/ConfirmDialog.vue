<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel: string
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)

// A native <dialog> gives a focus trap, Escape handling and an inert backdrop
// for free, so the open state is simply mirrored onto it.
function sync(open: boolean) {
  const element = dialog.value
  if (!element) return
  if (open && !element.open) element.showModal()
  else if (!open && element.open) element.close()
}

watch(() => props.open, sync, { flush: 'post' })
onMounted(() => sync(props.open))

// Fires for Escape as well as for a programmatic close(). Only a close the
// parent did not ask for (props.open still true) is a cancel.
function onClose() {
  if (props.open) emit('cancel')
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value) emit('cancel')
}
</script>

<template>
  <dialog
    ref="dialog"
    class="confirm"
    aria-labelledby="confirm-title"
    @close="onClose"
    @click="onBackdropClick"
  >
    <h2 id="confirm-title" class="confirm__title">{{ title }}</h2>
    <p class="confirm__message">{{ message }}</p>

    <div class="confirm__actions">
      <!-- Cancel takes the initial focus: the confirm action is destructive. -->
      <button type="button" class="confirm__button" autofocus @click="emit('cancel')">
        Cancel
      </button>
      <button type="button" class="confirm__button is-danger" @click="emit('confirm')">
        {{ confirmLabel }}
      </button>
    </div>
  </dialog>
</template>

<style scoped lang="scss">
.confirm {
  width: min(90vw, 20rem);
  padding: $gap-lg;
  border: 1px solid var(--color-border);
  border-radius: $radius-lg;
  background: var(--color-surface-raised);
  color: var(--color-text);
  box-shadow: var(--shadow-md);

  &::backdrop {
    background: rgb(0 0 0 / 45%);
  }
}

.confirm__title {
  font-size: 1.1rem;
}

.confirm__message {
  margin-block: $gap-sm $gap-lg;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.confirm__actions {
  display: flex;
  gap: $gap-sm;
}

.confirm__button {
  flex: 1;
  padding: $gap-sm $gap-md;
  border: 1px solid var(--color-border);
  border-radius: $radius-sm;
  background: var(--color-surface-raised);

  &.is-danger {
    border-color: var(--color-danger);
    background: var(--color-danger);
    color: #ffffff;
  }
}
</style>
