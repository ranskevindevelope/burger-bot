import React from 'react';
import { CreditCard, Download, LayoutDashboard, LogOut, Search, TrendingUp, Users, AlertTriangle, DollarSign } from 'lucide-react';

function Sidebar({ activeSection, isOpen, isAdmin, paymentCount, userCount, onSectionChange, onLogout }) {
  const menuItems = [
    { id: 'panel', icon: <LayoutDashboard size={18} />, label: 'Panel' },
    { id: 'pagos', icon: <CreditCard size={18} />, label: 'Pagos' },
    { id: 'estadisticas', icon: <TrendingUp size={18} />, label: 'Estadísticas' },
    { id: 'buscar', icon: <Search size={18} />, label: 'Buscar' },
    { id: 'exportar', icon: <Download size={18} />, label: 'Exportar' },
    { id: 'duplicados', icon: <AlertTriangle size={18} />, label: 'Duplicados' },
    ...(isAdmin ? [{ id: 'usuarios', icon: <Users size={18} />, label: 'Usuarios' }] : []),
  ];

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon-box">
            <DollarSign size={20} color="#fff" />
          </div>
          <div>
            <div className="sidebar-logo-text">Flash<span>Pago</span></div>
            <div className="sidebar-logo-sub">Panel de control</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">MENÚ</div>
        {menuItems.map(item => (
          <button
            key={item.id}
            className={`sidebar-item ${activeSection === item.id ? 'sidebar-item-active' : ''}`}
            onClick={() => onSectionChange(item.id)}
            aria-current={activeSection === item.id ? 'page' : undefined}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.id === 'pagos' && paymentCount > 0 && <span className="sidebar-badge">{paymentCount}</span>}
            {item.id === 'usuarios' && userCount > 0 && <span className="sidebar-badge">{userCount}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-section-label">CUENTA</div>
        <button className="sidebar-item" onClick={onLogout}>
          <span className="sidebar-item-icon"><LogOut size={18} /></span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
