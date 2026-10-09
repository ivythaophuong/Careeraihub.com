import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { useDevice } from './hooks/useDevice'
import './index.css'
import './responsive.css'

// Sets data-device / data-touch on <html> for CSS. Kept in its own component so a window resize
// re-renders this, not the whole app.
function DeviceProbe() { useDevice(); return null }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DeviceProbe />
    <App />
  </React.StrictMode>,
)
