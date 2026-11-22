import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './app.css';
import { apiPromise } from './api/client.ts';
import { App } from './App.tsx';

apiPromise.then(api => createRoot(document.getElementById('root')!).render(<App api={api} />));
