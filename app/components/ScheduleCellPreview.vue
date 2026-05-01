<template>
  <div class="schedule-cell-preview">
    <div
      class="schedule-cell-preview__text"
      :title="plainText"
      :style="{ WebkitLineClamp: String(maxLines) }"
    >
      {{ plainText }}
    </div>

    <button
      v-if="canExpand"
      type="button"
      class="schedule-cell-preview__button"
      :aria-label="`Open full ${title.toLowerCase()}`"
      @click="dialogVisible = true"
    >
      <i class="pi pi-expand" aria-hidden="true" />
    </button>

    <Dialog
      v-model:visible="dialogVisible"
      modal
      :header="title"
      class="schedule-cell-preview__dialog"
      :style="{ width: 'min(42rem, calc(100vw - 2rem))' }"
    >
      <div class="schedule-cell-preview__dialog-text">
        {{ plainText }}
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    value?: string | number | null
    title?: string
    maxLines?: number
    expandThreshold?: number
  }>(),
  {
    value: '',
    title: 'Cell Details',
    maxLines: 2,
    expandThreshold: 32,
  },
)

const dialogVisible = ref(false)

const plainText = computed(() => {
  if (props.value === null || props.value === undefined || props.value === '') {
    return 'N/A'
  }

  return String(props.value)
})

const canExpand = computed(() => {
  return (
    plainText.value.length > props.expandThreshold ||
    plainText.value.includes('\n') ||
    plainText.value.includes('; ') ||
    plainText.value.includes(' | ')
  )
})
</script>

<style scoped>
.schedule-cell-preview {
  position: relative;
  min-height: 2.6rem;
  padding-right: 1.55rem;
}

.schedule-cell-preview__text {
  display: -webkit-box;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  line-height: 1.25;
}

.schedule-cell-preview__button {
  position: absolute;
  top: 0.05rem;
  right: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.15rem;
  height: 1.15rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.18);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.schedule-cell-preview__button:hover {
  background: rgba(59, 130, 246, 0.18);
  color: #1d4ed8;
}

.schedule-cell-preview__button:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 1px;
}

.schedule-cell-preview__button .pi {
  font-size: 0.7rem;
}

.schedule-cell-preview__dialog-text {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.5;
}
</style>
