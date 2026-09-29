import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App, reportRenderError } from '@/app'

createRoot(document.getElementById('root')!, {
  onCaughtError: reportRenderError,
  onUncaughtError: reportRenderError,
  onRecoverableError: reportRenderError,
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
