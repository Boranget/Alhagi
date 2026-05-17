<template>
  <Transition name="slide-down">
    <div v-if="isVisible" class="floating-search-container">
      <div class="floating-search-panel">
        <div class="search-row">
          <div class="search-input-wrapper">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              class="floating-search-input"
              :placeholder="t('search.searchPlaceholder')"
              @input="handleSearchInput"
              @keydown.enter="handleEnter"
              @keydown.escape="handleClose"
              @keydown.up.prevent="navigatePrev"
              @keydown.down.prevent="navigateNext"
            />
            <div v-if="searchQuery && matchCount > 0" class="match-counter">
              {{ currentMatchIndex + 1 }}/{{ matchCount }}
            </div>
          </div>

          <div class="nav-buttons">
            <button
              class="nav-btn"
              :disabled="matchCount === 0"
              @click="navigatePrev"
              :title="t('search.previousMatch')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 15l-6-6-6 6"/>
              </svg>
            </button>
            <button
              class="nav-btn"
              :disabled="matchCount === 0"
              @click="navigateNext"
              :title="t('search.nextMatch')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="replace-row">
          <div class="replace-input-wrapper">
            <svg class="replace-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/>
              <path d="M18 8l4-4"/>
              <path d="M18 4l-4 4"/>
            </svg>
            <input
              v-model="replaceQuery"
              type="text"
              class="floating-replace-input"
              :placeholder="t('search.replacePlaceholder')"
              @keydown.enter="replaceSingle"
            />
          </div>

          <div class="action-buttons">
            <button
              v-if="replaceQuery"
              class="action-btn replace"
              :disabled="matchCount === 0"
              @click="replaceSingle"
              :title="t('search.replace')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/>
                <path d="M18 8l4-4"/>
              </svg>
            </button>
            <button
              v-if="replaceQuery"
              class="action-btn replace-all"
              :disabled="matchCount === 0"
              @click="replaceAll"
              :title="t('search.replaceAll')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>
            <button
              class="action-btn close"
              @click="handleClose"
              :title="t('common.close')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="options-row">
          <label class="option-toggle" :class="{ active: options.caseSensitive }">
            <input v-model="options.caseSensitive" type="checkbox" @change="performSearch" />
            <span>Aa</span>
          </label>
          <label class="option-toggle" :class="{ active: options.wholeWord }">
            <input v-model="options.wholeWord" type="checkbox" @change="performSearch" />
            <span>Ab</span>
          </label>
          <label class="option-toggle" :class="{ active: options.regex }">
            <input v-model="options.regex" type="checkbox" @change="performSearch" />
            <span>.*</span>
          </label>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { t } from '@/services/i18n'
import { useSearch } from '@/composables/useSearch'

const {
  isVisible,
  searchQuery,
  replaceQuery,
  matchCount,
  currentMatchIndex,
  options,
  performSearch,
  handleSearchInput,
  navigateNext,
  navigatePrev,
  replaceSingle,
  replaceAll,
  show,
  hide
} = useSearch()

const searchInputRef = ref<HTMLInputElement | null>(null)

const handleEnter = (event: KeyboardEvent) => {
  if (event.shiftKey) {
    navigatePrev()
  } else {
    navigateNext()
  }
}

const handleClose = () => {
  hide()
}

watch(isVisible, (newVal) => {
  if (newVal) {
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
})

onMounted(() => {
  // 移除全局快捷键监听，现在由 EditorContainer 统一处理
})

onUnmounted(() => {
  // 移除全局快捷键监听，现在由 EditorContainer 统一处理
})

defineExpose({
  show,
  hide,
  isVisible
})
</script>

<style scoped lang="scss">
.floating-search-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.floating-search-panel {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.15),
    0 8px 20px rgba(0, 0, 0, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.05);
  padding: 16px 20px;
  min-width: 500px;
  max-width: 700px;
  pointer-events: all;
  backdrop-filter: blur(20px);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--bg-primary);
    opacity: 0.95;
    border-radius: 12px;
    z-index: -1;
  }
}

.search-row,
.replace-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}

.search-input-wrapper,
.replace-input-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.search-icon,
.replace-icon {
  position: absolute;
  left: 12px;
  width: 18px;
  height: 18px;
  color: var(--text-secondary);
  pointer-events: none;
  z-index: 1;
}

.floating-search-input,
.floating-replace-input {
  width: 100%;
  padding: 10px 12px 10px 40px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.1);
  }

  &::placeholder {
    color: var(--text-tertiary);
  }
}

.match-counter {
  position: absolute;
  right: 12px;
  padding: 4px 8px;
  background: var(--primary-color);
  color: white;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  pointer-events: none;
}

.nav-buttons,
.action-buttons {
  display: flex;
  gap: 4px;
}

.nav-btn,
.action-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover:not(:disabled) {
    background: var(--sidebar-hover-bg);
    border-color: var(--primary-color);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.replace {
    color: var(--warning-color);

    &:hover:not(:disabled) {
      background: rgba(255, 186, 0, 0.1);
      border-color: var(--warning-color);
    }
  }

  &.replace-all {
    color: var(--success-color);

    &:hover:not(:disabled) {
      background: rgba(76, 175, 80, 0.1);
      border-color: var(--success-color);
    }
  }

  &.close {
    color: var(--text-secondary);

    &:hover {
      background: rgba(239, 68, 68, 0.1);
      border-color: var(--danger-color);
      color: var(--danger-color);
    }
  }
}

.options-row {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.option-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--input-bg);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;

  input[type="checkbox"] {
    display: none;
  }

  span {
    font-size: 12px;
    font-weight: 600;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: var(--text-secondary);
    transition: all 0.2s ease;
  }

  &:hover {
    background: var(--sidebar-hover-bg);
    border-color: var(--primary-color);

    span {
      color: var(--primary-color);
    }
  }

  &.active {
    background: var(--primary-color);
    border-color: var(--primary-color);

    span {
      color: white;
    }

    &:hover {
      background: var(--primary-color);
    }
  }
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>

