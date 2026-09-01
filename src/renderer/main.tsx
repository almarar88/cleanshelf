import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
// خط عربي/لاتيني موحّد مضمّن مع التطبيق، فلا يختلف الشكل بين ويندوز وماك
import '@fontsource/ibm-plex-sans-arabic/400.css'
import '@fontsource/ibm-plex-sans-arabic/500.css'
import '@fontsource/ibm-plex-sans-arabic/600.css'
import '@fontsource/ibm-plex-sans-arabic/700.css'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
