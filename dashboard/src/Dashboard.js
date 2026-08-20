import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { CreditCard, TrendingUp, Search, Download, DollarSign, Calendar, CheckCircle, Shield, Trophy, BarChart3, Eye, X, Moon, Mail, Users, UserPlus, UserX, UserCheck, Edit, Trash2, Save, XCircle, AlertTriangle, Clock, Bell, Activity, Zap, Wifi, WifiOff } from 'lucide-react';
import { createApiClient } from './services/api';
import Sidebar from './components/Sidebar';
import DashboardHeader from './components/DashboardHeader';

function Dashboard({ onLogout }) {
  const getInitialSection = () => {
    if (typeof window === 'undefined') return 'panel';
    const params = new URLSearchParams(window.location.search);
    const seccion = params.get('seccion');
    return ['panel', 'pagos', 'estadisticas', 'buscar', 'exportar', 'duplicados', 'usuarios'].includes(seccion)
      ? seccion
      : 'panel';
  };

  const [diasGrafica, setDiasGrafica] = useState(30);
  const [totales, setTotales] = useState({ dia: { total: 0, cantidad: 0 }, mes: { total: 0, cantidad: 0 } });
  const userGuardado = JSON.parse(localStorage.getItem('fp_user') || '{}');
  const esAdmin = userGuardado.rol === 'admin';
  const [pagos, setPagos] = useState([]);
  const [duplicados, setDuplicados] = useState([]);
  const [duplicadosPendientes, setDuplicadosPendientes] = useState([]);
  const [pendientes, setPendientes] = useState({ cantidad: 0, total: 0 });
  const [stats, setStats] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [fotoActiva, setFotoActiva] = useState(null);
  const [seccionActiva, setSeccionActiva] = useState(getInitialSection);
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [sidebarFijado, setSidebarFijado] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);
  const sidebarExpandido = sidebarFijado || sidebarHover || sidebarAbierto;
  const [duplicadoSeleccionado, setDuplicadoSeleccionado] = useState(null);
  const [motivoRevision, setMotivoRevision] = useState('');
  const [guardandoRevision, setGuardandoRevision] = useState(false);

  // ─── Estado para Usuarios ──────────────────────────────
  const [usuarios, setUsuarios] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);
  const [mostrarFormUsuario, setMostrarFormUsuario] = useState(false);
  const [editandoUsuario, setEditandoUsuario] = useState(null);
  const [formUsuario, setFormUsuario] = useState({ usuario: '', password: '', nombre: '', rol: 'empleado', whatsapp: '' });
  const [errorUsuario, setErrorUsuario] = useState('');
  const [exitoUsuario, setExitoUsuario] = useState('');

  // ─── Estado para Plan y Gmail ──────────────────────────
  const [planInfo, setPlanInfo] = useState(null);
  const [gmailEstado, setGmailEstado] = useState(null);

  const api = useMemo(() => createApiClient(onLogout), [onLogout]);

  const cambiarSeccion = (nuevaSeccion) => {
    if (nuevaSeccion === seccionActiva) {
      setSidebarAbierto(false);
      return;
    }

    setSeccionActiva(nuevaSeccion);
    setSidebarAbierto(false);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('seccion', nuevaSeccion);
      window.history.pushState({ seccion: nuevaSeccion }, '', `${url.pathname}?${url.searchParams.toString()}`);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const url = new URL(window.location.href);
    if (!url.searchParams.get('seccion')) {
      url.searchParams.set('seccion', seccionActiva);
      window.history.replaceState({ seccion: seccionActiva }, '', `${url.pathname}?${url.searchParams.toString()}`);
    }

    const manejarPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const seccionDesdeUrl = params.get('seccion');
      const siguienteSeccion = ['panel', 'pagos', 'estadisticas', 'buscar', 'exportar', 'duplicados', 'usuarios'].includes(seccionDesdeUrl)
        ? seccionDesdeUrl
        : 'panel';
      setSeccionActiva(siguienteSeccion);
    };

    window.addEventListener('popstate', manejarPopState);
    return () => window.removeEventListener('popstate', manejarPopState);
  }, [seccionActiva]);

  useEffect(() => {
    if (seccionActiva !== 'duplicados') return undefined;

    const actualizarDuplicados = () => {
      cargarDuplicados();
    };

    actualizarDuplicados();
    const intervalo = setInterval(actualizarDuplicados, 30000);
    window.addEventListener('focus', actualizarDuplicados);

    return () => {
      clearInterval(intervalo);
      window.removeEventListener('focus', actualizarDuplicados);
    };
  }, [seccionActiva, api]);

  useEffect(() => {
    cargarDatos();
    const intervalo = setInterval(() => cargarDatos(), 30000);
    return () => clearInterval(intervalo);
  }, [diasGrafica, api]);

  useEffect(() => {
    if (seccionActiva === 'usuarios') cargarUsuarios();
  }, [seccionActiva]);

  const cargarDatos = async () => {
    try {
      const [resTotales, resPagos, resStats, resPendientes, resDuplicados, resPlan, resGmail] = await Promise.all([
        api.request('/api/dashboard/totales'),
        api.request('/api/dashboard/pagos?limite=20'),
        api.request(`/api/dashboard/stats?dias=${diasGrafica}`),
        api.request('/api/dashboard/pendientes'),
        api.request('/api/dashboard/duplicados?estado=PENDIENTE'),
        api.request('/api/negocios/uso/plan').catch(() => null),
        api.request('/api/gmail/estado').catch(() => null),
      ]);

      setTotales(resTotales || { dia: { total: 0, cantidad: 0 }, mes: { total: 0, cantidad: 0 } });
      setPagos(Array.isArray(resPagos) ? resPagos : []);
      setStats(Array.isArray(resStats) ? resStats : []);
      setPendientes(resPendientes || { cantidad: 0, total: 0 });
      setDuplicadosPendientes(Array.isArray(resDuplicados) ? resDuplicados : []);
      if (resPlan?.ok) setPlanInfo(resPlan);
      if (resGmail?.ok) setGmailEstado(resGmail);
      setCargando(false);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setCargando(false);
    }
  };

  const cargarDuplicados = async () => {
    try {
      const data = await api.request('/api/dashboard/duplicados');
      setDuplicados(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando duplicados:', err);
    }
  };

  const buscarCliente = async () => {
    if (!busqueda.trim()) return;
    try {
      const data = await api.request(`/api/dashboard/buscar/${encodeURIComponent(busqueda.trim())}`);
      setResultados(data);
    } catch (err) {
      console.error('Error buscando:', err);
    }
  };

  // ─── Funciones de Usuarios ─────────────────────────────
  const cargarUsuarios = async () => {
    setCargandoUsuarios(true);
    try {
      const data = await api.request('/api/usuarios');
      if (data.ok) setUsuarios(Array.isArray(data.usuarios) ? data.usuarios : []);
    } catch (err) {
      console.error('Error cargando usuarios:', err);
    }
    setCargandoUsuarios(false);
  };

  const exportarPagos = async () => {
    try {
      const blob = await api.download('/exportar');
      const url = window.URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = 'pagos.csv';
      enlace.click();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    } catch (err) {
      console.error('Error exportando pagos:', err);
    }
  };

  const revisarDuplicado = async (estado) => {
    if (!duplicadoSeleccionado || motivoRevision.trim().length < 3) return;
    setGuardandoRevision(true);
    try {
      await api.request(`/api/dashboard/duplicados/${duplicadoSeleccionado.id}/revision`, {
        method: 'POST',
        body: JSON.stringify({ estado, motivo: motivoRevision.trim() }),
      });
      setMotivoRevision('');
      setDuplicadoSeleccionado(null);
      await cargarDuplicados();
      await cargarDatos();
    } catch (err) {
      console.error('Error guardando revisión de duplicado:', err);
    } finally {
      setGuardandoRevision(false);
    }
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
      const data = await api.request('/api/usuarios', {
        method: 'POST',
        body: JSON.stringify(formUsuario),
      });

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

      const data = await api.request(`/api/usuarios/${editandoUsuario}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });

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
      const data = await api.request(`/api/usuarios/${id}`, { method: 'DELETE' });
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
      const data = await api.request(`/api/usuarios/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ activo: 1 }),
      });
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
    if (b.includes('breb') || b.includes('bre-b')) return { clase: 'badge-breb', nombre: 'Bre-B' };
    if (b.includes('avvillas') || b.includes('av villas')) return { clase: 'badge-avvillas', nombre: 'AV Villas' };
    if (b.includes('transfiya')) return { clase: 'badge-transfiya', nombre: 'Transfiya' };
    if (b.includes('nu')) return { clase: 'badge-nu', nombre: 'Nu' };
    return { clase: 'badge-otro', nombre: banco || 'Otro' };
  };

  const getPlanLabel = (plan) => {
    const labels = { basico: 'Básico', premium: 'Premium', empresarial: 'Empresarial' };
    return labels[plan] || plan;
  };

  const getPlanColor = (porcentaje) => {
    if (porcentaje >= 90) return '#E53935';
    if (porcentaje >= 70) return '#FF9800';
    return '#43A047';
  };

  const statsFormateados = stats.map(s => ({
    ...s,
    fecha: s.fecha ? s.fecha.slice(0, 5) : '',
    totalK: Math.round(s.total / 1000),
  }));

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

  return (
    <div className="layout">
      {sidebarAbierto && <div className="sidebar-overlay" onClick={() => setSidebarAbierto(false)} />}
      <Sidebar
        activeSection={seccionActiva}
        isOpen={sidebarAbierto}
        isAdmin={esAdmin}
        paymentCount={totales.dia.cantidad}
        userCount={usuarios.length}
        onSectionChange={(section) => cambiarSeccion(section)}
        onLogout={onLogout}
      />

      {/* MAIN CONTENT */}
      <main className="main-content">
        <DashboardHeader
          activeSection={seccionActiva}
          onToggleSidebar={() => setSidebarAbierto(!sidebarAbierto)}
        />

        <div className="main-body">
          {seccionActiva === 'duplicados' && (
            <div className="duplicados-layout">
              <div className="seccion duplicados-lista">
                <div className="seccion-header">
                  <h2 className="seccion-titulo"><AlertTriangle size={18} /> Casos para revisar</h2>
                  <span className="duplicados-count">{duplicados.length} casos</span>
                </div>
                {duplicados.length === 0 ? (
                  <p className="empty-state">No se han detectado duplicados. ¡Todo limpio!</p>
                ) : (
                  <div className="tabla-container">
                    <table className="tabla-pagos">
                      <thead><tr><th>Referencia</th><th>Cliente</th><th>Monto</th><th>Estado</th><th>Acción</th></tr></thead>
                      <tbody>
                        {duplicados.map((d) => {
                          const banco = getBancoBadge(d.banco);
                          return (
                            <tr key={d.id} className={duplicadoSeleccionado?.id === d.id ? 'fila-seleccionada' : ''}>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{d.referencia || '-'}</td>
                              <td>{d.nombre_cliente || 'Sin nombre'}<br /><span className="tabla-subtexto">{banco.nombre}</span></td>
                              <td className="td-monto">{formatearMonto(d.monto)}</td>
                              <td><span className={`revision-badge revision-${(d.revision_estado || 'PENDIENTE').toLowerCase()}`}>{d.revision_estado || 'PENDIENTE'}</span></td>
                              <td><button className="ver-foto-btn" onClick={() => setDuplicadoSeleccionado(d)}>Revisar</button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="seccion duplicado-detalle">
                <div className="seccion-header">
                  <h2 className="seccion-titulo"><Eye size={18} /> Detalle del caso</h2>
                  {duplicadoSeleccionado && <button className="modal-close-inline" onClick={() => setDuplicadoSeleccionado(null)}><X size={15} /></button>}
                </div>
                {!duplicadoSeleccionado ? (
                  <p className="empty-state">Selecciona un caso para revisar sus datos.</p>
                ) : (
                  <>
                    <div className="duplicado-resumen">
                      <strong>{duplicadoSeleccionado.referencia || 'Sin referencia'}</strong>
                      <span>{duplicadoSeleccionado.banco || 'Banco no indicado'} · {formatearMonto(duplicadoSeleccionado.monto)}</span>
                      <span>{duplicadoSeleccionado.fecha || '-'} {duplicadoSeleccionado.hora || ''}</span>
                    </div>
                    {duplicadoSeleccionado.foto && (
                      <button className="ver-foto-btn" onClick={() => setFotoActiva(duplicadoSeleccionado.foto)}>
                        <Eye size={14} /> Ver comprobante
                      </button>
                    )}
                    <label className="revision-label" htmlFor="motivo-revision">Motivo de la decisión</label>
                    <textarea
                      id="motivo-revision"
                      className="revision-motivo"
                      value={motivoRevision}
                      onChange={(event) => setMotivoRevision(event.target.value)}
                      placeholder="Explica brevemente la revisión..."
                      maxLength={500}
                    />
                    <div className="revision-acciones">
                      <button className="revision-btn revision-btn-danger" disabled={!esAdmin || guardandoRevision || motivoRevision.trim().length < 3} onClick={() => revisarDuplicado('DUPLICADO')}>
                        Confirmar duplicado
                      </button>
                      <button className="revision-btn revision-btn-success" disabled={!esAdmin || guardandoRevision || motivoRevision.trim().length < 3} onClick={() => revisarDuplicado('LEGITIMO')}>
                        Marcar como legítimo
                      </button>
                      {!esAdmin && <small>Solo un administrador puede guardar decisiones.</small>}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ─── PANEL GENERAL ────────────────────── */}
          {seccionActiva === 'panel' && (
            <>
              <div className="dashboard-intro">
                <div>
                  <h2>Buenos días, {userGuardado.nombre || userGuardado.usuario || 'Admin'} <span aria-hidden="true">👋</span></h2>
                  <p>Aquí tienes el resumen de actividad de FlashPago.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {gmailEstado && (
                    <div className="gmail-status-badge" style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.35rem 0.75rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
                      background: gmailEstado.conectado ? '#E8F5E9' : '#FFF3E0',
                      color: gmailEstado.conectado ? '#2E7D32' : '#E65100',
                    }}>
                      {gmailEstado.conectado ? <Wifi size={13} /> : <WifiOff size={13} />}
                      {gmailEstado.conectado ? `Gmail: ${gmailEstado.email}` : 'Gmail no conectado'}
                    </div>
                  )}
                  <div className="dashboard-live"><Activity size={15} /> Actualización automática</div>
                </div>
              </div>

              {/* ─── Barra de progreso del plan ────── */}
              {planInfo && (
                <div className="plan-usage-bar" style={{
                  background: '#fff', borderRadius: 12, padding: '1rem 1.25rem',
                  marginBottom: '1.25rem', border: '1px solid #e8e8f0',
                  display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Zap size={18} color="#F57C00" />
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1a1a2e' }}>
                      Plan {getPlanLabel(planInfo.plan)}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{
                      height: 8, background: '#f0f0f5', borderRadius: 4, overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${Math.min(planInfo.porcentaje, 100)}%`,
                        height: '100%',
                        background: getPlanColor(planInfo.porcentaje),
                        borderRadius: 4,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.8rem', fontWeight: 600,
                    color: getPlanColor(planInfo.porcentaje),
                  }}>
                    {planInfo.usados} / {planInfo.limite} comprobantes ({planInfo.porcentaje}%)
                  </span>
                </div>
              )}

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
                    <span className="tarjeta-sub">Tasa de éxito: —</span>
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
                <button
                  className="tarjeta tarjeta-clickable"
                  onClick={() => cambiarSeccion('duplicados')}
                  aria-label={`Ver ${duplicadosPendientes.length} duplicados pendientes`}
                >
                  <div className="tarjeta-icon-box tarjeta-icon-rojo">
                    <AlertTriangle size={22} />
                  </div>
                  <div className="tarjeta-info">
                    <span className="tarjeta-label">Duplicados</span>
                    <span className="tarjeta-valor">{duplicadosPendientes.length}</span>
                    <span className="tarjeta-sub">
                      {duplicadosPendientes.length > 0 ? 'Requieren revisión' : 'Ninguno pendiente'}
                    </span>
                  </div>
                </button>
              </div>

              <div className="dashboard-overview-grid">
                <div className="seccion dashboard-chart-card">
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
                <div className="seccion alertas-card">
                  <div className="seccion-header">
                    <h2 className="seccion-titulo"><Bell size={18} /> Alertas</h2>
                    <span className="alertas-count">{pendientes.cantidad + duplicadosPendientes.length}</span>
                  </div>
                  {pendientes.cantidad > 0 ? (
                    <div className="alerta-item alerta-item-danger">
                      <AlertTriangle size={17} />
                      <div>
                        <strong>{pendientes.cantidad} pago{pendientes.cantidad === 1 ? '' : 's'} pendiente{pendientes.cantidad === 1 ? '' : 's'}</strong>
                        <span>{formatearMonto(pendientes.total)} por verificar</span>
                      </div>
                    </div>
                  ) : duplicadosPendientes.length === 0 ? (
                    <div className="alerta-item alerta-item-success">
                      <CheckCircle size={17} />
                      <div>
                        <strong>Todo está al día</strong>
                        <span>No hay pagos pendientes</span>
                      </div>
                    </div>
                  ) : null}
                  {duplicadosPendientes.length > 0 && (
                    <div className="alerta-item alerta-item-warning">
                      <AlertTriangle size={17} />
                      <div>
                        <strong>{duplicadosPendientes.length} duplicado{duplicadosPendientes.length === 1 ? '' : 's'} detectado{duplicadosPendientes.length === 1 ? '' : 's'}</strong>
                        <span>Revisar referencias repetidas</span>
                      </div>
                    </div>
                  )}

                  {/* Alerta de plan si está cerca del límite */}
                  {planInfo && planInfo.porcentaje >= 80 && (
                    <div className="alerta-item alerta-item-warning">
                      <Zap size={17} />
                      <div>
                        <strong>Plan {getPlanLabel(planInfo.plan)} al {planInfo.porcentaje}%</strong>
                        <span>{planInfo.limite - planInfo.usados} comprobantes restantes</span>
                      </div>
                    </div>
                  )}

                  <div className="alerta-item alerta-item-info">
                    <Activity size={17} />
                    <div>
                      <strong>Monitoreo activo</strong>
                      <span>Datos sincronizados cada 30 segundos</span>
                    </div>
                  </div>
                  <button className="alertas-link" onClick={() => cambiarSeccion(pendientes.cantidad > 0 ? 'pagos' : duplicadosPendientes.length > 0 ? 'duplicados' : 'panel')}>
                    {pendientes.cantidad > 0 ? 'Revisar pagos →' : duplicadosPendientes.length > 0 ? 'Revisar duplicados →' : 'Ver actividad →'}
                  </button>
                  <button className="alertas-link alertas-link-secondary" onClick={() => cambiarSeccion('duplicados')}>
                    Ver duplicados ({duplicadosPendientes.length}) →
                  </button>
                </div>
              </div>

              <div className="seccion">
                <div className="seccion-header">
                  <h2 className="seccion-titulo"><CreditCard size={18} /> Últimos pagos</h2>
                  <button className="ver-mas-btn" onClick={() => cambiarSeccion('pagos')}>Ver todos →</button>
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
                <button className="exportar-btn" onClick={exportarPagos}>
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
                <h2 className="seccion-titulo"><TrendingUp size={18} /> Tendencia de ventas ({diasGrafica} días)</h2>
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
                <button className="exportar-btn" onClick={exportarPagos}>
                  <Download size={14} /> Exportar Excel
                </button>
              </div>
            </div>
          )}

          {/* ─── USUARIOS ────────────────────────── */}
          {seccionActiva === 'usuarios' && (
            <>
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

              <div className="seccion">
                <div className="seccion-header">
                  <h2 className="seccion-titulo"><Users size={18} /> Usuarios del sistema</h2>
                  {!mostrarFormUsuario && (
                    <button className="exportar-btn" onClick={() => { setMostrarFormUsuario(true); setEditandoUsuario(null); setFormUsuario({ usuario: '', password: '', nombre: '', rol: 'empleado', whatsapp: '' }); }}>
                      <UserPlus size={14} /> Nuevo usuario
                    </button>
                  )}
                </div>

                {mostrarFormUsuario && (
                  <div className="usuario-form">
                    <h3 className="usuario-form-titulo">
                      {editandoUsuario ? <><Edit size={16} /> Editar usuario</> : <><UserPlus size={16} /> Crear nuevo usuario</>}
                    </h3>
                    <div className="usuario-form-grid">
                      <div className="usuario-form-campo">
                        <label>Nombre completo</label>
                        <input type="text" placeholder="Ej: Kevin Ramírez" value={formUsuario.nombre} onChange={(e) => setFormUsuario({ ...formUsuario, nombre: e.target.value })} />
                      </div>
                      <div className="usuario-form-campo">
                        <label>Usuario (login)</label>
                        <input type="text" placeholder="Ej: kevin" value={formUsuario.usuario} onChange={(e) => setFormUsuario({ ...formUsuario, usuario: e.target.value })} disabled={!!editandoUsuario} />
                      </div>
                      <div className="usuario-form-campo">
                        <label>{editandoUsuario ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}</label>
                        <input type="password" placeholder={editandoUsuario ? '••••••' : 'Mínimo 6 caracteres'} value={formUsuario.password} onChange={(e) => setFormUsuario({ ...formUsuario, password: e.target.value })} />
                      </div>
                      <div className="usuario-form-campo">
                        <label>Rol</label>
                        <select value={formUsuario.rol} onChange={(e) => setFormUsuario({ ...formUsuario, rol: e.target.value })}>
                          <option value="empleado">Empleado</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </div>
                      <div className="usuario-form-campo">
                        <label>WhatsApp (opcional)</label>
                        <input type="text" placeholder="Ej: 573001234567@c.us" value={formUsuario.whatsapp} onChange={(e) => setFormUsuario({ ...formUsuario, whatsapp: e.target.value })} />
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