import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { registerAllServices } from '@/services'
import '@milkdown/crepe/theme/common/style.css'
import './styles/main.scss'

const app = createApp(App)
const pinia = createPinia()

registerAllServices()

app.use(pinia)
app.mount('#app')
