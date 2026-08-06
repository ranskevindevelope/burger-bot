import React, { useState } from 'react';
import FlashPagoLanding from './Flashpagolanding';
import Login from './Login';
import Dashboard from './Dashboard';
import './App.css';

function App() {
  const [vista, setVista] = useState('landing');

  if (vista === 'landing') {
    return <FlashPagoLanding onLogin={() => setVista('login')} />;
  }

  if (vista === 'login') {
    return <Login onLogin={() => setVista('dashboard')} />;
  }

  return <Dashboard onLogout={() => setVista('landing')} />;
}

export default App;