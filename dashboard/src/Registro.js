import React, { useState, useEffect } from 'react';
import { DollarSign, ArrowRight, ArrowLeft, Check, Mail, Users, ShoppingBag, Shield, Zap, Sparkles, Gift, Package, Rocket, Building2 } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || '';

function Registro({ onBack }) {
  const [paso, setPaso] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  // Paso 1: Plan
  const [plan, setPlan] = useState('premium');

  // Paso 2: Datos del negocio
  const [nombreNegocio, setNombreNegocio] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [whatsappNegocio, setWhatsappNegocio] = useState('');
  const [cantidadEmpleados, setCantidadEmpleados] = useState('1-3');
  const [bancoNegocio, setBancoNegocio] = useState('Bancolombia');
  const [hintBancoVisible, setHintBancoVisible] = useState(true);

  useEffect(() => {
    if (bancoNegocio !== 'Bancolombia') {
      setHintBancoVisible(false);
      return;
    }
    setHintBancoVisible(true);
    const t = setTimeout(() => setHintBancoVisible(false), 3500);
    return () => clearTimeout(t);
  }, [bancoNegocio]);
  const [wppVerificado, setWppVerificado] = useState(false);
  const [wppCodigo, setWppCodigo] = useState('');
  const [wppEnviando, setWppEnviando] = useState(false);
  const [wppMensaje, setWppMensaje] = useState('');

  // Paso 3: Cuenta
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');

  // Paso 4: Verificación
  const [codigoDigitos, setCodigoDigitos] = useState(['', '', '', '', '', '']);
  const [reenviando, setReenviando] = useState(false);
  const [tiempoReenvio, setTiempoReenvio] = useState(0);

  // Paso 5: Resultado
  const [registroExitoso, setRegistroExitoso] = useState(null);

  const planes = [
    { id: 'basico', nombre: 'Básico', precio: '$39.900', comprobantes: '300 comprobantes/mes', corto: '300/mes', popular: false, Icono: Package },
    { id: 'premium', nombre: 'Premium', precio: '$79.900', comprobantes: '1,000 comprobantes/mes', corto: '1,000/mes', popular: true, Icono: Rocket },
    { id: 'empresarial', nombre: 'Empresarial', precio: '$149.900', comprobantes: 'Ilimitado', corto: 'Ilimitado', popular: false, Icono: Building2 },
  ];

  const planActual = planes.find(p => p.id === plan);

  // ─── Verificar WhatsApp ──────────────────────────────────
  const enviarCodigoWhatsapp = async () => {
    const wpp = whatsappNegocio.replace(/\D/g, '');
    if (wpp.length !== 10 && wpp.length !== 12) {
      setWppMensaje('Número no válido (10 dígitos)');
      return;
    }
    setWppEnviando(true);
    setWppMensaje('');
    try {
      const res = await fetch(`${API_BASE}/api/registro/verificar-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: whatsappNegocio }),
      });
      const data = await res.json();
      if (data.ok) {
        setWppMensaje('Código enviado a tu WhatsApp');
      } else {
        setWppMensaje(data.error || 'Error enviando código');
      }
    } catch (err) {
      setWppMensaje('Error de conexión');
    }
    setWppEnviando(false);
  };

  const confirmarWhatsapp = async () => {
    if (wppCodigo.length !== 6) {
      setWppMensaje('Ingresa los 6 dígitos');
      return;
    }
    setWppEnviando(true);
    try {
      const res = await fetch(`${API_BASE}/api/registro/confirmar-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: whatsappNegocio, codigo: wppCodigo }),
      });
      const data = await res.json();
      if (data.ok) {
        setWppVerificado(true);
        setWppMensaje('');
      } else {
        setWppMensaje(data.error || 'Código incorrecto');
        setWppCodigo('');
      }
    } catch (err) {
      setWppMensaje('Error de conexión');
    }
    setWppEnviando(false);
  };

  // ─── Enviar código ─────────────────────────────────────
  const enviarCodigo = async () => {
    setError('');
    if (!nombre.trim()) { setError('Ingresa tu nombre'); return; }
    if (!email.trim() || !email.includes('@')) { setError('Ingresa un correo válido'); return; }
    if (!usuario.trim()) { setError('Elige un usuario'); return; }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }

    setCargando(true);
    try {
      const res = await fetch(`${API_BASE}/api/registro/enviar-codigo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          nombre_negocio: nombreNegocio.trim(),
          plan,
          ciudad: ciudad.trim(),
          whatsapp_negocio: whatsappNegocio.trim(),
          nombre: nombre.trim(),
          usuario: usuario.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPaso(4);
        iniciarTimerReenvio();
      } else {
        setError(data.error || 'Error enviando el código');
      }
    } catch (err) {
      setError('Error de conexión. Intenta de nuevo.');
    }
    setCargando(false);
  };

  // ─── Verificar código ──────────────────────────────────
  const verificarCodigo = async () => {
    const codigo = codigoDigitos.join('');
    if (codigo.length !== 6) { setError('Ingresa los 6 dígitos'); return; }

    setError('');
    setCargando(true);
    try {
      const res = await fetch(`${API_BASE}/api/registro/verificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), codigo }),
      });
      const data = await res.json();
      if (data.ok) {
        setRegistroExitoso(data);
        setPaso(5);
      } else {
        setError(data.error || 'Código incorrecto');
        setCodigoDigitos(['', '', '', '', '', '']);
      }
    } catch (err) {
      setError('Error de conexión');
    }
    setCargando(false);
  };

  // ─── Reenviar código ───────────────────────────────────
  const reenviarCodigo = async () => {
    if (tiempoReenvio > 0) return;
    setReenviando(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/registro/reenviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), nombre_negocio: nombreNegocio }),
      });
      const data = await res.json();
      if (data.ok) {
        iniciarTimerReenvio();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error reenviando');
    }
    setReenviando(false);
  };

  const iniciarTimerReenvio = () => {
    setTiempoReenvio(60);
    const timer = setInterval(() => {
      setTiempoReenvio(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ─── Ir al dashboard ──────────────────────────────────
  const irAlDashboard = () => {
    if (registroExitoso) {
      localStorage.setItem('fp_token', registroExitoso.token);
      localStorage.setItem('fp_user', JSON.stringify(registroExitoso.user));
      window.location.href = '/panel?seccion=panel';
    }
  };

  // ─── Input de código ──────────────────────────────────
  const handleCodigoInput = (index, value) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;

    const nuevo = [...codigoDigitos];
    nuevo[index] = value;
    setCodigoDigitos(nuevo);

    if (value && index < 5) {
      const next = document.getElementById(`code-${index + 1}`);
      if (next) next.focus();
    }
  };

  const handleCodigoKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !codigoDigitos[index] && index > 0) {
      const prev = document.getElementById(`code-${index - 1}`);
      if (prev) prev.focus();
    }
    if (e.key === 'Enter' && codigoDigitos.join('').length === 6) {
      verificarCodigo();
    }
  };

  const handleCodigoPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setCodigoDigitos(text.split(''));
      const last = document.getElementById('code-5');
      if (last) last.focus();
    }
  };

  // ─── Validaciones por paso ────────────────────────────
  const puedeAvanzar = () => {
    if (paso === 1) return !!plan;
    if (paso === 2) {
      const wpp = whatsappNegocio.replace(/\D/g, '');
      return nombreNegocio.trim().length >= 2 && (wpp.length === 10 || wpp.length === 12) && wppVerificado;
    }
    if (paso === 3) return nombre.trim() && email.includes('@') && usuario.trim() && password.length >= 6;
    return true;
  };

  const avanzar = () => {
    setError('');
    if (paso === 3) {
      enviarCodigo();
      return;
    }
    setPaso(paso + 1);
  };

  // ─── Estilos ──────────────────────────────────────────
  const s = {
    container: { display: 'flex', minHeight: '100vh', fontFamily: "'Space Grotesk', -apple-system, sans-serif" },
    left: {
      flex: '0 0 42%', background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2.5rem', color: '#fff', position: 'relative',
    },
    right: {
      flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: '2rem 3rem', maxWidth: 520, margin: '0 auto',
    },
    logo: {
      width: 56, height: 56, background: '#F57C00', borderRadius: 14,
      display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem',
    },
    brand: { fontSize: 24, fontWeight: 600, marginBottom: '0.5rem' },
    brandSpan: { color: '#F57C00' },
    sub: { fontSize: 13, color: 'rgba(255,255,255,0.5)', maxWidth: 240, textAlign: 'center', lineHeight: 1.5 },
    feat: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'left' },
    featDot: { width: 6, height: 6, background: '#F57C00', borderRadius: '50%', flexShrink: 0 },
    steps: { display: 'flex', alignItems: 'center', gap: 0, marginBottom: '1.5rem' },
    step: (active, done) => ({
      display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
      color: done ? '#43A047' : active ? '#F57C00' : '#999', fontWeight: active ? 600 : 400,
    }),
    stepDot: (active, done) => ({
      width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 600,
      background: done ? '#E8F5E9' : active ? '#F57C00' : 'transparent',
      color: done ? '#2E7D32' : active ? '#fff' : '#999',
      border: done ? '2px solid #A5D6A7' : active ? 'none' : '2px solid #ddd',
    }),
    stepLine: { width: 32, height: 2, background: '#e0e0e0', margin: '0 6px' },
    title: { fontSize: 22, fontWeight: 600, color: '#1A1A2E', marginBottom: 4 },
    desc: { fontSize: 13, color: '#666', marginBottom: '1.5rem', lineHeight: 1.5 },
    field: { marginBottom: 12 },
    label: { fontSize: 12, color: '#666', fontWeight: 500, display: 'block', marginBottom: 4 },
    input: {
      width: '100%', padding: '10px 12px', borderRadius: 10, border: '2px solid #e8e8f0',
      fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
      transition: 'border-color 0.2s',
    },
    select: {
      width: '100%', padding: '10px 12px', borderRadius: 10, border: '2px solid #e8e8f0',
      fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff', fontFamily: 'inherit',
    },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
    btn: (enabled) => ({
      width: '100%', padding: 12, borderRadius: 12, border: 'none', fontWeight: 600,
      fontSize: 15, cursor: enabled ? 'pointer' : 'default', fontFamily: 'inherit',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      background: enabled ? '#F57C00' : '#e0e0e0', color: enabled ? '#fff' : '#999',
      marginTop: 8, transition: 'background 0.2s',
    }),
    btnBack: {
      background: 'transparent', border: '2px solid #e8e8f0', color: '#666',
      padding: '10px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', fontWeight: 500,
    },
    error: {
      background: '#FFF3F3', color: '#D32F2F', padding: '10px 14px', borderRadius: 10,
      fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
    },
    planCard: (selected) => ({
      border: selected ? '2px solid #F57C00' : '2px solid #e8e8f0',
      borderRadius: 12, padding: '14px 12px', cursor: 'pointer', textAlign: 'center',
      background: selected ? '#FFF8F0' : '#fff', position: 'relative', transition: 'all 0.2s',
    }),
    planTag: {
      position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
      background: '#F57C00', color: '#fff', fontSize: 10, padding: '2px 12px',
      borderRadius: 10, fontWeight: 600,
    },
    infoBox: {
      background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 18px', marginTop: '1.5rem',
    },
    codeInput: (filled) => ({
      width: 46, height: 54, borderRadius: 10, textAlign: 'center', fontSize: 22, fontWeight: 600,
      border: filled ? '2px solid #F57C00' : '2px solid #e8e8f0',
      background: filled ? '#FFF8F0' : '#fff', outline: 'none', fontFamily: 'inherit',
    }),
    link: { color: '#F57C00', fontWeight: 600, textDecoration: 'none', cursor: 'pointer', background: 'none', border: 'none', fontSize: 'inherit', fontFamily: 'inherit' },
  };

  return (
    <div style={s.container}>
      {/* ─── LADO IZQUIERDO ────────────────────── */}
      <div style={s.left}>
        <div style={s.logo}><img src="/logo.png" alt="FlashPago" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} /></div>
        <div style={s.brand}>Flash<span style={s.brandSpan}>Pago</span></div>
        <div style={s.sub}>Verifica comprobantes de pago en segundos con inteligencia artificial</div>

        {/* ─── TARJETA PREVIEW ANIMADA ──────────── */}
        <div className="reg-preview-card" style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, padding: '1.5rem', marginTop: '2rem', width: '100%', maxWidth: 320,
          backdropFilter: 'blur(10px)', transition: 'all 0.5s ease',
        }}>
          {/* Header de la tarjeta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: plan === 'empresarial' ? 'linear-gradient(135deg, #F57C00, #FF9800)' : plan === 'premium' ? 'linear-gradient(135deg, #F57C00, #FFB74D)' : 'rgba(245,124,0,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.4s ease',
            }}>
              <ShoppingBag size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 }}>NUEVO NEGOCIO</div>
              <div style={{
                fontSize: 14, color: '#fff', fontWeight: 600, transition: 'all 0.3s ease',
                minHeight: 20,
              }}>
                {nombreNegocio || 'Tu negocio'}
              </div>
            </div>
          </div>

          {/* Detalles que aparecen con animación */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Plan - siempre visible */}
            <div className="reg-detail-row" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              opacity: 1, transition: 'all 0.4s ease',
            }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Plan</span>
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 50,
                background: plan === 'empresarial' ? 'rgba(245,124,0,0.3)' : plan === 'premium' ? 'rgba(245,124,0,0.2)' : 'rgba(255,255,255,0.08)',
                color: plan ? '#F57C00' : 'rgba(255,255,255,0.3)',
                transition: 'all 0.3s ease',
              }}>
                {planActual?.nombre || '—'}
              </span>
            </div>

            {/* Precio */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              opacity: plan ? 1 : 0.3, transition: 'all 0.4s ease',
            }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Precio</span>
              <span style={{ fontSize: 13, transition: 'all 0.3s ease' }}>
                <span style={{ textDecoration: 'line-through', color: 'rgba(255,255,255,0.3)', marginRight: 6 }}>
                  {planActual?.precio || '—'}
                </span>
                <span style={{ color: '#43A047', fontWeight: 700 }}>GRATIS</span>
              </span>
            </div>

            {/* Duración trial */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              opacity: plan ? 1 : 0.3, transition: 'all 0.4s ease',
            }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Duración</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>15 días</span>
            </div>

            {/* Comprobantes */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              opacity: plan ? 1 : 0.3, transition: 'all 0.4s ease',
            }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Comprobantes</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{planActual?.comprobantes || '—'}</span>
            </div>

            {/* Ciudad - aparece cuando la llena */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              maxHeight: ciudad ? 24 : 0, opacity: ciudad ? 1 : 0,
              overflow: 'hidden', transition: 'all 0.4s ease',
            }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Ciudad</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{ciudad}</span>
            </div>

            {/* WhatsApp - aparece cuando lo llena */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              maxHeight: whatsappNegocio ? 24 : 0, opacity: whatsappNegocio ? 1 : 0,
              overflow: 'hidden', transition: 'all 0.4s ease',
            }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>WhatsApp</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{whatsappNegocio}</span>
            </div>

            {/* Banco - aparece cuando lo selecciona */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              maxHeight: paso >= 2 ? 24 : 0, opacity: paso >= 2 ? 1 : 0,
              overflow: 'hidden', transition: 'all 0.4s ease',
            }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Banco</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{bancoNegocio}</span>
            </div>

            {/* Administrador - aparece en paso 3+ */}
            <div style={{
              maxHeight: nombre && paso >= 3 ? 40 : 0, opacity: nombre && paso >= 3 ? 1 : 0,
              overflow: 'hidden', transition: 'all 0.4s ease',
              borderTop: nombre && paso >= 3 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              paddingTop: nombre && paso >= 3 ? 8 : 0, marginTop: nombre && paso >= 3 ? 4 : 0,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Admin</span>
                <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>{nombre}</span>
              </div>
            </div>

            {/* Email - aparece en paso 3+ */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              maxHeight: email && paso >= 3 ? 24 : 0, opacity: email && paso >= 3 ? 1 : 0,
              overflow: 'hidden', transition: 'all 0.4s ease',
            }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Email</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{email}</span>
            </div>
          </div>

          {/* Barra de progreso del registro */}
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Progreso</span>
              <span style={{ fontSize: 11, color: '#F57C00', fontWeight: 600 }}>{Math.min(paso, 4)}/4</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #F57C00, #FFB74D)',
                width: `${(Math.min(paso, 4) / 4) * 100}%`,
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
        </div>

        {/* Paso 4: ícono de correo */}
        {paso === 4 && (
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <div className="reg-mail-pulse" style={{
              width: 60, height: 60, background: 'rgba(245,124,0,0.15)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
            }}>
              <Mail size={28} color="#F57C00" />
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
              Revisa tu correo
            </div>
          </div>
        )}

        {/* Paso 5: check */}
        {paso === 5 && (
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <div className="reg-success-pop" style={{
              width: 60, height: 60, background: 'rgba(67,160,71,0.15)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
            }}>
              <Check size={30} color="#43A047" />
            </div>
          </div>
        )}

        {/* CSS Animations */}
        <style>{`
          .reg-mail-pulse {
            animation: regPulse 2s ease-in-out infinite;
          }
          @keyframes regPulse {
            0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245,124,0,0.2); }
            50% { transform: scale(1.08); box-shadow: 0 0 0 15px rgba(245,124,0,0); }
          }
          .reg-success-pop {
            animation: regPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          }
          @keyframes regPop {
            0% { transform: scale(0); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>

      {/* ─── LADO DERECHO ─────────────────────── */}
      <div style={s.right}>
        {/* Steps indicator */}
        {paso <= 4 && (
          <div style={s.steps}>
            {[
              { n: 1, label: 'Plan' },
              { n: 2, label: 'Datos' },
              { n: 3, label: 'Cuenta' },
              { n: 4, label: 'Verificar' },
            ].map((st, i) => (
              <React.Fragment key={st.n}>
                <div style={s.step(paso === st.n, paso > st.n)}>
                  <div style={s.stepDot(paso === st.n, paso > st.n)}>
                    {paso > st.n ? <Check size={14} /> : st.n}
                  </div>
                  {st.label}
                </div>
                {i < 3 && <div style={s.stepLine} />}
              </React.Fragment>
            ))}
          </div>
        )}

        {error && <div style={s.error}><Shield size={14} /> {error}</div>}

        {/* ─── PASO 1: PLAN ──────────────────── */}
        {paso === 1 && (
          <>
            <div style={s.title}>Elige tu plan</div>
            <div style={s.desc}>Prueba gratis por 15 días. Sin tarjeta de crédito.</div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px',
              borderRadius: 50, background: '#E8F5E9', color: '#2E7D32',
              fontSize: 12, fontWeight: 600, marginBottom: 14,
            }}>
              <Gift size={13} /> 15 días gratis en cualquier plan
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              {planes.map(p => (
                <div key={p.id} style={s.planCard(plan === p.id)} onClick={() => setPlan(p.id)}>
                  {p.popular && <div style={s.planTag}>Popular</div>}
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, margin: '0 auto 8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: plan === p.id ? '#F57C00' : '#f2f2f6',
                    transition: 'background 0.2s',
                  }}>
                    <p.Icono size={17} color={plan === p.id ? '#fff' : '#8888a8'} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E', marginBottom: 4 }}>{p.nombre}</div>
                  <div style={{ fontSize: 19, fontWeight: 700, color: '#F57C00', lineHeight: 1.2 }}>{p.precio}</div>
                  <div style={{ fontSize: 10, color: '#bbb', marginBottom: 8 }}>por mes</div>
                  <div style={{ height: 1, background: '#eee', margin: '0 -12px 8px' }} />
                  <div style={{ fontSize: 11, color: '#666', fontWeight: 500 }}>{p.corto}</div>
                </div>
              ))}
            </div>
            <button style={s.btn(true)} onClick={avanzar}>
              Empezar gratis <ArrowRight size={16} />
            </button>
            <div style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: 8 }}>
              Sin tarjeta de crédito. Cancela cuando quieras.
            </div>
            <div style={{ fontSize: 13, color: '#999', textAlign: 'center', marginTop: 10 }}>
              ¿Ya tienes cuenta? <button style={s.link} onClick={onBack}>Inicia sesión</button>
            </div>
          </>
        )}

        {/* ─── PASO 2: DATOS ─────────────────── */}
        {paso === 2 && (
          <>
            <div style={s.title}>Datos de tu negocio</div>
            <div style={s.desc}>Información básica para configurar tu cuenta</div>
            <div style={s.field}>
              <label style={s.label}>Nombre del negocio *</label>
              <input style={s.input} placeholder="Ej: Pizzería Don Mario" value={nombreNegocio}
                onChange={e => setNombreNegocio(e.target.value)} />
            </div>
            <div style={s.row}>
              <div style={s.field}>
                <label style={s.label}>Ciudad</label>
                <input style={s.input} placeholder="Ej: Medellín" value={ciudad}
                  onChange={e => setCiudad(e.target.value)} />
              </div>
              <div style={s.field}>
                <label style={s.label}>WhatsApp del negocio *</label>
                {wppVerificado ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                    borderRadius: 10, background: '#E8F5E9', border: '2px solid #A5D6A7',
                  }}>
                    <Check size={16} color="#2E7D32" />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#2E7D32' }}>{whatsappNegocio}</span>
                    <button onClick={() => { setWppVerificado(false); setWppCodigo(''); }} style={{
                      marginLeft: 'auto', background: 'none', border: 'none', color: '#999',
                      cursor: 'pointer', fontSize: 12,
                    }}>Cambiar</button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input style={{ ...s.input, flex: 1 }} placeholder="3001234567" value={whatsappNegocio}
                        onChange={e => { setWhatsappNegocio(e.target.value.replace(/[^0-9]/g, '')); setWppMensaje(''); }}
                        maxLength={12} />
                      <button onClick={enviarCodigoWhatsapp} disabled={wppEnviando || whatsappNegocio.replace(/\D/g, '').length < 10}
                        style={{
                          padding: '0 14px', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 600,
                          background: whatsappNegocio.replace(/\D/g, '').length >= 10 ? '#F57C00' : '#e0e0e0',
                          color: whatsappNegocio.replace(/\D/g, '').length >= 10 ? '#fff' : '#999',
                          cursor: whatsappNegocio.replace(/\D/g, '').length >= 10 ? 'pointer' : 'default',
                          whiteSpace: 'nowrap',
                        }}>
                        {wppEnviando ? '...' : 'Verificar'}
                      </button>
                    </div>
                    {wppMensaje && (
                      <div style={{
                        fontSize: 11, marginTop: 4, fontWeight: 500,
                        color: wppMensaje.includes('enviado') ? '#2E7D32' : '#E65100',
                      }}>{wppMensaje}</div>
                    )}
                    {wppMensaje.includes('enviado') && !wppVerificado && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <input
                          style={{ ...s.input, flex: 1, letterSpacing: 4, textAlign: 'center', fontWeight: 600 }}
                          placeholder="000000"
                          value={wppCodigo}
                          onChange={e => setWppCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          maxLength={6}
                          inputMode="numeric"
                          onKeyDown={e => e.key === 'Enter' && wppCodigo.length === 6 && confirmarWhatsapp()}
                        />
                        <button onClick={confirmarWhatsapp} disabled={wppEnviando || wppCodigo.length !== 6}
                          style={{
                            padding: '0 14px', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 600,
                            background: wppCodigo.length === 6 ? '#43A047' : '#e0e0e0',
                            color: wppCodigo.length === 6 ? '#fff' : '#999',
                            cursor: wppCodigo.length === 6 ? 'pointer' : 'default',
                            whiteSpace: 'nowrap',
                          }}>
                          <Check size={14} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div style={s.row}>
              <div style={s.field}>
                <label style={s.label}>¿Cuántos empleados?</label>
                <select style={s.select} value={cantidadEmpleados} onChange={e => setCantidadEmpleados(e.target.value)}>
                  <option value="1-3">1-3 empleados</option>
                  <option value="4-10">4-10 empleados</option>
                  <option value="10+">Más de 10</option>
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Banco principal</label>
                <select style={s.select} value={bancoNegocio} onChange={e => setBancoNegocio(e.target.value)}>
                  <option>Bancolombia</option>
                  <option>Nequi</option>
                  <option>Daviplata</option>
                  <option>Davivienda</option>
                  <option>AV Villas</option>
                  <option>Otro</option>
                </select>
              </div>
            </div>
            <div style={{
              maxHeight: hintBancoVisible ? 28 : 0,
              opacity: hintBancoVisible ? 1 : 0,
              overflow: 'hidden',
              transition: 'max-height 0.5s ease, opacity 0.4s ease',
              marginTop: hintBancoVisible ? 8 : 0,
            }}>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, color: '#F57C00', fontWeight: 500, lineHeight: 1.4,
              }}>
                <Sparkles size={13} style={{ flexShrink: 0 }} /> Bancolombia es el banco más usado por nuestros clientes
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button style={s.btnBack} onClick={() => setPaso(1)}>
                <ArrowLeft size={14} /> Atrás
              </button>
              <button style={{ ...s.btn(puedeAvanzar()), flex: 1 }} onClick={avanzar} disabled={!puedeAvanzar()}>
                Continuar <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}

        {/* ─── PASO 3: CUENTA ────────────────── */}
        {paso === 3 && (
          <>
            <div style={s.title}>Crea tu cuenta</div>
            <div style={s.desc}>Con estos datos accedes al dashboard de FlashPago</div>
            <div style={s.field}>
              <label style={s.label}>Nombre completo *</label>
              <input style={s.input} placeholder="Ej: Mario López" value={nombre}
                onChange={e => setNombre(e.target.value)} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Correo electrónico *</label>
              <input style={s.input} type="email" placeholder="mario@negocio.com" value={email}
                onChange={e => setEmail(e.target.value)} />
            </div>
            <div style={s.row}>
              <div style={s.field}>
                <label style={s.label}>Usuario *</label>
                <input style={s.input} placeholder="Ej: mario" value={usuario}
                  onChange={e => setUsuario(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Contraseña *</label>
                <input style={s.input} type="password" placeholder="Mínimo 6 caracteres" value={password}
                  onChange={e => setPassword(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button style={s.btnBack} onClick={() => setPaso(2)}>
                <ArrowLeft size={14} /> Atrás
              </button>
              <button style={{ ...s.btn(puedeAvanzar() && !cargando), flex: 1 }} onClick={avanzar} disabled={!puedeAvanzar() || cargando}>
                {cargando ? 'Enviando código...' : <><Mail size={16} /> Verificar correo</>}
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
              Al crear tu cuenta aceptas los{' '}
              <a href="/terminos" style={{ color: '#F57C00', textDecoration: 'none' }}>términos de servicio</a>{' '}
              y <a href="/privacidad" style={{ color: '#F57C00', textDecoration: 'none' }}>política de privacidad</a>
            </div>
          </>
        )}

        {/* ─── PASO 4: VERIFICAR ─────────────── */}
        {paso === 4 && (
          <>
            <div style={s.title}>Verifica tu correo</div>
            <div style={s.desc}>Enviamos un código de verificación a:</div>
            <div style={{
              background: '#f8f8fc', borderRadius: 12, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem',
            }}>
              <Mail size={18} color="#F57C00" />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E' }}>{email}</div>
                <div style={{ fontSize: 11, color: '#999' }}>Revisa también en spam</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 10 }}>
              Ingresa el código de 6 dígitos
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: '1.25rem' }}>
              {codigoDigitos.map((d, i) => (
                <input
                  key={i}
                  id={`code-${i}`}
                  style={s.codeInput(!!d)}
                  value={d}
                  onChange={e => handleCodigoInput(i, e.target.value)}
                  onKeyDown={e => handleCodigoKeyDown(i, e)}
                  onPaste={i === 0 ? handleCodigoPaste : undefined}
                  maxLength={1}
                  inputMode="numeric"
                />
              ))}
            </div>
            <button
              style={s.btn(codigoDigitos.join('').length === 6 && !cargando)}
              onClick={verificarCodigo}
              disabled={codigoDigitos.join('').length !== 6 || cargando}
            >
              {cargando ? 'Verificando...' : <><Check size={16} /> Verificar código</>}
            </button>
            <div style={{ fontSize: 12, color: '#999', textAlign: 'center', marginTop: 10 }}>
              {tiempoReenvio > 0
                ? `Puedes reenviar en ${tiempoReenvio}s`
                : <>¿No recibiste el correo? <button style={s.link} onClick={reenviarCodigo} disabled={reenviando}>
                    {reenviando ? 'Enviando...' : 'Reenviar código'}
                  </button></>
              }
            </div>
            <button style={{ ...s.btnBack, marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={() => setPaso(3)}>
              <ArrowLeft size={14} /> Cambiar datos
            </button>
          </>
        )}

        {/* ─── PASO 5: BIENVENIDA ────────────── */}
        {paso === 5 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, background: '#E8F5E9', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
            }}>
              <Check size={28} color="#2E7D32" />
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#1A1A2E', marginBottom: 6 }}>
              ¡Bienvenido a FlashPago!
            </div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Tu cuenta está lista. Solo faltan 2 pasos para empezar a verificar comprobantes.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', marginBottom: '1.5rem' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                background: '#f8f8fc', borderRadius: 10,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: '#E3F2FD',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Mail size={16} color="#1565C0" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>Conecta tu Gmail</div>
                  <div style={{ fontSize: 11, color: '#999' }}>Para verificar pagos automáticamente</div>
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                background: '#f8f8fc', borderRadius: 10,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: '#E8F5E9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Users size={16} color="#2E7D32" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>Agrega tus empleados</div>
                  <div style={{ fontSize: 11, color: '#999' }}>Con su número de WhatsApp</div>
                </div>
              </div>
            </div>
            <button style={s.btn(true)} onClick={irAlDashboard}>
              <ArrowRight size={16} /> Ir al dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Registro;