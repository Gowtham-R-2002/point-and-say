import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SetupScreen } from './app/SetupScreen.tsx'

function Root() {
  const [isSetup, setIsSetup] = useState(true);

  if (isSetup) {
    return <SetupScreen onComplete={() => setIsSetup(false)} />;
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
