<template>
  <div class="image-preview-container">
    <div class="image-preview-header">
      <div class="file-info">
        <Icon
          name="image"
          size="sm"
        />
        <span class="file-name">{{ fileName }}</span>
      </div>
      <div
        v-if="imageDimensions"
        class="image-dimensions"
      >
        {{ imageDimensions.width }} × {{ imageDimensions.height }}
      </div>
    </div>
    
    <div class="image-preview-content">
      <div
        ref="imageWrapper"
        class="image-wrapper"
      >
        <img
          ref="imageRef"
          :src="imageSrc"
          :alt="fileName"
          class="preview-image"
          :class="{ 'loading': isLoading, 'error': hasError }"
          @load="handleImageLoad"
          @error="handleImageError"
        >
        
        <div
          v-if="isLoading"
          class="loading-overlay"
        >
          <div class="loading-spinner" />
          <span class="loading-text">{{ t('editor.loadingImage') }}</span>
        </div>
        
        <div
          v-if="hasError"
          class="error-overlay"
        >
          <Icon
            name="alert-circle"
            size="lg"
            class="error-icon"
          />
          <p>{{ t('editor.failedToLoadImage') }}</p>
        </div>
      </div>
      
      <div
        v-if="!hasError"
        class="image-controls"
      >
        <button
          class="control-btn"
          :disabled="scale <= 0.25"
          title="缩小"
          @click="zoomOut"
        >
          <Icon
            name="zoom-out"
            size="sm"
          />
        </button>
        
        <span class="scale-display">{{ Math.round(scale * 100) }}%</span>
        
        <button
          class="control-btn"
          :disabled="scale >= 3"
          title="放大"
          @click="zoomIn"
        >
          <Icon
            name="zoom-in"
            size="sm"
          />
        </button>
        
        <button
          class="control-btn"
          :disabled="scale === 1"
          title="重置缩放"
          @click="resetZoom"
        >
          <Icon
            name="rotate-ccw"
            size="sm"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { t } from '@/services/i18n'
import { Icon } from '@/components/Icons'

const props = defineProps<{
  filePath: string | null
}>()

const imageRef = ref<HTMLImageElement | null>(null)
const imageWrapper = ref<HTMLElement | null>(null)
const scale = ref(1)
const isLoading = ref(true)
const hasError = ref(false)
const imageDimensions = ref<{ width: number; height: number } | null>(null)
const imageDataUrl = ref<string>('')

const fileName = computed(() => {
  if (!props.filePath) return ''
  return props.filePath.split(/[\\/]/).pop() || ''
})

const imageSrc = computed(() => {
  return imageDataUrl.value
})

async function loadImage() {
  if (!props.filePath) {
    hasError.value = true
    isLoading.value = false
    return
  }
  
  try {
    isLoading.value = true
    hasError.value = false
    
    if (!window.electronAPI) {
      throw new Error('Electron API not available')
    }
    
    const result = await window.electronAPI.readBinaryFile(props.filePath)
    if (result.success && result.data) {
      imageDataUrl.value = result.data
    } else {
      throw new Error(result.error?.message || 'Failed to load image')
    }
  } catch (error) {
    hasError.value = true
    imageDataUrl.value = ''
  } finally {
    isLoading.value = false
  }
}

const handleImageLoad = () => {
  isLoading.value = false
  hasError.value = false
  
  if (imageRef.value) {
    imageDimensions.value = {
      width: imageRef.value.naturalWidth,
      height: imageRef.value.naturalHeight
    }
  }
}

const handleImageError = () => {
  isLoading.value = false
  hasError.value = true
}

const zoomIn = () => {
  scale.value = Math.min(3, scale.value + 0.25)
}

const zoomOut = () => {
  scale.value = Math.max(0.25, scale.value - 0.25)
}

const resetZoom = () => {
  scale.value = 1
}

watch(() => props.filePath, () => {
  scale.value = 1
  isLoading.value = true
  hasError.value = false
  imageDimensions.value = null
  imageDataUrl.value = ''
  loadImage()
}, { immediate: true })

function handleWheel(e: WheelEvent) {
  if (!imageWrapper.value || hasError.value) return
  
  const rect = imageWrapper.value.getBoundingClientRect()
  if (
    e.clientX >= rect.left &&
    e.clientX <= rect.right &&
    e.clientY >= rect.top &&
    e.clientY <= rect.bottom
  ) {
    e.preventDefault()
    
    if (e.deltaY < 0) {
      zoomIn()
    } else {
      zoomOut()
    }
  }
}

onMounted(() => {
  window.addEventListener('wheel', handleWheel, { passive: false })
})

onBeforeUnmount(() => {
  window.removeEventListener('wheel', handleWheel)
})
</script>

<style scoped lang="scss">
.image-preview-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

.image-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-size: 14px;
  
  .file-name {
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.image-dimensions {
  color: var(--text-secondary);
  font-size: 13px;
  font-family: var(--font-mono);
}

.image-preview-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: 16px;
}

.image-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: var(--editor-bg);
  border-radius: 8px;
  overflow: hidden;
  min-height: 200px;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform 0.2s ease;
  transform: scale(var(--image-scale, 1));
  
  &.loading {
    opacity: 0;
  }
  
  &.error {
    display: none;
  }
}

:deep(.preview-image) {
  --image-scale: v-bind('scale');
}

.loading-overlay,
.error-overlay {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 14px;
}

.error-icon {
  font-size: 48px;
  opacity: 0.5;
}

.error-overlay p {
  margin: 0;
  font-size: 14px;
}

.image-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s;
  
  &:hover:not(:disabled) {
    background: var(--bg-hover);
    border-color: var(--primary-color);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.scale-display {
  min-width: 60px;
  text-align: center;
  font-size: 14px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
}
</style>
