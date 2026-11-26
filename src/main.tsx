import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import App from './App'
import './styles/index.css'

// Native status bar: reserve its own space instead of overlaying the webview,
// so no screen content hides behind the time/battery bar on notched devices.
// Native status bar: keep the app edge-to-edge (no separate band) so the warm
// background flows to the top; screens pad their content below the inset.
// A cream status-bar background + dark style gives dark icons on a light app.
if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: true })
  StatusBar.setStyle({ style: Style.Light })
  StatusBar.setBackgroundColor({ color: '#FAF8F5' })
}

const container = document.getElementById('root')
if (!container) throw new Error('Root element missing')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)