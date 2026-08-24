import React, { useState } from 'react';
import FlashPagoLanding from './Flashpagolanding';
import Login from './Login';
import Registro from './Registro';
import Dashboard from './Dashboard';
import Terminos from './Terminos';
import './App.css';

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
    return <FlashPagoLanding onLogin={() => setVista('login')} onRegistro={() => setVista('registro')} onTerminos={() => setVista('terminos')} />;
  }

  if (vista === 'terminos') {
    return <Terminos onVolver={() => setVista('landing')} />;
  }

  if (vista === 'registro') {
    return <Registro onBack={() => setVista('login')} />;
  }

  if (vista === 'login') {
    return <Login onLogin={() => setVista('dashboard')} onRegistro={() => setVista('registro')} />;
  }

  return <Dashboard onLogout={handleLogout} />;
}

export default App;