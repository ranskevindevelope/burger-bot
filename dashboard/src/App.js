import React, { useState } from 'react';
import FlashPagoLanding from './Flashpagolanding';
import Login from './Login';
import Dashboard from './Dashboard';
import './App.css';
import Terminos from './Terminos';

function App() {
  const esPanel = window.location.pathname.startsWith('/panel');
  const [vista, setVista] = useState(
    esPanel
      ? (localStorage.getItem('fp_token') ? 'dashboard' : 'login')
      : 'landing'
  );

  const handleLogout = () => {
    localStorage.removeItem('fp_token');
    localStorage.removeItem('fp_user');
    setVista('login');
  };

  if (vista === 'landing') {
    return <FlashPagoLanding onLogin={() => setVista('login')} onTerminos={() => setVista('terminos')} />;
  }

  if (vista === 'terminos') {
    return <Terminos onVolver={() => setVista('landing')} />;
  }

  if (vista === 'login') {
    return <Login onLogin={() => setVista('dashboard')} />;
  }

  return <Dashboard onLogout={handleLogout} />;
}


export default App;