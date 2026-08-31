import React, { useState } from 'react';
import { CreditCard, Download, LayoutDashboard, LogOut, Search, TrendingUp, Users, AlertTriangle, Menu, X, ShoppingBag, Settings, Building2, Sun, Moon } from 'lucide-react';

function Sidebar({ activeSection, isOpen, isAdmin, isSuperAdmin, paymentCount, userCount, negocioNombre, onSectionChange, onLogout, tema, onToggleTema }) {
  const [fijado, setFijado] = useState(() => {
    try {
      return localStorage.getItem('fp_sidebar_fijado') === '1';
    } catch {
      return false;
    }
  });
  const [hover, setHover] = useState(false);
  const expandido = fijado || hover || isOpen;

  const alternarFijado = () => {
    setFijado((prev) => {
      const nuevo = !prev;
      try {
        localStorage.setItem('fp_sidebar_fijado', nuevo ? '1' : '0');
      } catch {
        // localStorage no disponible (modo privado, etc.) — no pasa nada, solo no persiste
      }
      return nuevo;
    });
  };

  const menuItems = [
    { id: 'panel', icon: <LayoutDashboard size={18} />, label: 'Panel' },
    { id: 'pagos', icon: <CreditCard size={18} />, label: 'Pagos' },
    { id: 'ventas', icon: <ShoppingBag size={18} />, label: 'Ventas' },
    { id: 'estadisticas', icon: <TrendingUp size={18} />, label: 'Estadísticas' },
    { id: 'buscar', icon: <Search size={18} />, label: 'Buscar' },
    { id: 'exportar', icon: <Download size={18} />, label: 'Exportar' },
    { id: 'duplicados', icon: <AlertTriangle size={18} />, label: 'Duplicados' },
    ...(isAdmin ? [{ id: 'usuarios', icon: <Users size={18} />, label: 'Usuarios' }] : []),
    ...(isAdmin ? [{ id: 'configuracion', icon: <Settings size={18} />, label: 'Configuración' }] : []),
    ...(isSuperAdmin ? [{ id: 'negocios', icon: <Building2 size={18} />, label: 'Negocios' }] : []),
  ];

  return (
    <aside
      className={`sidebar ${isOpen ? 'sidebar-open' : ''} ${expandido ? 'sidebar-expanded' : 'sidebar-collapsed'}`}
      onMouseEnter={() => { if (!fijado) setHover(true); }}
      onMouseLeave={() => { if (!fijado) setHover(false); }}
    >
      <div className="sidebar-header">
        <div className="sidebar-logo" style={{ justifyContent: expandido ? 'flex-start' : 'center' }}>
          <button onClick={alternarFijado}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 4, display: 'flex', flexShrink: 0 }}>
            {fijado ? <X size={20} /> : <Menu size={20} />}
          </button>
          {expandido && (
            <>
              <div className="sidebar-logo-icon-box">
                <img src="/logo.png" alt="FlashPago" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
              </div>
              <div>
                <div className="sidebar-logo-text">Flash<span>Pago</span></div>
                <div className="sidebar-logo-sub">Panel de control</div>
              </div>
            </>
          )}
        </div>
      </div>

      {negocioNombre && (
        <div className="sidebar-negocio" style={{ justifyContent: expandido ? 'flex-start' : 'center' }}>
          <div className="sidebar-negocio-avatar" title={!expandido ? negocioNombre : ''}>
            {negocioNombre.trim().charAt(0).toUpperCase()}
          </div>
          {expandido && (
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-negocio-label">Tu negocio</div>
              <div className="sidebar-negocio-nombre" title={negocioNombre}>{negocioNombre}</div>
            </div>
          )}
        </div>
      )}

      <nav className="sidebar-nav">
        {expandido && <div className="sidebar-section-label">MENÚ</div>}
        {menuItems.map(item => (
          <button
            key={item.id}
            className={`sidebar-item ${activeSection === item.id ? 'sidebar-item-active' : ''}`}
            onClick={() => { onSectionChange(item.id); if (!fijado) setHover(false); }}
            title={!expandido ? item.label : ''}
            aria-current={activeSection === item.id ? 'page' : undefined}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            {expandido && <span>{item.label}</span>}
            {expandido && item.id === 'pagos' && paymentCount > 0 && <span className="sidebar-badge">{paymentCount}</span>}
            {expandido && item.id === 'usuarios' && userCount > 0 && <span className="sidebar-badge">{userCount}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {expandido && <div className="sidebar-section-label">CUENTA</div>}
        <button
          className="sidebar-item"
          onClick={onToggleTema}
          title={!expandido ? (tema === 'dark' ? 'Modo claro' : 'Modo oscuro') : ''}
        >
          <span className="sidebar-item-icon">{tema === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</span>
          {expandido && <span>{tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>}
        </button>
        <button className="sidebar-item" onClick={onLogout} title={!expandido ? 'Cerrar sesión' : ''}>
          <span className="sidebar-item-icon"><LogOut size={18} /></span>
          {expandido && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;