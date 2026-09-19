import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import '@milkdown/crepe/theme/common/style.css'
import './styles/main.scss'
import { initializeContainer } from '@infrastructure/di/Container'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

initializeContainer()

app.mount('#app')
