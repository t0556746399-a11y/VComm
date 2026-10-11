import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import 'leaflet/dist/leaflet.css';
import './index.css';
import { queryClient } from './QueryClientProvider';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from './context/AuthContext';
import { FiltersProvider } from './context/FiltersContext';
import { AlertsProvider } from './context/AlertsContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
         <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                 <AuthProvider>
                    <AlertsProvider>
                       <FiltersProvider>

                           <App />

                       </FiltersProvider>
                    </AlertsProvider>
                 </AuthProvider>
            </BrowserRouter>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    </React.StrictMode>
);