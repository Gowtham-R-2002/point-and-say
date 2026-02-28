import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SetupScreen } from './app/SetupScreen.tsx'

interface ProjectConfig {
  projectPath: string;
  devServerUrl: string;
  isExternal?: boolean;
  bridgeInjected?: boolean;
}

function Root() {
  const [projectConfig, setProjectConfig] = useState<ProjectConfig | null>(null);

  if (!projectConfig) {
    return <SetupScreen onComplete={(config) => setProjectConfig(config || { projectPath: '', devServerUrl: '' })} />;
  }

  return <App externalUrl={projectConfig.isExternal ? projectConfig.devServerUrl : null} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
