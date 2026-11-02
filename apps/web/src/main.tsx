import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initToken } from './shared/api/token';
import './styles/base.css';
import './styles/controls.css';
import './styles/layout.css';
import './styles/workspace.css';
import './styles/dialogs.css';
import './styles/terminal.css';
import './styles/files.css';
import './styles/viewer.css';
import './styles/preview.css';
import './styles/approvals.css';

initToken();
const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
