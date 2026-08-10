import React from 'react';
import { AlertTriangle, CreditCard, Download, LayoutDashboard, Menu, Search, TrendingUp, Users } from 'lucide-react';

const titles = {
  panel: ['Panel general', LayoutDashboard],
  pagos: ['Pagos verificados', CreditCard],
  estadisticas: ['Estadísticas', TrendingUp],
  buscar: ['Buscar cliente', Search],
  exportar: ['Exportar datos', Download],
  duplicados: ['Duplicados detectados', AlertTriangle],
  usuarios: ['Gestión de usuarios', Users],
};

function DashboardHeader({ activeSection, onToggleSidebar }) {
  const [title, Icon] = titles[activeSection] || titles.panel;

  return (
    <header className="topbar">
      <button className="menu-toggle" onClick={onToggleSidebar} aria-label="Abrir menú">
        <Menu size={22} />
      </button>
      <h1 className="topbar-title"><Icon size={18} /> {title}</h1>
      <span className="topbar-fecha">
        {new Date().toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
      </span>
    </header>
  );
}

export default DashboardHeader;
