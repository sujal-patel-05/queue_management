import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Join from './pages/Join';
import QueueStatus from './pages/QueueStatus';
import Menu from './pages/Menu';
import OrderConfirmation from './pages/OrderConfirmation';

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/r/:slug" element={<Join />} />
        <Route path="/queue/:entryId" element={<QueueStatus />} />
        <Route path="/queue/:entryId/menu" element={<Menu />} />
        <Route path="/queue/:entryId/order/:orderId" element={<OrderConfirmation />} />
        <Route path="/" element={<Join />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
