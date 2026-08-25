import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { CreditCard, TrendingUp, Search, Download, DollarSign, Calendar, CheckCircle, Shield, Trophy, BarChart3, Eye, X, Moon, Mail, Users, UserPlus, UserX, UserCheck, Edit, Trash2, Save, XCircle, AlertTriangle, Clock, Bell, Activity, Zap, Wifi, WifiOff, ShoppingBag, Receipt, Wallet, PlusCircle, MinusCircle, ArrowDownUp } from 'lucide-react';
import { createApiClient } from './services/api';
import Sidebar from './components/Sidebar';
import DashboardHeader from './components/DashboardHeader';

function Dashboard({ onLogout }) {
  const getInitialSection = () => {
    if (typeof window === 'undefined') return 'panel';
    const params = new URLSearchParams(window.location.search);
    const seccion = params.get('seccion');
    return ['panel', 'pagos', 'ventas', 'estadisticas', 'buscar', 'exportar', 'duplicados', 'usuarios'].includes(seccion)
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
  const [gmailCargando, setGmailCargando] = useState(false);
  const [gmailMensaje, setGmailMensaje] = useState('');

  // Detectar redirect de Gmail OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gmailResult = params.get('gmail');
    if (gmailResult === 'conectado') {
      setGmailMensaje('Gmail conectado exitosamente');
      setTimeout(() => setGmailMensaje(''), 4000);
      // Limpiar URL
      const url = new URL(window.location.href);
      url.searchParams.delete('gmail');
      window.history.replaceState({}, '', url.toString());
    } else if (gmailResult === 'error') {
      setGmailMensaje('Error conectando Gmail. Intenta de nuevo.');
      setTimeout(() => setGmailMensaje(''), 4000);
      const url = new URL(window.location.href);
      url.searchParams.delete('gmail');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // ─── Estado para Ventas (cierre de caja) ───────────────
  const [ventasResumen, setVentasResumen] = useState(null);
  const [ventasCierres, setVentasCierres] = useState([]);
  const [ventasSemanal, setVentasSemanal] = useState(null);
  const [ventasGastosCategorias, setVentasGastosCategorias] = useState([]);
  const [montoVentas, setMontoVentas] = useState('');
  const [notaCierre, setNotaCierre] = useState('');
  const [gastoMonto, setGastoMonto] = useState('');
  const [gastoCategoria, setGastoCategoria] = useState('general');
  const [gastoDescripcion, setGastoDescripcion] = useState('');
  const [guardandoCierre, setGuardandoCierre] = useState(false);
  const [guardandoGasto, setGuardandoGasto] = useState(false);
  const [ventasMensaje, setVentasMensaje] = useState({ tipo: '', texto: '' });
  const [ventasTab, setVentasTab] = useState('hoy');

  // ─── Estado para filtro por periodo ────────────────────
  const [periodoMes, setPeriodoMes] = useState(new Date().getMonth() + 1);
  const [periodoAnio, setPeriodoAnio] = useState(new Date().getFullYear());
  const [resumenPeriodo, setResumenPeriodo] = useState(null);
  const [statsPeriodo, setStatsPeriodo] = useState([]);
  const [pagosPeriodo, setPagosPeriodo] = useState([]);
  const [cargandoPeriodo, setCargandoPeriodo] = useState(false);

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
      const siguienteSeccion = ['panel', 'pagos', 'ventas', 'estadisticas', 'buscar', 'exportar', 'duplicados', 'usuarios'].includes(seccionDesdeUrl)
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

  useEffect(() => {
    if (seccionActiva === 'ventas') cargarVentas();
  }, [seccionActiva]);

  useEffect(() => {
    if (seccionActiva === 'estadisticas' || seccionActiva === 'pagos' || seccionActiva === 'panel') cargarPeriodo();
  }, [seccionActiva, periodoMes, periodoAnio]);

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

  // ─── Funciones de Gmail ──────────────────────────────────
  const conectarGmail = async () => {
    setGmailCargando(true);
    try {
      const token = localStorage.getItem('fp_token');
      const data = await api.request(`/api/gmail/auth-url?token=${token}`);
      if (data.ok && data.url) {
        window.location.href = data.url;
      } else {
        setGmailMensaje('Error obteniendo URL de Google');
        setTimeout(() => setGmailMensaje(''), 3000);
      }
    } catch (err) {
      setGmailMensaje('Error de conexión');
      setTimeout(() => setGmailMensaje(''), 3000);
    }
    setGmailCargando(false);
  };

  const desconectarGmail = async () => {
    if (!window.confirm('¿Desconectar Gmail? El bot no podrá verificar pagos automáticamente.')) return;
    try {
      const data = await api.request('/api/gmail/desconectar', { method: 'DELETE' });
      if (data.ok) {
        setGmailEstado({ ok: true, conectado: false, email: null });
        setGmailMensaje('Gmail desconectado');
        setTimeout(() => setGmailMensaje(''), 3000);
      }
    } catch (err) {
      setGmailMensaje('Error desconectando');
      setTimeout(() => setGmailMensaje(''), 3000);
    }
  };

  // ─── Funciones de Periodo ────────────────────────────────
  const cargarPeriodo = async () => {
    setCargandoPeriodo(true);
    const m = String(periodoMes).padStart(2, '0');
    const a = periodoAnio;
    try {
      const [resResumen, resStats, resPagos] = await Promise.all([
        api.request(`/api/dashboard/resumen-periodo?mes=${m}&anio=${a}`),
        api.request(`/api/dashboard/stats?mes=${m}&anio=${a}`),
        api.request(`/api/dashboard/pagos?mes=${m}&anio=${a}&limite=100`),
      ]);
      if (resResumen?.ok) setResumenPeriodo(resResumen);
      setStatsPeriodo(Array.isArray(resStats) ? resStats : []);
      setPagosPeriodo(Array.isArray(resPagos) ? resPagos : []);
    } catch (err) {
      console.error('Error cargando periodo:', err);
    }
    setCargandoPeriodo(false);
  };

  const mesesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const cambiarMes = (direccion) => {
    let nuevoMes = periodoMes + direccion;
    let nuevoAnio = periodoAnio;
    if (nuevoMes > 12) { nuevoMes = 1; nuevoAnio++; }
    if (nuevoMes < 1) { nuevoMes = 12; nuevoAnio--; }
    setPeriodoMes(nuevoMes);
    setPeriodoAnio(nuevoAnio);
  };

  const esMesActual = periodoMes === new Date().getMonth() + 1 && periodoAnio === new Date().getFullYear();

  // ─── Funciones de Ventas ─────────────────────────────────
  const cargarVentas = async () => {
    try {
      const [resResumen, resCierres, resSemanal, resCategorias] = await Promise.all([
        api.request('/api/ventas/resumen'),
        api.request('/api/ventas/cierres?dias=30'),
        api.request('/api/ventas/semanal'),
        api.request('/api/ventas/gastos/categorias'),
      ]);
      if (resResumen?.ok) setVentasResumen(resResumen);
      if (resCierres?.ok) setVentasCierres(resCierres.cierres || []);
      if (resSemanal?.ok) setVentasSemanal(resSemanal);
      if (resCategorias?.ok) setVentasGastosCategorias(resCategorias.categorias || []);
    } catch (err) {
      console.error('Error cargando ventas:', err);
    }
  };

  const hacerCierre = async () => {
    const monto = parseInt(montoVentas.replace(/[.,\s]/g, ''));
    if (!monto || monto <= 0) {
      setVentasMensaje({ tipo: 'error', texto: 'Ingresa el total de ventas del día' });
      return;
    }
    setGuardandoCierre(true);
    try {
      const data = await api.request('/api/ventas/cierre', {
        method: 'POST',
        body: JSON.stringify({ total_ventas: monto, nota: notaCierre.trim() || null }),
      });
      if (data.ok) {
        setVentasMensaje({ tipo: 'exito', texto: `Cierre guardado: $${monto.toLocaleString('es-CO')} en ventas` });
        setMontoVentas('');
        setNotaCierre('');
        cargarVentas();
        setTimeout(() => setVentasMensaje({ tipo: '', texto: '' }), 4000);
      } else {
        setVentasMensaje({ tipo: 'error', texto: data.error });
      }
    } catch (err) {
      setVentasMensaje({ tipo: 'error', texto: 'Error guardando el cierre' });
    }
    setGuardandoCierre(false);
  };

  const agregarGasto = async () => {
    const monto = parseInt(gastoMonto.replace(/[.,\s]/g, ''));
    if (!monto || monto <= 0) {
      setVentasMensaje({ tipo: 'error', texto: 'Ingresa el monto del gasto' });
      return;
    }
    if (!gastoDescripcion.trim()) {
      setVentasMensaje({ tipo: 'error', texto: 'Agrega una descripción del gasto' });
      return;
    }
    setGuardandoGasto(true);
    try {
      const data = await api.request('/api/ventas/gasto', {
        method: 'POST',
        body: JSON.stringify({ monto, categoria: gastoCategoria, descripcion: gastoDescripcion.trim() }),
      });
      if (data.ok) {
        setVentasMensaje({ tipo: 'exito', texto: `Gasto de $${monto.toLocaleString('es-CO')} registrado` });
        setGastoMonto('');
        setGastoDescripcion('');
        setGastoCategoria('general');
        cargarVentas();
        setTimeout(() => setVentasMensaje({ tipo: '', texto: '' }), 3000);
      } else {
        setVentasMensaje({ tipo: 'error', texto: data.error });
      }
    } catch (err) {
      setVentasMensaje({ tipo: 'error', texto: 'Error registrando gasto' });
    }
    setGuardandoGasto(false);
  };

  const eliminarGastoHandler = async (id) => {
    if (!window.confirm('¿Eliminar este gasto?')) return;
    try {
      const data = await api.request(`/api/ventas/gasto/${id}`, { method: 'DELETE' });
      if (data.ok) cargarVentas();
    } catch (err) {
      console.error('Error eliminando gasto:', err);
    }
  };

  const getCategoriaColor = (cat) => {
    const colores = {
      general: '#6B7280', insumos: '#F59E0B', nomina: '#3B82F6',
      servicios: '#8B5CF6', arriendo: '#EF4444', transporte: '#10B981', otro: '#9CA3AF',
    };
    return colores[cat] || '#6B7280';
  };

  const getCategoriaLabel = (cat) => {
    const labels = {
      general: 'General', insumos: 'Insumos', nomina: 'Nómina',
      servicios: 'Servicios', arriendo: 'Arriendo', transporte: 'Transporte', otro: 'Otro',
    };
    return labels[cat] || cat;
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
                    <button
                      onClick={gmailEstado.conectado ? desconectarGmail : conectarGmail}
                      disabled={gmailCargando}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.35rem 0.75rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
                        background: gmailEstado.conectado ? '#E8F5E9' : '#FFF3E0',
                        color: gmailEstado.conectado ? '#2E7D32' : '#E65100',
                        border: 'none', cursor: gmailCargando ? 'wait' : 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {gmailCargando ? '...' : gmailEstado.conectado ? <Wifi size={13} /> : <WifiOff size={13} />}
                      {gmailEstado.conectado ? `Gmail: ${gmailEstado.email}` : 'Conectar Gmail'}
                    </button>
                  )}
                  <div className="dashboard-live"><Activity size={15} /> Actualización automática</div>
                </div>
              </div>

              {/* ─── Banner de trial ────────────────── */}
              {planInfo?.trial && !planInfo.trial.pagado && planInfo.trial.trial_fin && (
                <div style={{
                  background: planInfo.trial.activo
                    ? planInfo.trial.dias <= 3 ? '#FFF3E0' : '#E3F2FD'
                    : '#FFEBEE',
                  border: `1px solid ${planInfo.trial.activo
                    ? planInfo.trial.dias <= 3 ? '#FFE0B2' : '#BBDEFB'
                    : '#FFCDD2'}`,
                  borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1rem',
                  display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: planInfo.trial.activo
                      ? planInfo.trial.dias <= 3 ? '#F57C00' : '#1565C0'
                      : '#E53935',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {planInfo.trial.activo
                      ? <Clock size={20} color="#fff" />
                      : <Shield size={20} color="#fff" />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{
                      fontWeight: 600, fontSize: '0.9rem',
                      color: planInfo.trial.activo
                        ? planInfo.trial.dias <= 3 ? '#E65100' : '#0D47A1'
                        : '#C62828',
                    }}>
                      {planInfo.trial.activo
                        ? `Prueba gratuita — ${planInfo.trial.dias} día${planInfo.trial.dias === 1 ? '' : 's'} restante${planInfo.trial.dias === 1 ? '' : 's'}`
                        : 'Tu prueba gratuita ha terminado'
                      }
                    </div>
                    <div style={{
                      fontSize: '0.78rem', marginTop: 2,
                      color: planInfo.trial.activo
                        ? planInfo.trial.dias <= 3 ? '#E65100' : '#1565C0'
                        : '#C62828',
                    }}>
                      {planInfo.trial.activo
                        ? planInfo.trial.dias <= 3
                          ? 'Elige un plan para seguir verificando sin interrupción.'
                          : `Tu periodo de prueba termina el ${new Date(planInfo.trial.trial_fin).toLocaleDateString('es-CO')}. Todas las funciones están activas.`
                        : 'El bot dejó de verificar comprobantes. Elige un plan para reactivar.'
                      }
                    </div>
                    {planInfo.trial.activo && (
                      <div style={{
                        height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 2,
                        overflow: 'hidden', marginTop: 6,
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          background: planInfo.trial.dias <= 3 ? '#F57C00' : '#1565C0',
                          width: `${Math.round(((15 - planInfo.trial.dias) / 15) * 100)}%`,
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                    )}
                  </div>
                  {(planInfo.trial.dias <= 3 || !planInfo.trial.activo) && (
                    <button
                      onClick={() => window.open('https://flashpago.duckdns.org/panel', '_self')}
                      style={{
                        padding: '0.6rem 1.25rem', borderRadius: 10, border: 'none',
                        background: !planInfo.trial.activo ? '#E53935' : '#F57C00',
                        color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                      }}
                    >
                      Elegir plan
                    </button>
                  )}
                </div>
              )}

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

              {/* Mensaje de Gmail */}
              {gmailMensaje && (
                <div style={{
                  padding: '0.75rem 1rem', borderRadius: 10, marginBottom: '1rem',
                  background: gmailMensaje.includes('Error') || gmailMensaje.includes('error') ? '#FFEBEE' : '#E8F5E9',
                  color: gmailMensaje.includes('Error') || gmailMensaje.includes('error') ? '#C62828' : '#2E7D32',
                  fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}>
                  {gmailMensaje.includes('Error') || gmailMensaje.includes('error') ? <WifiOff size={16} /> : <Wifi size={16} />}
                  {gmailMensaje}
                </div>
              )}

              {/* Tarjeta de conectar Gmail */}
              {gmailEstado && !gmailEstado.conectado && esAdmin && (
                <div style={{
                  background: '#fff', borderRadius: 12, padding: '1rem 1.25rem',
                  marginBottom: '1.25rem', border: '2px solid #FFF3E0',
                  display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, background: '#FFF3E0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Mail size={22} color="#E65100" />
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1a1a2e' }}>
                      Conecta tu Gmail para verificar pagos
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#666', marginTop: 2 }}>
                      FlashPago necesita leer las notificaciones de tu banco para verificar comprobantes automáticamente.
                    </div>
                  </div>
                  <button
                    onClick={conectarGmail}
                    disabled={gmailCargando}
                    style={{
                      padding: '0.6rem 1.25rem', borderRadius: 10, border: 'none',
                      background: '#F57C00', color: '#fff', fontWeight: 600, fontSize: '0.85rem',
                      cursor: gmailCargando ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                    }}
                  >
                    <Mail size={15} /> {gmailCargando ? 'Conectando...' : 'Conectar Gmail'}
                  </button>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button onClick={() => cambiarMes(-1)} style={{
                        width: 28, height: 28, borderRadius: 8, border: '2px solid #e8e8f0',
                        background: 'transparent', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', color: '#4a4a68',
                      }}>‹</button>
                      <div style={{
                        padding: '0.3rem 0.7rem', borderRadius: 8, background: '#F57C00',
                        color: '#fff', fontWeight: 600, fontSize: '0.75rem', minWidth: 100, textAlign: 'center',
                      }}>
                        {mesesNombres[periodoMes - 1]} {periodoAnio}
                      </div>
                      <button onClick={() => cambiarMes(1)} disabled={esMesActual} style={{
                        width: 28, height: 28, borderRadius: 8, border: '2px solid #e8e8f0',
                        background: 'transparent', cursor: esMesActual ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.9rem', color: '#4a4a68', opacity: esMesActual ? 0.3 : 1,
                      }}>›</button>
                    </div>
                  </div>
                  {/* Resumen rápido del periodo */}
                  {resumenPeriodo && (
                    <div style={{
                      display: 'flex', gap: '1rem', padding: '0.5rem 0 0.75rem',
                      borderBottom: '1px solid #f0f0f5', marginBottom: '0.5rem', flexWrap: 'wrap',
                    }}>
                      <div style={{ fontSize: '0.78rem', color: '#666' }}>
                        Total: <strong style={{ color: '#1a1a2e' }}>{formatearMonto(resumenPeriodo.total)}</strong>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#666' }}>
                        Pagos: <strong style={{ color: '#1a1a2e' }}>{resumenPeriodo.cantidad}</strong>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#666' }}>
                        Promedio: <strong style={{ color: '#1a1a2e' }}>{formatearMonto(resumenPeriodo.ticket_promedio)}</strong>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#666' }}>
                        Mejor: <strong style={{ color: '#2E7D32' }}>{formatearMonto(resumenPeriodo.pago_mas_alto)}</strong>
                      </div>
                    </div>
                  )}
                  <div className="grafica-container">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={statsPeriodo.length > 0 ? statsPeriodo.map(s => ({
                        ...s,
                        fecha: s.fecha ? s.fecha.slice(8, 10) + '/' + s.fecha.slice(5, 7) : (s.fecha || '').slice(0, 5),
                        totalK: Math.round(s.total / 1000),
                      })) : statsFormateados}>
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
            <>
              {/* Selector de mes */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => cambiarMes(-1)} style={{
                    width: 36, height: 36, borderRadius: 10, border: '2px solid #e8e8f0',
                    background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: '1.1rem' }}>‹</span>
                  </button>
                  <div style={{
                    padding: '0.5rem 1.25rem', borderRadius: 10, background: '#F57C00',
                    color: '#fff', fontWeight: 700, fontSize: '0.95rem', minWidth: 160, textAlign: 'center',
                  }}>
                    {mesesNombres[periodoMes - 1]} {periodoAnio}
                  </div>
                  <button onClick={() => cambiarMes(1)} disabled={esMesActual} style={{
                    width: 36, height: 36, borderRadius: 10, border: '2px solid #e8e8f0',
                    background: esMesActual ? '#f5f5f5' : '#fff', cursor: esMesActual ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: esMesActual ? 0.4 : 1,
                  }}>
                    <span style={{ fontSize: '1.1rem' }}>›</span>
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#666', fontWeight: 500 }}>
                    {pagosPeriodo.length} pagos — {formatearMonto(pagosPeriodo.reduce((s, p) => s + p.monto, 0))}
                  </span>
                  <button className="exportar-btn" onClick={exportarPagos}>
                    <Download size={14} /> Exportar
                  </button>
                </div>
              </div>
              <div className="seccion">
                <div className="tabla-container">
                  <table className="tabla-pagos">
                    <thead><tr><th>Cliente</th><th>Monto</th><th>Banco</th><th>Fecha</th><th>Hora</th><th>Fuente</th><th>Foto</th></tr></thead>
                    <tbody>
                      {pagosPeriodo.length === 0 ? (
                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>No hay pagos en {mesesNombres[periodoMes - 1]} {periodoAnio}</td></tr>
                      ) : (
                        pagosPeriodo.map((pago) => {
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
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ─── ESTADÍSTICAS ────────────────────── */}
          {seccionActiva === 'estadisticas' && (
            <>
              {/* Selector de mes */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => cambiarMes(-1)} style={{
                    width: 36, height: 36, borderRadius: 10, border: '2px solid #e8e8f0',
                    background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: '1.1rem' }}>‹</span>
                  </button>
                  <div style={{
                    padding: '0.5rem 1.25rem', borderRadius: 10, background: '#F57C00',
                    color: '#fff', fontWeight: 700, fontSize: '0.95rem', minWidth: 160, textAlign: 'center',
                  }}>
                    {mesesNombres[periodoMes - 1]} {periodoAnio}
                  </div>
                  <button onClick={() => cambiarMes(1)} disabled={esMesActual} style={{
                    width: 36, height: 36, borderRadius: 10, border: '2px solid #e8e8f0',
                    background: esMesActual ? '#f5f5f5' : '#fff', cursor: esMesActual ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: esMesActual ? 0.4 : 1,
                  }}>
                    <span style={{ fontSize: '1.1rem' }}>›</span>
                  </button>
                </div>
                {cargandoPeriodo && (
                  <span style={{ fontSize: '0.8rem', color: '#999' }}>Cargando...</span>
                )}
              </div>

              {/* Cards del periodo */}
              <div className="tarjetas-grid">
                <div className="tarjeta tarjeta-accent">
                  <div className="tarjeta-icon-box tarjeta-icon-naranja"><DollarSign size={22} /></div>
                  <div className="tarjeta-info">
                    <span className="tarjeta-label">Total {mesesNombres[periodoMes - 1]}</span>
                    <span className="tarjeta-valor">{formatearMonto(resumenPeriodo?.total || 0)}</span>
                    <span className="tarjeta-sub">{resumenPeriodo?.cantidad || 0} transacciones</span>
                  </div>
                </div>
                <div className="tarjeta">
                  <div className="tarjeta-icon-box tarjeta-icon-azul"><BarChart3 size={22} /></div>
                  <div className="tarjeta-info">
                    <span className="tarjeta-label">Promedio diario</span>
                    <span className="tarjeta-valor">
                      {resumenPeriodo?.dias_con_ventas > 0 ? formatearMonto(Math.round(resumenPeriodo.total / resumenPeriodo.dias_con_ventas)) : '$0'}
                    </span>
                    <span className="tarjeta-sub">{resumenPeriodo?.dias_con_ventas || 0} días con ventas</span>
                  </div>
                </div>
                <div className="tarjeta">
                  <div className="tarjeta-icon-box tarjeta-icon-verde"><Trophy size={22} /></div>
                  <div className="tarjeta-info">
                    <span className="tarjeta-label">Pago más alto</span>
                    <span className="tarjeta-valor">
                      {formatearMonto(resumenPeriodo?.pago_mas_alto || 0)}
                    </span>
                    <span className="tarjeta-sub">En una sola transacción</span>
                  </div>
                </div>
                <div className="tarjeta">
                  <div className="tarjeta-icon-box tarjeta-icon-morado"><Shield size={22} /></div>
                  <div className="tarjeta-info">
                    <span className="tarjeta-label">Ticket promedio</span>
                    <span className="tarjeta-valor">
                      {formatearMonto(resumenPeriodo?.ticket_promedio || 0)}
                    </span>
                    <span className="tarjeta-sub">Por transacción</span>
                  </div>
                </div>
              </div>

              {/* Gráfica del periodo */}
              <div className="seccion" style={{ marginBottom: '1.25rem' }}>
                <div className="seccion-header">
                  <h2 className="seccion-titulo"><TrendingUp size={18} /> Ventas por día — {mesesNombres[periodoMes - 1]} {periodoAnio}</h2>
                </div>
                {statsPeriodo.length === 0 ? (
                  <p className="empty-state">No hay ventas registradas en este mes.</p>
                ) : (
                  <div className="grafica-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={statsPeriodo.map(s => ({
                        ...s,
                        fecha: s.fecha ? s.fecha.slice(8, 10) + '/' + s.fecha.slice(5, 7) : '',
                        totalK: Math.round(s.total / 1000),
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `$${v}k`} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => [formatearMonto(value * 1000), 'Total']} />
                        <Bar dataKey="totalK" fill="#F57C00" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Bancos más usados */}
              {resumenPeriodo?.bancos?.length > 0 && (
                <div className="seccion">
                  <h2 className="seccion-titulo"><CreditCard size={18} /> Bancos más usados</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem' }}>
                    {resumenPeriodo.bancos.map((b) => {
                      const max = Math.max(...resumenPeriodo.bancos.map(x => x.total));
                      const pct = max > 0 ? Math.round((b.total / max) * 100) : 0;
                      const banco = getBancoBadge(b.banco);
                      return (
                        <div key={b.banco}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                              <span className={`banco-badge ${banco.clase}`} style={{ marginRight: '0.4rem' }}>{banco.nombre}</span>
                              {b.cantidad} pagos
                            </span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                              {formatearMonto(b.total)}
                            </span>
                          </div>
                          <div style={{ height: 8, background: '#f0f0f5', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{
                              width: `${pct}%`, height: '100%', background: '#F57C00',
                              borderRadius: 4, transition: 'width 0.5s ease',
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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

          {/* ─── VENTAS (Cierre de Caja) ────────── */}
          {seccionActiva === 'ventas' && (
            <>
              {/* Mensajes */}
              {ventasMensaje.texto && (
                <div className={`usuario-alerta ${ventasMensaje.tipo === 'exito' ? 'usuario-exito' : 'usuario-error'}`}>
                  {ventasMensaje.tipo === 'exito' ? <CheckCircle size={16} /> : <XCircle size={16} />} {ventasMensaje.texto}
                </div>
              )}

              {/* Tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {[
                  { id: 'hoy', label: 'Hoy', icon: <Receipt size={15} /> },
                  { id: 'historial', label: 'Historial', icon: <Calendar size={15} /> },
                  { id: 'gastos', label: 'Gastos', icon: <MinusCircle size={15} /> },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setVentasTab(tab.id)} style={{
                    padding: '0.5rem 1rem', borderRadius: 10, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600,
                    background: ventasTab === tab.id ? '#F57C00' : '#f0f0f5',
                    color: ventasTab === tab.id ? '#fff' : '#4a4a68',
                  }}>
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* ── TAB: HOY ──────────────────────────── */}
              {ventasTab === 'hoy' && (
                <>
                  {/* Cards resumen del día */}
                  <div className="tarjetas-grid">
                    <div className="tarjeta tarjeta-accent">
                      <div className="tarjeta-icon-box tarjeta-icon-naranja"><ArrowDownUp size={22} /></div>
                      <div className="tarjeta-info">
                        <span className="tarjeta-label">Transferencias hoy</span>
                        <span className="tarjeta-valor">{formatearMonto(ventasResumen?.transferencias?.total || 0)}</span>
                        <span className="tarjeta-sub">{ventasResumen?.transferencias?.cantidad || 0} verificadas</span>
                      </div>
                    </div>
                    <div className="tarjeta">
                      <div className="tarjeta-icon-box tarjeta-icon-rojo"><MinusCircle size={22} /></div>
                      <div className="tarjeta-info">
                        <span className="tarjeta-label">Gastos hoy</span>
                        <span className="tarjeta-valor" style={{ color: '#E53935' }}>{formatearMonto(ventasResumen?.gastos?.total || 0)}</span>
                        <span className="tarjeta-sub">{ventasResumen?.gastos?.cantidad || 0} registrados</span>
                      </div>
                    </div>
                    <div className="tarjeta">
                      <div className="tarjeta-icon-box tarjeta-icon-verde"><Wallet size={22} /></div>
                      <div className="tarjeta-info">
                        <span className="tarjeta-label">Efectivo esperado</span>
                        <span className="tarjeta-valor" style={{ color: '#43A047' }}>
                          {ventasResumen?.cierre
                            ? formatearMonto(ventasResumen.cierre.total_efectivo)
                            : '—'}
                        </span>
                        <span className="tarjeta-sub">{ventasResumen?.cierre ? 'Cierre registrado' : 'Sin cierre aún'}</span>
                      </div>
                    </div>
                    <div className="tarjeta">
                      <div className="tarjeta-icon-box tarjeta-icon-morado"><ShoppingBag size={22} /></div>
                      <div className="tarjeta-info">
                        <span className="tarjeta-label">Total ventas</span>
                        <span className="tarjeta-valor">
                          {ventasResumen?.cierre
                            ? formatearMonto(ventasResumen.cierre.total_ventas)
                            : '—'}
                        </span>
                        <span className="tarjeta-sub">{ventasResumen?.cierre ? 'Del cierre de caja' : 'Pendiente de cierre'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-overview-grid">
                    {/* Cierre de caja */}
                    <div className="seccion dashboard-chart-card">
                      <div className="seccion-header">
                        <h2 className="seccion-titulo"><Receipt size={18} /> Cierre de caja</h2>
                      </div>
                      {ventasResumen?.cierre ? (
                        <div style={{ padding: '0.5rem 0' }}>
                          <div style={{
                            background: '#E8F5E9', borderRadius: 10, padding: '1rem 1.25rem',
                            marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                          }}>
                            <CheckCircle size={20} color="#2E7D32" />
                            <div>
                              <div style={{ fontWeight: 600, color: '#1B5E20', fontSize: '0.9rem' }}>Cierre registrado hoy</div>
                              <div style={{ fontSize: '0.8rem', color: '#388E3C' }}>por {ventasResumen.cierre.cerrado_por}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {[
                              { label: 'Total ventas', valor: ventasResumen.cierre.total_ventas, color: '#1a1a2e' },
                              { label: 'Transferencias', valor: ventasResumen.cierre.total_transferencias, color: '#1565C0' },
                              { label: 'Efectivo en caja', valor: ventasResumen.cierre.total_efectivo, color: '#2E7D32' },
                              { label: 'Gastos del día', valor: ventasResumen.cierre.total_gastos, color: '#E53935' },
                            ].map((item, i) => (
                              <div key={i} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '0.5rem 0', borderBottom: i < 3 ? '1px solid #f0f0f5' : 'none',
                              }}>
                                <span style={{ fontSize: '0.85rem', color: '#4a4a68' }}>{item.label}</span>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: item.color }}>{formatearMonto(item.valor)}</span>
                              </div>
                            ))}
                          </div>
                          {ventasResumen.cierre.nota && (
                            <div style={{
                              marginTop: '0.75rem', padding: '0.6rem 0.8rem', background: '#f8f8fc',
                              borderRadius: 8, fontSize: '0.82rem', color: '#666',
                            }}>
                              📝 {ventasResumen.cierre.nota}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ padding: '0.5rem 0' }}>
                          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
                            Ingresa el total de ventas del día (del ticket de la caja registradora). El sistema calcula el efectivo restando las transferencias verificadas.
                          </p>
                          <div style={{ marginBottom: '0.75rem' }}>
                            <label style={{ fontSize: '0.8rem', color: '#4a4a68', fontWeight: 600, marginBottom: '0.3rem', display: 'block' }}>
                              Total de ventas del día ($)
                            </label>
                            <input
                              type="text"
                              placeholder="Ej: 235100"
                              value={montoVentas}
                              onChange={(e) => setMontoVentas(e.target.value.replace(/[^0-9]/g, ''))}
                              style={{
                                width: '100%', padding: '0.65rem 0.8rem', borderRadius: 8,
                                border: '2px solid #e8e8f0', fontSize: '1.1rem', fontWeight: 600,
                                outline: 'none', boxSizing: 'border-box',
                              }}
                            />
                            {montoVentas && (
                              <div style={{ fontSize: '0.8rem', color: '#F57C00', marginTop: '0.3rem', fontWeight: 500 }}>
                                {formatearMonto(parseInt(montoVentas) || 0)}
                              </div>
                            )}
                          </div>
                          <div style={{ marginBottom: '0.75rem' }}>
                            <label style={{ fontSize: '0.8rem', color: '#4a4a68', fontWeight: 600, marginBottom: '0.3rem', display: 'block' }}>
                              Nota (opcional)
                            </label>
                            <input
                              type="text"
                              placeholder="Ej: Día normal, faltó cambio"
                              value={notaCierre}
                              onChange={(e) => setNotaCierre(e.target.value)}
                              style={{
                                width: '100%', padding: '0.55rem 0.8rem', borderRadius: 8,
                                border: '2px solid #e8e8f0', fontSize: '0.85rem',
                                outline: 'none', boxSizing: 'border-box',
                              }}
                            />
                          </div>
                          <div style={{
                            background: '#FFF3E0', borderRadius: 8, padding: '0.6rem 0.8rem',
                            marginBottom: '1rem', fontSize: '0.8rem', color: '#E65100',
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                          }}>
                            <ArrowDownUp size={14} />
                            Transferencias verificadas hoy: <strong>{formatearMonto(ventasResumen?.transferencias?.total || 0)}</strong> ({ventasResumen?.transferencias?.cantidad || 0} pagos)
                          </div>
                          <button
                            disabled={guardandoCierre || !montoVentas}
                            onClick={hacerCierre}
                            style={{
                              width: '100%', padding: '0.7rem', borderRadius: 10, border: 'none',
                              background: montoVentas ? '#F57C00' : '#e0e0e0',
                              color: montoVentas ? '#fff' : '#999', fontWeight: 700,
                              fontSize: '0.9rem', cursor: montoVentas ? 'pointer' : 'default',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                            }}
                          >
                            <Receipt size={16} /> {guardandoCierre ? 'Guardando...' : 'Cerrar caja del día'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Gastos rápidos */}
                    <div className="seccion alertas-card">
                      <div className="seccion-header">
                        <h2 className="seccion-titulo"><MinusCircle size={18} /> Registrar gasto</h2>
                      </div>
                      <div style={{ marginBottom: '0.6rem' }}>
                        <input
                          type="text"
                          placeholder="Monto ($)"
                          value={gastoMonto}
                          onChange={(e) => setGastoMonto(e.target.value.replace(/[^0-9]/g, ''))}
                          style={{
                            width: '100%', padding: '0.55rem 0.8rem', borderRadius: 8,
                            border: '2px solid #e8e8f0', fontSize: '0.95rem', fontWeight: 600,
                            outline: 'none', marginBottom: '0.5rem', boxSizing: 'border-box',
                          }}
                        />
                        <select
                          value={gastoCategoria}
                          onChange={(e) => setGastoCategoria(e.target.value)}
                          style={{
                            width: '100%', padding: '0.5rem 0.8rem', borderRadius: 8,
                            border: '2px solid #e8e8f0', fontSize: '0.85rem',
                            outline: 'none', marginBottom: '0.5rem', background: '#fff', boxSizing: 'border-box',
                          }}
                        >
                          <option value="general">General</option>
                          <option value="insumos">Insumos</option>
                          <option value="nomina">Nómina</option>
                          <option value="servicios">Servicios</option>
                          <option value="arriendo">Arriendo</option>
                          <option value="transporte">Transporte</option>
                          <option value="otro">Otro</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Descripción del gasto"
                          value={gastoDescripcion}
                          onChange={(e) => setGastoDescripcion(e.target.value)}
                          style={{
                            width: '100%', padding: '0.55rem 0.8rem', borderRadius: 8,
                            border: '2px solid #e8e8f0', fontSize: '0.85rem',
                            outline: 'none', marginBottom: '0.6rem', boxSizing: 'border-box',
                          }}
                        />
                        <button
                          disabled={guardandoGasto || !gastoMonto || !gastoDescripcion.trim()}
                          onClick={agregarGasto}
                          style={{
                            width: '100%', padding: '0.6rem', borderRadius: 8, border: 'none',
                            background: gastoMonto && gastoDescripcion.trim() ? '#E53935' : '#e0e0e0',
                            color: gastoMonto && gastoDescripcion.trim() ? '#fff' : '#999',
                            fontWeight: 600, fontSize: '0.85rem', cursor: gastoMonto ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                          }}
                        >
                          <PlusCircle size={15} /> {guardandoGasto ? 'Guardando...' : 'Registrar gasto'}
                        </button>
                      </div>

                      {/* Lista de gastos de hoy */}
                      {ventasResumen?.gastos?.lista?.length > 0 && (
                        <div style={{ borderTop: '1px solid #f0f0f5', paddingTop: '0.6rem', marginTop: '0.3rem' }}>
                          <div style={{ fontSize: '0.78rem', color: '#999', fontWeight: 600, marginBottom: '0.4rem' }}>
                            GASTOS DE HOY
                          </div>
                          {ventasResumen.gastos.lista.map((g) => (
                            <div key={g.id} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '0.4rem 0', borderBottom: '1px solid #f8f8fc',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{
                                  width: 8, height: 8, borderRadius: '50%',
                                  background: getCategoriaColor(g.categoria), flexShrink: 0,
                                }} />
                                <div>
                                  <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{g.descripcion}</div>
                                  <div style={{ fontSize: '0.72rem', color: '#999' }}>{getCategoriaLabel(g.categoria)}</div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#E53935' }}>
                                  -{formatearMonto(g.monto)}
                                </span>
                                {esAdmin && (
                                  <button onClick={() => eliminarGastoHandler(g.id)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#ccc' }}>
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ── TAB: HISTORIAL ────────────────────── */}
              {ventasTab === 'historial' && (
                <>
                  {/* Resumen semanal cards */}
                  {ventasSemanal && (
                    <div className="tarjetas-grid">
                      <div className="tarjeta tarjeta-accent">
                        <div className="tarjeta-icon-box tarjeta-icon-naranja"><ShoppingBag size={22} /></div>
                        <div className="tarjeta-info">
                          <span className="tarjeta-label">Ventas (7 días)</span>
                          <span className="tarjeta-valor">{formatearMonto(ventasSemanal.totales?.ventas || 0)}</span>
                          <span className="tarjeta-sub">{ventasSemanal.dias?.length || 0} cierres</span>
                        </div>
                      </div>
                      <div className="tarjeta">
                        <div className="tarjeta-icon-box tarjeta-icon-azul"><ArrowDownUp size={22} /></div>
                        <div className="tarjeta-info">
                          <span className="tarjeta-label">Transferencias</span>
                          <span className="tarjeta-valor">{formatearMonto(ventasSemanal.totales?.transferencias || 0)}</span>
                          <span className="tarjeta-sub">Verificadas en la semana</span>
                        </div>
                      </div>
                      <div className="tarjeta">
                        <div className="tarjeta-icon-box tarjeta-icon-verde"><Wallet size={22} /></div>
                        <div className="tarjeta-info">
                          <span className="tarjeta-label">Efectivo</span>
                          <span className="tarjeta-valor" style={{ color: '#43A047' }}>{formatearMonto(ventasSemanal.totales?.efectivo || 0)}</span>
                          <span className="tarjeta-sub">Total en caja</span>
                        </div>
                      </div>
                      <div className="tarjeta">
                        <div className="tarjeta-icon-box tarjeta-icon-rojo"><MinusCircle size={22} /></div>
                        <div className="tarjeta-info">
                          <span className="tarjeta-label">Gastos</span>
                          <span className="tarjeta-valor" style={{ color: '#E53935' }}>{formatearMonto(ventasSemanal.totales?.gastos || 0)}</span>
                          <span className="tarjeta-sub">En la semana</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Gráfica semanal */}
                  {ventasSemanal?.dias?.length > 0 && (
                    <div className="seccion" style={{ marginBottom: '1.25rem' }}>
                      <h2 className="seccion-titulo"><BarChart3 size={18} /> Ventas vs Efectivo (7 días)</h2>
                      <div className="grafica-container">
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={ventasSemanal.dias.map(d => ({
                            fecha: d.fecha?.slice(0, 5) || '',
                            ventas: Math.round(d.total_ventas / 1000),
                            efectivo: Math.round(d.total_efectivo / 1000),
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                            <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={(v) => `$${v}k`} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(value, name) => [formatearMonto(value * 1000), name === 'ventas' ? 'Ventas' : 'Efectivo']} />
                            <Bar dataKey="ventas" fill="#F57C00" radius={[6, 6, 0, 0]} name="ventas" />
                            <Bar dataKey="efectivo" fill="#43A047" radius={[6, 6, 0, 0]} name="efectivo" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Tabla historial */}
                  <div className="seccion">
                    <div className="seccion-header">
                      <h2 className="seccion-titulo"><Calendar size={18} /> Historial de cierres</h2>
                      <span style={{ fontSize: '0.8rem', color: '#999' }}>{ventasCierres.length} cierres</span>
                    </div>
                    {ventasCierres.length === 0 ? (
                      <p className="empty-state">No hay cierres registrados aún.</p>
                    ) : (
                      <div className="tabla-container">
                        <table className="tabla-pagos">
                          <thead>
                            <tr>
                              <th>Fecha</th>
                              <th>Ventas</th>
                              <th>Transferencias</th>
                              <th>Efectivo</th>
                              <th>Gastos</th>
                              <th>Cerrado por</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ventasCierres.map((c) => (
                              <tr key={c.id}>
                                <td style={{ fontWeight: 500 }}>{c.fecha}</td>
                                <td className="td-monto">{formatearMonto(c.total_ventas)}</td>
                                <td style={{ color: '#1565C0' }}>{formatearMonto(c.total_transferencias)}</td>
                                <td style={{ color: '#2E7D32', fontWeight: 600 }}>{formatearMonto(c.total_efectivo)}</td>
                                <td style={{ color: '#E53935' }}>{c.total_gastos > 0 ? `-${formatearMonto(c.total_gastos)}` : '$0'}</td>
                                <td style={{ fontSize: '0.8rem' }}>{c.cerrado_por || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── TAB: GASTOS ───────────────────────── */}
              {ventasTab === 'gastos' && (
                <>
                  {/* Gastos por categoría */}
                  {ventasGastosCategorias.length > 0 && (
                    <>
                      <div className="tarjetas-grid">
                        <div className="tarjeta tarjeta-accent">
                          <div className="tarjeta-icon-box tarjeta-icon-rojo"><MinusCircle size={22} /></div>
                          <div className="tarjeta-info">
                            <span className="tarjeta-label">Total gastos (30 días)</span>
                            <span className="tarjeta-valor" style={{ color: '#E53935' }}>
                              {formatearMonto(ventasGastosCategorias.reduce((s, c) => s + c.total, 0))}
                            </span>
                            <span className="tarjeta-sub">{ventasGastosCategorias.reduce((s, c) => s + c.cantidad, 0)} gastos</span>
                          </div>
                        </div>
                      </div>

                      <div className="seccion">
                        <h2 className="seccion-titulo"><BarChart3 size={18} /> Gastos por categoría (30 días)</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1rem' }}>
                          {ventasGastosCategorias.map((cat) => {
                            const max = Math.max(...ventasGastosCategorias.map(c => c.total));
                            const pct = max > 0 ? Math.round((cat.total / max) * 100) : 0;
                            return (
                              <div key={cat.categoria}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{
                                      width: 10, height: 10, borderRadius: '50%',
                                      background: getCategoriaColor(cat.categoria),
                                    }} />
                                    {getCategoriaLabel(cat.categoria)}
                                  </span>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#E53935' }}>
                                    {formatearMonto(cat.total)} <span style={{ color: '#999', fontWeight: 400 }}>({cat.cantidad})</span>
                                  </span>
                                </div>
                                <div style={{ height: 8, background: '#f0f0f5', borderRadius: 4, overflow: 'hidden' }}>
                                  <div style={{
                                    width: `${pct}%`, height: '100%',
                                    background: getCategoriaColor(cat.categoria),
                                    borderRadius: 4, transition: 'width 0.5s ease',
                                  }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {ventasGastosCategorias.length === 0 && (
                    <div className="seccion">
                      <p className="empty-state">No hay gastos registrados en los últimos 30 días.</p>
                    </div>
                  )}
                </>
              )}
            </>
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