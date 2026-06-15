import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css'
import '@/index.css'
import App from '@/App.tsx'
import { CompanionMantineProvider } from '@/components/ui-kit'
import { applyCompanionVisualPreferences, readStoredCompanionPreferences } from '@/companion/preferences'
import { applyThemeMode, readThemeMode } from '@/lib/theme'

applyThemeMode(readThemeMode())
applyCompanionVisualPreferences(readStoredCompanionPreferences())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CompanionMantineProvider>
      <App />
    </CompanionMantineProvider>
  </StrictMode>,
)
