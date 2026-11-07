import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initToken } from './shared/api/token';
import './styles/base.css';
import './styles/controls.css';
import './styles/layout.css';
import './styles/workspace.css';
import './styles/dialogs.css';
import './styles/drawer.css';
import './styles/explorer.css';
import './styles/terminal.css';
import './styles/localEcho.css';
import './styles/files.css';
import './styles/tools.css';
import './styles/subtabs.css';
import './styles/viewer.css';
import './styles/preview.css';
import './styles/changes.css';
import './styles/terminalTools.css';
import './styles/copyOverlay.css';
import './styles/chats.css';
import './styles/approvals.css';
import './styles/devices.css';

initToken();
const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
