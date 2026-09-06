<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div
        v-if="state.visible"
        class="confirm-overlay"
      >
        <div
          ref="dialogRef"
          class="confirm-dialog"
          :class="{ danger: state.danger, dragging: isDragging }"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          :style="dialogStyle"
          @keydown.esc.prevent="close(false)"
          @keydown.enter.self.prevent="close(true)"
        >
          <div
            class="dialog-header"
            @pointerdown="startDrag"
            @dragstart.prevent
          >
            <span
              class="dialog-mark"
              aria-hidden="true"
            />
            <h3>{{ state.title }}</h3>
          </div>
          <p>{{ state.message }}</p>
          <div class="actions">
            <button
              type="button"
              class="btn cancel"
              @click="close(false)"
            >
              {{ state.cancelText }}
            </button>
            <button
              type="button"
              class="btn confirm"
              :class="{ danger: state.danger }"
              @click="close(true)"
            >
              {{ state.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useConfirmDialog } from '@/composables/useConfirmDialog'

const { state, close } = useConfirmDialog()
const dialogRef = ref<HTMLElement | null>(null)
const position = reactive({ x: 0, y: 0 })
const isDragging = ref(false)

let dragStartX = 0
let dragStartY = 0
let startX = 0
let startY = 0

const dialogStyle = computed(() => ({
  '--dialog-x': `${position.x}px`,
  '--dialog-y': `${position.y}px`,
}))

function startDrag(event: PointerEvent) {
  if (event.button !== 0) return

  event.preventDefault()
  isDragging.value = true
  dialogRef.value?.setPointerCapture(event.pointerId)

  dragStartX = event.clientX
  dragStartY = event.clientY
  startX = position.x
  startY = position.y

  window.addEventListener('pointermove', handleDrag)
  window.addEventListener('pointerup', stopDrag, { once: true })
}

function handleDrag(event: PointerEvent) {
  position.x = startX + event.clientX - dragStartX
  position.y = startY + event.clientY - dragStartY
}

function stopDrag() {
  isDragging.value = false
  window.removeEventListener('pointermove', handleDrag)
}

watch(() => state.visible, async (visible) => {
  if (!visible) {
    position.x = 0
    position.y = 0
    stopDrag()
    return
  }

  await nextTick()
  dialogRef.value?.focus()
})
</script>

<style scoped lang="scss">
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.confirm-dialog {
  width: min(400px, 100%);
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  box-shadow: 0 16px 70px rgba(0, 0, 0, 0.45);
  outline: none;
  overflow: hidden;
  transform: translate(var(--dialog-x, 0), var(--dialog-y, 0));

  &.danger .dialog-mark {
    background: var(--danger-color);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--danger-color) 18%, transparent);
  }

  &.dragging,
  &.dragging .dialog-header,
  &.dragging .dialog-header * {
    cursor: grabbing;
  }

  p {
    margin: 0;
    padding: 18px 20px 4px;
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-bg);
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;

  * {
    cursor: inherit;
  }

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
  }
}

.dialog-mark {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary-color);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary-color) 18%, transparent);
  flex-shrink: 0;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 18px 20px 20px;
}

.btn {
  min-width: 72px;
  padding: 7px 14px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.4;
  cursor: pointer;
  background: transparent;
  color: var(--text-primary);
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;

  &:hover {
    background: var(--panel-hover-bg);
  }

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--primary-color) 55%, transparent);
    outline-offset: 2px;
  }

  &.confirm {
    border-color: var(--primary-color);
    background: var(--primary-color);
    color: white;

    &:hover {
      opacity: 0.9;
    }

    &.danger {
      border-color: var(--danger-color);
      background: var(--danger-color);
    }
  }
}

.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: opacity 0.16s ease;
}

.confirm-fade-enter-active .confirm-dialog,
.confirm-fade-leave-active .confirm-dialog {
  transition: transform 0.16s ease, opacity 0.16s ease;
}

.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
}

.confirm-fade-enter-from .confirm-dialog,
.confirm-fade-leave-to .confirm-dialog {
  transform: translate(var(--dialog-x, 0), var(--dialog-y, 0)) scale(0.96) translateY(-4px);
  opacity: 0;
}
</style>
