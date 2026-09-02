import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import FlashPagoLanding from './Flashpagolanding';
import Login from './Login';
import Registro from './Registro';
import RecuperarPassword from './RecuperarPassword';
import Dashboard from './Dashboard';
import Terminos from './Terminos';
import Privacidad from './Privacidad';
import './App.css';

const queryClient = new QueryClient();

function App() {
  const paramsUrl = new URLSearchParams(window.location.search);

  // El registro se puede completar en flashpago.co (landing), pero el
  // dashboard vive en app.flashpago.co — es otro origen y no comparte
  // localStorage, así que el token de auto-login llega por la URL en ese
  // salto entre dominios. Se guarda acá y se limpia la URL de inmediato.
  const tokenDeUrl = paramsUrl.get('token');
  const userDeUrl = paramsUrl.get('user');
  if (tokenDeUrl && userDeUrl) {
    localStorage.setItem('fp_token', tokenDeUrl);
    localStorage.setItem('fp_user', userDeUrl);
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    url.searchParams.delete('user');
    window.history.replaceState({}, '', url.toString());
  }

  // app.flashpago.co siempre es el dashboard; flashpago.co es la landing.
  // Se deja el chequeo de /panel como respaldo (bookmarks viejos, o si algún
  // día vuelven a compartir dominio).
  const esPanel = window.location.hostname.startsWith('app.') || window.location.pathname.startsWith('/panel');
  const vistaSolicitada = paramsUrl.get('vista');
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
    <QueryClientProvider client={queryClient}>
      {pantalla}
      <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
    </QueryClientProvider>
  );
}

export default App;