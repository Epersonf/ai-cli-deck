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
import './styles/files.css';
import './styles/tools.css';
import './styles/viewer.css';
import './styles/preview.css';
import './styles/changes.css';
import './styles/activity.css';
import './styles/chat.css';
import './styles/chatBlocks.css';
import './styles/chatTools.css';
import './styles/signin.css';
import './styles/dropdown.css';
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
