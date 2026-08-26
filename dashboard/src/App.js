import React, { useState } from 'react';
import FlashPagoLanding from './Flashpagolanding';
import Login from './Login';
import Registro from './Registro';
import RecuperarPassword from './RecuperarPassword';
import Dashboard from './Dashboard';
import Terminos from './Terminos';
import Privacidad from './Privacidad';
import './App.css';

function App() {
  const esPanel = window.location.pathname.startsWith('/panel');
  const vistaSolicitada = new URLSearchParams(window.location.search).get('vista');
  const [vista, setVista] = useState(
    ['terminos', 'privacidad'].includes(vistaSolicitada)
      ? vistaSolicitada
      : esPanel
        ? (localStorage.getItem('fp_token') ? 'dashboard' : 'login')
        : 'landing'
  );

  const handleLogout = () => {
    localStorage.removeItem('fp_token');
    localStorage.removeItem('fp_user');
    setVista('login');
  };

  if (vista === 'landing') {
    return <FlashPagoLanding onLogin={() => setVista('login')} onRegistro={() => setVista('registro')} onTerminos={() => setVista('terminos')} onPrivacidad={() => setVista('privacidad')} />;
  }

  if (vista === 'terminos') {
    return <Terminos onVolver={() => setVista('landing')} />;
  }

  if (vista === 'privacidad') {
    return <Privacidad onVolver={() => setVista('landing')} />;
  }

  if (vista === 'registro') {
    return <Registro onBack={() => setVista('login')} />;
  }

  if (vista === 'login') {
    return <Login onLogin={() => setVista('dashboard')} onRegistro={() => setVista('registro')} onRecuperar={() => setVista('recuperar')} />;
  }

  if (vista === 'recuperar') {
    return <RecuperarPassword onVolver={() => setVista('login')} />;
  }

  return <Dashboard onLogout={handleLogout} />;
}

export default App;