import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
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

  let pantalla;
  if (vista === 'landing') {
    pantalla = <FlashPagoLanding onLogin={() => setVista('login')} onRegistro={() => setVista('registro')} onTerminos={() => setVista('terminos')} onPrivacidad={() => setVista('privacidad')} />;
  } else if (vista === 'terminos') {
    pantalla = <Terminos onVolver={() => setVista('landing')} />;
  } else if (vista === 'privacidad') {
    pantalla = <Privacidad onVolver={() => setVista('landing')} />;
  } else if (vista === 'registro') {
    pantalla = <Registro onBack={() => setVista('login')} />;
  } else if (vista === 'login') {
    pantalla = <Login onLogin={() => setVista('dashboard')} onRegistro={() => setVista('registro')} onRecuperar={() => setVista('recuperar')} />;
  } else if (vista === 'recuperar') {
    pantalla = <RecuperarPassword onVolver={() => setVista('login')} />;
  } else {
    pantalla = <Dashboard onLogout={handleLogout} />;
  }

  return (
    <>
      {pantalla}
      <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
    </>
  );
}

export default App;