import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { initErrorReporter } from './lib/errorReporter'

// T163: attach global error listeners before React renders so no errors are missed
initErrorReporter()

async function mount() {
  // T165.4: start MSW browser worker when ?mock=1 is present (DEV only)
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('mock') === '1') {
    const { worker } = await import('./mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass' })
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

mount()
