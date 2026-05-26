<template>
  <Transition name="slide-down">
    <div
      v-if="isVisible"
      class="search-bar"
      @click.stop="noop"
    >
      <div
        class="left-arrow"
        @click="toggleReplace"
      >
        <svg
          class="icon"
          :class="{ 'arrow-right': !showReplace }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      <div class="right-controls">
        <section class="search">
          <div
            class="input-wrapper"
            :class="{ 'error': !!searchErrorMsg }"
          >
            <svg
              class="search-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle
                cx="11"
                cy="11"
                r="8"
              />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              class="search-input"
              :placeholder="t('search.searchPlaceholder')"
              @input="handleSearchInput"
              @keydown.enter="handleEnter"
              @keydown.escape="handleClose"
              @keydown.up.prevent="navigatePrev"
              @keydown.down.prevent="navigateNext"
            >
            <div class="controls">
              <span
                v-if="searchQuery && matchCount > 0"
                class="search-result"
              >
                {{ currentMatchIndex + 1 }} / {{ matchCount }}
              </span>
              <span
                class="option-btn is-case-sensitive"
                :class="{ 'active': options.caseSensitive }"
                :title="t('search.caseSensitive')"
                @click.stop="toggleOption('caseSensitive')"
              >
                Aa
              </span>
              <span
                class="option-btn is-whole-word"
                :class="{ 'active': options.wholeWord }"
                :title="t('search.wholeWord')"
                @click.stop="toggleOption('wholeWord')"
              >
                Ab
              </span>
              <span
                class="option-btn is-regex"
                :class="{ 'active': options.regex }"
                :title="t('search.regex')"
                @click.stop="toggleOption('regex')"
              >
                .*
              </span>
            </div>
            <div
              v-if="searchErrorMsg"
              class="error-msg"
            >
              {{ searchErrorMsg }}
            </div>
          </div>
          <div class="button-group nav-buttons">
            <button
              class="button"
              :disabled="matchCount === 0"
              @click="navigatePrev"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              class="button"
              :disabled="matchCount === 0"
              @click="navigateNext"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </section>
        <section
          v-if="showReplace"
          class="replace"
        >
          <div class="input-wrapper replace-input">
            <svg
              class="replace-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
            </svg>
            <input
              v-model="replaceQuery"
              type="text"
              class="replace-input-field"
              :placeholder="t('search.replacePlaceholder')"
              @keydown.enter="replaceSingle"
            >
          </div>
          <div class="button-group replace-buttons">
            <button
              class="button"
              :disabled="matchCount === 0"
              :title="t('search.replace')"
              @click="replaceSingle"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7.5 19.5a2.121 2.121 0 0 1-3-3z" />
              </svg>
            </button>
            <button
              class="button"
              :disabled="matchCount === 0"
              :title="t('search.replaceAll')"
              @click="replaceAll"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                />
                <path d="M8 15s1.5-2 4-2 4 2 4 2" />
                <path d="M9 9h.01" />
                <path d="M15 9h.01" />
              </svg>
            </button>
          </div>
        </section>
        <button
          class="close-btn"
          :title="t('common.close')"
          @click="handleClose"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { t } from '@/services/i18n'
import { useWorkspaceSearch } from '@/composables/useWorkspaceSearch'

const {
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
  hide,
  isVisible
} = useWorkspaceSearch()

const searchInputRef = ref<HTMLInputElement | null>(null)
const showReplace = ref(false)

const searchErrorMsg = computed(() => {
  if (!options.regex || !searchQuery.value) return ''
  
  try {
    new RegExp(searchQuery.value)
  } catch {
    return t('search.invalidRegex')
  }
  
  try {
    const regex = new RegExp(searchQuery.value)
    if (regex.test('')) {
      return t('search.matchEmpty')
    }
  } catch {
    return t('search.matchEmpty')
  }
  
  return ''
})

const toggleReplace = () => {
  showReplace.value = !showReplace.value
}

type BooleanOptions = 'caseSensitive' | 'wholeWord' | 'regex'
const toggleOption = (option: BooleanOptions) => {
  options[option] = !options[option]
  performSearch()
}

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

const noop = () => {}

// 当搜索框显示时聚焦输入框
watch(isVisible, (newVal) => {
  if (newVal) {
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
})

defineExpose({
  show,
  hide,
  searchQuery
})
</script>

<style scoped lang="scss">
.search-bar {
  position: absolute;
  top: 12px;
  right: 24px;
  z-index: 100;
  width: 520px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  background: var(--bg-primary);
  display: flex;
  flex-direction: row;
  border: 1px solid var(--border-color);
}

.search-bar .left-arrow {
  width: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 8px 0 0 8px;
  transition: background 0.15s ease;
  
  &:hover {
    background: var(--sidebar-hover-bg);
  }
  
  svg {
    width: 14px;
    height: 14px;
    color: var(--text-secondary);
    transition: transform 0.2s ease;
    
    &.arrow-right {
      transform: rotate(-90deg);
    }
  }
}

.search-bar .right-controls {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 4px 32px 4px 4px;
  gap: 4px;
  position: relative;
}

.search, .replace {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-bar .button {
  outline: none;
  cursor: pointer;
  box-sizing: border-box;
  height: 28px;
  width: 28px;
  text-align: center;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--text-secondary);
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    background: var(--sidebar-hover-bg);
    color: var(--text-primary);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  svg {
    width: 16px;
    height: 16px;
  }
}

.input-wrapper {
  display: flex;
  flex: 1;
  position: relative;
  border: 1px solid var(--border-color);
  background: var(--input-bg);
  border-radius: 4px;
  overflow: visible;
  align-items: center;
  
  &.error {
    border-color: var(--error-color);
    border-bottom-right-radius: 0;
    border-bottom-left-radius: 0;
  }
}

.search-icon,
.replace-icon {
  position: absolute;
  left: 10px;
  width: 14px;
  height: 14px;
  color: var(--text-tertiary);
  pointer-events: none;
}

.search-input,
.replace-input-field {
  flex: 1;
  padding: 6px 8px 6px 36px;
  height: 28px;
  outline: none;
  border: none;
  box-sizing: border-box;
  font-size: 13px;
  color: var(--text-primary);
  background: transparent;
  
  &::placeholder {
    color: var(--text-tertiary);
  }
}

.input-wrapper .controls {
  position: absolute;
  top: 4px;
  right: 8px;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 2px;
  color: var(--text-secondary);
  
  .search-result {
    height: 20px;
    margin-right: 6px;
    line-height: 20px;
    font-size: 12px;
  }
  
  .option-btn {
    cursor: pointer;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    font-weight: 600;
    transition: all 0.15s ease;
    
    &:hover {
      background: var(--sidebar-hover-bg);
      color: var(--text-primary);
    }
    
    &.active {
      background: var(--primary-color);
      color: white;
    }
  }
}

.input-wrapper .error-msg {
  position: absolute;
  top: 27px;
  width: calc(100% + 2px);
  height: 28px;
  left: -1px;
  padding: 0 8px;
  box-sizing: border-box;
  border-radius: 0 0 4px 4px;
  background: var(--error-color);
  line-height: 28px;
  color: #ffffff;
  font-size: 12px;
  z-index: 1;
}

.button-group {
  display: flex;
  gap: 2px;
}

.close-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;

  svg {
    width: 14px;
    height: 14px;
  }

  &:hover {
    background: var(--sidebar-hover-bg);
    color: var(--text-primary);
  }
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  transform: translateY(0);
}

@media (max-width: 768px) {
  .search-bar {
    width: calc(100% - 32px);
    right: 16px;
    left: 16px;
  }
}

@media (max-width: 520px) {
  .search-bar {
    width: calc(100% - 24px);
    right: 12px;
    left: 12px;
  }
}
</style>