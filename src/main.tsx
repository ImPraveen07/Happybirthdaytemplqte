
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// We removed StrictMode to prevent double-loading of 3D assets & audio
createRoot(document.getElementById('root')!).render(
  <App />
)
