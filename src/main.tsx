import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import App from './App.tsx';
import { AppProvider } from './context/AppContext';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppProvider>
          <App />
          <Toaster theme="dark" position="bottom-right" />
        </AppProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);


