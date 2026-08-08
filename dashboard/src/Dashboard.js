import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { LayoutDashboard, CreditCard, TrendingUp, Search, Download, LogOut, DollarSign, Calendar, CheckCircle, Shield, Trophy, BarChart3, Eye, X, Moon, Mail, Menu, Users, UserPlus, UserX, UserCheck, Edit, Trash2, Save, XCircle, AlertTriangle, Clock} from 'lucide-react';

function Dashboard({ onLogout }) {
  const [diasGrafica, setDiasGrafica] = useState(30);
  const [totales, setTotales] = useState({ dia: { total: 0, cantidad: 0 }, mes: { total: 0, cantidad: 0 } });
  const userGuardado = JSON.parse(localStorage.getItem('fp_user') || '{}');
  const esAdmin = userGuardado.rol === 'admin';
  const [pagos, setPagos] = useState([]);
  const [duplicados, setDuplicados] = useState([]);
  const [pendientes, setPendientes] = useState({ cantidad: 0, total: 0 });
  const [stats, setStats] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [fotoActiva, setFotoActiva] = useState(null);
  const [seccionActiva, setSeccionActiva] = useState('panel');
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  // ─── Estado para Usuarios ──────────────────────────────
  const [usuarios, setUsuarios] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);
  const [mostrarFormUsuario, setMostrarFormUsuario] = useState(false);
  const [editandoUsuario, setEditandoUsuario] = useState(null);
  const [formUsuario, setFormUsuario] = useState({ usuario: '', password: '', nombre: '', rol: 'empleado', whatsapp: '' });
  const [errorUsuario, setErrorUsuario] = useState('');
  const [exitoUsuario, setExitoUsuario] = useState('');

  const token = localStorage.getItem('fp_token');
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
  if (seccionActiva === 'duplicados') {
    fetch('/api/dashboard/duplicados', { headers })
      .then(res => res.json())
      .then(data => setDuplicados(data))
      .catch(err => console.error(err));
  }
}, [seccionActiva]);

  useEffect(() => {
    cargarDatos();
    const intervalo = setInterval(cargarDatos, 30000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [diasGrafica]);

  useEffect(() => {
    if (seccionActiva === 'usuarios') cargarUsuarios();
  }, [seccionActiva]);

  const cargarDatos = async () => {
    try {
      const [resTotales, resPagos, resStats, resPendientes] = await Promise.all([
        fetch('/api/dashboard/totales', { headers }),
        fetch('/api/dashboard/pagos?limite=20', { headers }),
        fetch(`/api/dashboard/stats?dias=${diasGrafica}`, { headers }),
        fetch('/api/dashboard/pendientes', { headers }),
      ]);
      setTotales(await resTotales.json());
      setPagos(await resPagos.json());
      setStats(await resStats.json());
      setPendientes(await resPendientes.json());
      setCargando(false);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setCargando(false);
    }
  };

  const buscarCliente = async () => {
    if (!busqueda.trim()) return;
    try {
      const res = await fetch(`/api/dashboard/buscar/${busqueda}`, { headers });
      const data = await res.json();
      setResultados(data);
    } catch (err) {
      console.error('Error buscando:', err);
    }
  };

  // ─── Funciones de Usuarios ─────────────────────────────
  const cargarUsuarios = async () => {
    setCargandoUsuarios(true);
    try {
      const res = await fetch('/api/usuarios', { headers });
      const data = await res.json();
      if (data.ok) setUsuarios(data.usuarios);
    } catch (err) {
      console.error('Error cargando usuarios:', err);
    }
    setCargandoUsuarios(false);
  };

  const crearUsuario = async () => {
    setErrorUsuario('');
    setExitoUsuario('');

    if (!formUsuario.usuario || !formUsuario.password || !formUsuario.nombre) {
      setErrorUsuario('Usuario, contraseña y nombre son requeridos');
      return;
    }
    if (formUsuario.password.length < 6) {
      setErrorUsuario('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers,
        body: JSON.stringify(formUsuario),
      });
      const data = await res.json();

      if (data.ok) {
        setExitoUsuario(`Usuario "${formUsuario.usuario}" creado exitosamente`);
        setFormUsuario({ usuario: '', password: '', nombre: '', rol: 'empleado', whatsapp: '' });
        setMostrarFormUsuario(false);
        cargarUsuarios();
        setTimeout(() => setExitoUsuario(''), 3000);
      } else {
        setErrorUsuario(data.error || 'Error creando usuario');
      }
    } catch (err) {
      setErrorUsuario('Error de conexión');
    }
  };

  const actualizarUsuario = async () => {
    setErrorUsuario('');
    try {
      const body = { nombre: formUsuario.nombre, rol: formUsuario.rol, whatsapp: formUsuario.whatsapp };
      if (formUsuario.password) body.password = formUsuario.password;

      const res = await fetch(`/api/usuarios/${editandoUsuario}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.ok) {
        setExitoUsuario('Usuario actualizado');
        setEditandoUsuario(null);
        setMostrarFormUsuario(false);
        setFormUsuario({ usuario: '', password: '', nombre: '', rol: 'empleado', whatsapp: '' });
        cargarUsuarios();
        setTimeout(() => setExitoUsuario(''), 3000);
      } else {
        setErrorUsuario(data.error || 'Error actualizando');
      }
    } catch (err) {
      setErrorUsuario('Error de conexión');
    }
  };

  const desactivarUsuario = async (id, nombre) => {
    if (!window.confirm(`¿Desactivar al usuario "${nombre}"?`)) return;
    try {
      const res = await fetch(`/api/usuarios/${id}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (data.ok) {
        setExitoUsuario(`Usuario "${nombre}" desactivado`);
        cargarUsuarios();
        setTimeout(() => setExitoUsuario(''), 3000);
      } else {
        setErrorUsuario(data.error);
      }
    } catch (err) {
      setErrorUsuario('Error de conexión');
    }
  };

  const reactivarUsuario = async (id) => {
    try {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ activo: 1 }),
      });
      const data = await res.json();
      if (data.ok) {
        setExitoUsuario('Usuario reactivado');
        cargarUsuarios();
        setTimeout(() => setExitoUsuario(''), 3000);
      }
    } catch (err) {
      setErrorUsuario('Error de conexión');
    }
  };

  const iniciarEdicion = (user) => {
    setEditandoUsuario(user.id);
    setFormUsuario({ usuario: user.usuario, password: '', nombre: user.nombre, rol: user.rol, whatsapp: user.whatsapp || '' });
    setMostrarFormUsuario(true);
    setErrorUsuario('');
  };

  const cancelarForm = () => {
    setMostrarFormUsuario(false);
    setEditandoUsuario(null);
    setFormUsuario({ usuario: '', password: '', nombre: '', rol: 'empleado', whatsapp: '' });
    setErrorUsuario('');
  };

  const formatearMonto = (monto) => '$' + Number(monto).toLocaleString('es-CO');

  const getBancoBadge = (banco) => {
    const b = (banco || '').toLowerCase();
    if (b.includes('nequi')) return { clase: 'badge-nequi', nombre: 'Nequi' };
    if (b.includes('bancolombia')) return { clase: 'badge-bancolombia', nombre: 'Bancolombia' };
    if (b.includes('daviplata') || b.includes('davi')) return { clase: 'badge-daviplata', nombre: 'Daviplata' };
    if (b.includes('avvillas') || b.includes('av villas') || b.includes('bre')) return { clase: 'badge-avvillas', nombre: 'AV Villas' };
    if (b.includes('transfiya')) return { clase: 'badge-transfiya', nombre: 'Transfiya' };
    return { clase: 'badge-otro', nombre: banco || 'Otro' };
  };

  const statsFormateados = stats.map(s => ({
    ...s,
    fecha: s.fecha ? s.fecha.slice(0, 5) : '',
    totalK: Math.round(s.total / 1000),
  }));

  /////// BARRA CARGANDO SPLASH/////
  if (cargando) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh',
      background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)'
    }}>
      <img src="/logo.png" alt="FlashPago"
        style={{ width: 80, height: 80, animation: 'pulse 1.5s infinite', marginBottom: '1.5rem' }}
      />
      <h2 style={{ color: '#F57C00', fontFamily: "'Space Grotesk',sans-serif", fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        FlashPago
      </h2>
      <p style={{ color: '#b0b0c8', fontSize: '0.9rem' }}>Cargando panel...</p>
      <div style={{
        width: 200, height: 4, background: 'rgba(255,255,255,0.1)',
        borderRadius: 4, marginTop: '1.5rem', overflow: 'hidden'
      }}>
        <div style={{
          width: '40%', height: '100%', background: '#F57C00',
          borderRadius: 4, animation: 'loadingBar 1.5s infinite ease-in-out'
        }} />
      </div>
    </div>
  );
}

  const menuItems = [
  { id: 'panel', icon: <LayoutDashboard size={18} />, label: 'Panel' },
  { id: 'pagos', icon: <CreditCard size={18} />, label: 'Pagos' },
  { id: 'estadisticas', icon: <TrendingUp size={18} />, label: 'Estadísticas' },
  { id: 'buscar', icon: <Search size={18} />, label: 'Buscar' },
  { id: 'exportar', icon: <Download size={18} />, label: 'Exportar' },
  { id: 'duplicados', icon: <AlertTriangle size={18} />, label: 'Duplicados' },
  ...(esAdmin ? [{ id: 'usuarios', icon: <Users size={18} />, label: 'Usuarios' }] : []),
];

  return (
    <div className="layout">
      {sidebarAbierto && <div className="sidebar-overlay" onClick={() => setSidebarAbierto(false)} />}

      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarAbierto ? 'sidebar-open' : ''}`}>
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
              className={`sidebar-item ${seccionActiva === item.id ? 'sidebar-item-active' : ''}`}
              onClick={() => { setSeccionActiva(item.id); setSidebarAbierto(false); }}
            >
              <span className="sidebar-item-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'pagos' && totales.dia.cantidad > 0 && <span className="sidebar-badge">{totales.dia.cantidad}</span>}
              {item.id === 'usuarios' && usuarios.length > 0 && <span className="sidebar-badge">{usuarios.length}</span>}
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

      {/* MAIN CONTENT */}
      <main className="main-content">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setSidebarAbierto(!sidebarAbierto)}>
            <Menu size={22} />
          </button>
          <h1 className="topbar-title">
            {seccionActiva === 'panel' && <><LayoutDashboard size={18} /> Panel general</>}
            {seccionActiva === 'pagos' && <><CreditCard size={18} /> Pagos verificados</>}
            {seccionActiva === 'estadisticas' && <><TrendingUp size={18} /> Estadísticas</>}
            {seccionActiva === 'buscar' && <><Search size={18} /> Buscar cliente</>}
            {seccionActiva === 'exportar' && <><Download size={18} /> Exportar datos</>}
            {seccionActiva === 'duplicados' && <><AlertTriangle size={18} /> Duplicados detectados</>}
            {seccionActiva === 'usuarios' && <><Users size={18} /> Gestión de usuarios</>}
          </h1>
          <span className="topbar-fecha">
            {new Date().toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </header>

        <div className="main-body">
        {seccionActiva === 'duplicados' && (
  <div className="seccion">
    <h2 className="seccion-titulo"><AlertTriangle size={18} /> Intentos de duplicado</h2>
    {duplicados.length === 0 ? (
      <p style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
        No se han detectado duplicados. ¡Todo limpio!
      </p>
    ) : (
      <div className="tabla-container">
        <table className="tabla-pagos">
          <thead>
            <tr><th>Referencia</th><th>Monto</th><th>Banco</th><th>Fecha</th><th>Hora</th><th>Empleado</th></tr>
          </thead>
          <tbody>
            {duplicados.map((d, i) => {
              const banco = getBancoBadge(d.banco);
              return (
                <tr key={i}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{d.referencia}</td>
                  <td className="td-monto">{formatearMonto(d.monto)}</td>
                  <td><span className={`banco-badge ${banco.clase}`}>{banco.nombre}</span></td>
                  <td>{d.fecha}</td>
                  <td>{d.hora}</td>
                  <td style={{ fontSize: '0.8rem' }}>{d.verificado_por || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}

          {/* ─── PANEL GENERAL ────────────────────── */}
          {seccionActiva === 'panel' && (
            <>
              <div className="tarjetas-grid">
                <div className="tarjeta tarjeta-accent">
                  <div className="tarjeta-icon-box tarjeta-icon-naranja"><DollarSign size={22} /></div>
                  <div className="tarjeta-info">
                    <span className="tarjeta-label">Hoy</span>
                    <span className="tarjeta-valor">{formatearMonto(totales.dia.total)}</span>
                    <span className="tarjeta-sub">{totales.dia.cantidad} pagos verificados</span>
                  </div>
                </div>

                <div className="tarjeta">
                  <div className="tarjeta-icon-box tarjeta-icon-azul"><Calendar size={22} /></div>
                  <div className="tarjeta-info">
                    <span className="tarjeta-label">Últimos 30 días</span>
                    <span className="tarjeta-valor">{formatearMonto(totales.mes.total)}</span>
                    <span className="tarjeta-sub">{totales.mes.cantidad} pagos</span>
                  </div>
                </div>
                <div className="tarjeta">
                  <div className="tarjeta-icon-box tarjeta-icon-verde"><CheckCircle size={22} /></div>
                  <div className="tarjeta-info">
                    <span className="tarjeta-label">Verificados</span>
                    <span className="tarjeta-valor">{totales.mes.cantidad}</span>
                    <span className="tarjeta-sub">Tasa de éxito: 94%</span>
                  </div>
                </div>

                <div className="tarjeta">
                  <div className="tarjeta-icon-box tarjeta-icon-morado"><Shield size={22} /></div>
                  <div className="tarjeta-info">
                    <span className="tarjeta-label">Ticket promedio</span>
                    <span className="tarjeta-valor">
                      {totales.mes.cantidad > 0 ? formatearMonto(Math.round(totales.mes.total / totales.mes.cantidad)) : '$0'}
                    </span>
                    <span className="tarjeta-sub">Promedio por pago</span>
                  </div>
                </div>

               <div className="tarjeta" style={pendientes.cantidad > 0 ? { borderLeft: '3px solid #E53935' } : {}}>
                  <div className="tarjeta-icon-box tarjeta-icon-naranja" style={pendientes.cantidad > 0 ? { background: '#FFEBEE' } : {}}>
                    <Clock size={22} color={pendientes.cantidad > 0 ? '#E53935' : '#F57C00'} />
                  </div>
                  <div className="tarjeta-info">
                    <span className="tarjeta-label">Pendientes</span>
                    <span className="tarjeta-valor" style={pendientes.cantidad > 0 ? { color: '#E53935' } : {}}>
                      {pendientes.cantidad}
                    </span>
                    <span className="tarjeta-sub">
                      {pendientes.cantidad > 0 ? `${formatearMonto(pendientes.total)} por verificar` : 'Todo verificado'}
                    </span>
                  </div>
                </div>
                </div>
                

              <div className="seccion">
             <div className="seccion-header">
             <h2 className="seccion-titulo"><BarChart3 size={18} /> Ventas por día</h2>
             <div style={{ display: 'flex', gap: '0.4rem' }}>
             {[7, 15, 30].map(d => (
            <button
            key={d}
            onClick={() => setDiasGrafica(d)}
            style={{
            padding: '0.35rem 0.75rem',
            borderRadius: 8,
            border: diasGrafica === d ? 'none' : '2px solid #e8e8f0',
            background: diasGrafica === d ? '#F57C00' : 'transparent',
            color: diasGrafica === d ? 'white' : '#4a4a68',
            fontWeight: 600,
            fontSize: '0.8rem',
            cursor: 'pointer',
           }}
          >
           {d}d
        </button>
      ))}
    </div>
  </div>
  <div className="grafica-container">
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={statsFormateados}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `$${v}k`} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value) => [formatearMonto(value * 1000), 'Total']} />
        <Bar dataKey="totalK" fill="#F57C00" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
</div>

              <div className="seccion">
                <div className="seccion-header">
                  <h2 className="seccion-titulo"><CreditCard size={18} /> Últimos pagos</h2>
                  <button className="ver-mas-btn" onClick={() => setSeccionActiva('pagos')}>Ver todos →</button>
                </div>
                <div className="tabla-container">
                  <table className="tabla-pagos">
                    <thead><tr><th>Cliente</th><th>Monto</th><th>Banco</th><th>Hora</th></tr></thead>
                    <tbody>
                      {pagos.slice(0, 5).map((pago) => {
                        const banco = getBancoBadge(pago.banco);
                        return (
                          <tr key={pago.id}>
                            <td className="td-cliente">{pago.nombre_cliente || 'Sin nombre'}</td>
                            <td className="td-monto">{formatearMonto(pago.monto)}</td>
                            <td><span className={`banco-badge ${banco.clase}`}>{banco.nombre}</span></td>
                            <td>{pago.hora || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ─── PAGOS ───────────────────────────── */}
          {seccionActiva === 'pagos' && (
            <div className="seccion">
              <div className="seccion-header">
                <h2 className="seccion-titulo">Todos los pagos</h2>
                <button className="exportar-btn" onClick={async () => {
               const res = await fetch('/exportar', { headers });
               const blob = await res.blob();
               const url = window.URL.createObjectURL(blob);
               const a = document.createElement('a');
              a.href = url;
              a.download = 'pagos.csv';
              a.click();
              }}>
  <Download size={14} /> Exportar Excel
</button>
              </div>
              <div className="tabla-container">
                <table className="tabla-pagos">
                  <thead><tr><th>Cliente</th><th>Monto</th><th>Banco</th><th>Fecha</th><th>Hora</th><th>Fuente</th><th>Foto</th></tr></thead>
                  <tbody>
                    {pagos.map((pago) => {
                      const banco = getBancoBadge(pago.banco);
                      return (
                        <tr key={pago.id}>
                          <td className="td-cliente">{pago.nombre_cliente || 'Sin nombre'}</td>
                          <td className="td-monto">{formatearMonto(pago.monto)}</td>
                          <td><span className={`banco-badge ${banco.clase}`}>{banco.nombre}</span></td>
                          <td>{pago.fecha || '-'}</td>
                          <td>{pago.hora || '-'}</td>
                          <td>
                            <span className={`fuente-badge ${pago.fuente === 'gmail_nocturna' ? 'fuente-nocturna' : 'fuente-gmail'}`}>
                              {pago.fuente === 'gmail_nocturna' ? <><Moon size={11} /> asincronica</> : <><Mail size={11} /> Gmail</>}
                            </span>
                          </td>
                          <td>
                            {pago.foto ? (
                              <button className="ver-foto-btn" onClick={() => setFotoActiva(pago.foto)}><Eye size={13} /> Ver</button>
                            ) : (<span className="sin-foto">—</span>)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── ESTADÍSTICAS ────────────────────── */}
          {seccionActiva === 'estadisticas' && (
            <>
              <div className="tarjetas-grid">
                <div className="tarjeta tarjeta-accent">
                  <div className="tarjeta-icon-box tarjeta-icon-naranja"><DollarSign size={22} /></div>
                  <div className="tarjeta-info">
                    <span className="tarjeta-label">Total del mes</span>
                    <span className="tarjeta-valor">{formatearMonto(totales.mes.total)}</span>
                    <span className="tarjeta-sub">{totales.mes.cantidad} transacciones</span>
                  </div>
                </div>
                <div className="tarjeta">
                  <div className="tarjeta-icon-box tarjeta-icon-azul"><BarChart3 size={22} /></div>
                  <div className="tarjeta-info">
                    <span className="tarjeta-label">Promedio diario</span>
                    <span className="tarjeta-valor">
                      {stats.length > 0 ? formatearMonto(Math.round(totales.mes.total / stats.length)) : '$0'}
                    </span>
                    <span className="tarjeta-sub">{stats.length} días con ventas</span>
                  </div>
                </div>
                <div className="tarjeta">
                  <div className="tarjeta-icon-box tarjeta-icon-verde"><Trophy size={22} /></div>
                  <div className="tarjeta-info">
                    <span className="tarjeta-label">Mejor día</span>
                    <span className="tarjeta-valor">
                      {stats.length > 0 ? formatearMonto(Math.max(...stats.map(s => s.total))) : '$0'}
                    </span>
                    <span className="tarjeta-sub">Venta más alta en un día</span>
                  </div>
                </div>
                <div className="tarjeta">
                  <div className="tarjeta-icon-box tarjeta-icon-morado"><Shield size={22} /></div>
                  <div className="tarjeta-info">
                    <span className="tarjeta-label">Ticket promedio</span>
                    <span className="tarjeta-valor">
                      {totales.mes.cantidad > 0 ? formatearMonto(Math.round(totales.mes.total / totales.mes.cantidad)) : '$0'}
                    </span>
                    <span className="tarjeta-sub">Por transacción</span>
                   
                  </div>
                </div>
  

              </div>
              <div className="seccion">
                <h2 className="seccion-titulo"><TrendingUp size={18} /> Tendencia de ventas (30 días)</h2>
                <div className="grafica-container">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={statsFormateados}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `$${v}k`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => [formatearMonto(value * 1000), 'Total']} />
                      <Bar dataKey="totalK" fill="#F57C00" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* ─── BUSCAR ──────────────────────────── */}
          {seccionActiva === 'buscar' && (
            <div className="seccion">
              <h2 className="seccion-titulo">Buscar pagos por cliente</h2>
              <div className="buscador">
                <input
                  type="text"
                  placeholder="Nombre del cliente..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && buscarCliente()}
                />
                <button onClick={buscarCliente}><Search size={16} /> Buscar</button>
              </div>
              {resultados && (
                <div className="resultados-busqueda">
                  {resultados.length === 0 ? (
                    <p className="sin-resultados">No se encontraron pagos para "{busqueda}"</p>
                  ) : (
                    <>
                      <p className="resultados-titulo">
                        {resultados.length} pago(s) de <strong>{resultados[0].nombre_cliente}</strong> —
                        Total: <strong>{formatearMonto(resultados.reduce((s, p) => s + p.monto, 0))}</strong>
                      </p>
                      <div className="tabla-container">
                        <table className="tabla-pagos">
                          <thead><tr><th>Monto</th><th>Banco</th><th>Fecha</th><th>Hora</th></tr></thead>
                          <tbody>
                            {resultados.map((p, i) => {
                              const banco = getBancoBadge(p.banco);
                              return (
                                <tr key={i}>
                                  <td className="td-monto">{formatearMonto(p.monto)}</td>
                                  <td><span className={`banco-badge ${banco.clase}`}>{banco.nombre}</span></td>
                                  <td>{p.fecha}</td>
                                  <td>{p.hora}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── EXPORTAR ────────────────────────── */}
          {seccionActiva === 'exportar' && (
            <div className="seccion exportar-seccion">
              <div className="exportar-card">
                <div className="exportar-icon-box"><Download size={32} color="#F57C00" /></div>
                <h2>Exportar pagos a Excel</h2>
                <p>Descarga un archivo con todos los pagos de los últimos 30 días. Se abre en Excel, Google Sheets o cualquier programa de hojas de cálculo.</p>
                <button className="exportar-btn" onClick={async () => {
               const res = await fetch('/exportar', { headers });
               const blob = await res.blob();
               const url = window.URL.createObjectURL(blob);
               const a = document.createElement('a');
               a.href = url;
               a.download = 'pagos.csv';
               a.click();
              }}>
             <Download size={14} /> Exportar Excel
            </button>

              </div>
            </div>
          )}

          {/* ─── USUARIOS ────────────────────────── */}
          {seccionActiva === 'usuarios' && (
            <>
              {/* Cards resumen */}
              <div className="tarjetas-grid">
                <div className="tarjeta tarjeta-accent">
                  <div className="tarjeta-icon-box tarjeta-icon-naranja"><Users size={22} /></div>
                  <div className="tarjeta-info">
                    <span className="tarjeta-label">Total usuarios</span>
                    <span className="tarjeta-valor">{usuarios.length}</span>
                    <span className="tarjeta-sub">Registrados</span>
                  </div>
                </div>
                <div className="tarjeta">
                  <div className="tarjeta-icon-box tarjeta-icon-verde"><UserCheck size={22} /></div>
                  <div className="tarjeta-info">
                    <span className="tarjeta-label">Activos</span>
                    <span className="tarjeta-valor">{usuarios.filter(u => u.activo).length}</span>
                    <span className="tarjeta-sub">Con acceso al sistema</span>
                  </div>
                </div>
                <div className="tarjeta">
                  <div className="tarjeta-icon-box tarjeta-icon-azul"><Shield size={22} /></div>
                  <div className="tarjeta-info">
                    <span className="tarjeta-label">Administradores</span>
                    <span className="tarjeta-valor">{usuarios.filter(u => u.rol === 'admin').length}</span>
                    <span className="tarjeta-sub">Acceso total</span>
                  </div>
                </div>
                <div className="tarjeta">
                  <div className="tarjeta-icon-box tarjeta-icon-morado"><CreditCard size={22} /></div>
                  <div className="tarjeta-info">
                    <span className="tarjeta-label">Empleados</span>
                    <span className="tarjeta-valor">{usuarios.filter(u => u.rol === 'empleado').length}</span>
                    <span className="tarjeta-sub">Acceso limitado</span>
                  </div>
                </div>
              </div>

              {/* Mensajes de éxito/error */}
              {exitoUsuario && (
                <div className="usuario-alerta usuario-exito">
                  <CheckCircle size={16} /> {exitoUsuario}
                </div>
              )}
              {errorUsuario && (
                <div className="usuario-alerta usuario-error">
                  <XCircle size={16} /> {errorUsuario}
                </div>
              )}

              {/* Botón crear + formulario */}
              <div className="seccion">
                <div className="seccion-header">
                  <h2 className="seccion-titulo"><Users size={18} /> Usuarios del sistema</h2>
                  {!mostrarFormUsuario && (
                    <button className="exportar-btn" onClick={() => { setMostrarFormUsuario(true); setEditandoUsuario(null); setFormUsuario({ usuario: '', password: '', nombre: '', rol: 'empleado', whatsapp: '' }); }}>
                      <UserPlus size={14} /> Nuevo usuario
                    </button>
                  )}
                </div>

                {/* Formulario crear/editar */}
                {mostrarFormUsuario && (
                  <div className="usuario-form">
                    <h3 className="usuario-form-titulo">
                      {editandoUsuario ? <><Edit size={16} /> Editar usuario</> : <><UserPlus size={16} /> Crear nuevo usuario</>}
                    </h3>
                    <div className="usuario-form-grid">
                      <div className="usuario-form-campo">
                        <label>Nombre completo</label>
                        <input
                          type="text"
                          placeholder="Ej: Kevin Ramírez"
                          value={formUsuario.nombre}
                          onChange={(e) => setFormUsuario({ ...formUsuario, nombre: e.target.value })}
                        />
                      </div>
                      <div className="usuario-form-campo">
                        <label>Usuario (login)</label>
                        <input
                          type="text"
                          placeholder="Ej: kevin"
                          value={formUsuario.usuario}
                          onChange={(e) => setFormUsuario({ ...formUsuario, usuario: e.target.value })}
                          disabled={!!editandoUsuario}
                        />
                      </div>
                      <div className="usuario-form-campo">
                        <label>{editandoUsuario ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}</label>
                        <input
                          type="password"
                          placeholder={editandoUsuario ? '••••••' : 'Mínimo 6 caracteres'}
                          value={formUsuario.password}
                          onChange={(e) => setFormUsuario({ ...formUsuario, password: e.target.value })}
                        />
                      </div>
                      <div className="usuario-form-campo">
                        <label>Rol</label>
                        <select
                          value={formUsuario.rol}
                          onChange={(e) => setFormUsuario({ ...formUsuario, rol: e.target.value })}
                        >
                          <option value="empleado">Empleado</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </div>
                      <div className="usuario-form-campo">
                        <label>WhatsApp (opcional)</label>
                        <input
                          type="text"
                          placeholder="Ej: 573001234567"
                          value={formUsuario.whatsapp}
                          onChange={(e) => setFormUsuario({ ...formUsuario, whatsapp: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="usuario-form-acciones">
                      <button className="usuario-btn-guardar" onClick={editandoUsuario ? actualizarUsuario : crearUsuario}>
                        <Save size={15} /> {editandoUsuario ? 'Guardar cambios' : 'Crear usuario'}
                      </button>
                      <button className="usuario-btn-cancelar" onClick={cancelarForm}>
                        <X size={15} /> Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Tabla de usuarios */}
                {cargandoUsuarios ? (
                  <p style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Cargando usuarios...</p>
                ) : (
                  <div className="tabla-container">
                    <table className="tabla-pagos">
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>Usuario</th>
                          <th>Rol</th>
                          <th>WhatsApp</th>
                          <th>Estado</th>
                          <th>Último login</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuarios.map(user => (
                          <tr key={user.id} style={!user.activo ? { opacity: 0.5 } : {}}>
                            <td className="td-cliente">{user.nombre}</td>
                            <td>{user.usuario}</td>
                            <td>
                              <span className={`banco-badge ${user.rol === 'admin' ? 'badge-bancolombia' : 'badge-nequi'}`}>
                                {user.rol === 'admin' ? 'Admin' : 'Empleado'}
                              </span>
                            </td>
                            <td>{user.whatsapp || '—'}</td>
                            <td>
                              <span className={`fuente-badge ${user.activo ? 'fuente-gmail' : 'fuente-nocturna'}`}>
                                {user.activo ? <><UserCheck size={11} /> Activo</> : <><UserX size={11} /> Inactivo</>}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.8rem' }}>{user.ultimo_login || 'Nunca'}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button className="ver-foto-btn" onClick={() => iniciarEdicion(user)} title="Editar">
                                  <Edit size={13} />
                                </button>
                                {user.activo ? (
                                  <button className="ver-foto-btn" onClick={() => desactivarUsuario(user.id, user.nombre)} title="Desactivar" style={{ color: '#E53935' }}>
                                    <Trash2 size={13} />
                                  </button>
                                ) : (
                                  <button className="ver-foto-btn" onClick={() => reactivarUsuario(user.id)} title="Reactivar" style={{ color: '#43A047' }}>
                                    <UserCheck size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </main>

      {/* MODAL DE FOTO */}
      {fotoActiva && (
        <div className="modal-overlay" onClick={() => setFotoActiva(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setFotoActiva(null)}><X size={16} /></button>
            <img src={`/api/comprobantes/${fotoActiva}?token=${localStorage.getItem('fp_token')}`} alt="Comprobante" />
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;