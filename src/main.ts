import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import '@milkdown/crepe/theme/common/style.css'
import './styles/main.scss'
import { initializeEditorGateway } from '@adapters/gateways/EditorServiceGateway'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// Initialize editor gateway after Pinia is installed
initializeEditorGateway()

app.mount('#app')
