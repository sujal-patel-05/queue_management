import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Live from './pages/Live';
import Kitchen from './pages/Kitchen';
import MenuManage from './pages/MenuManage';
import Analytics from './pages/Analytics';
import SettingsPage from './pages/Settings';
import TokenDisplay from './pages/TokenDisplay';

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/display/:restaurantId" element={<TokenDisplay />} />
        <Route path="/" element={
          <ProtectedRoute><Layout /></ProtectedRoute>
        }>
          <Route index element={<Navigate to="/live" replace />} />
          <Route path="live" element={<Live />} />
          <Route path="kitchen" element={<Kitchen />} />
          <Route path="menu" element={<MenuManage />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="display" element={<TokenDisplay />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
