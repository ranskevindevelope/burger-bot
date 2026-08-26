import React, { useState } from 'react';
import { Zap, Mail, KeyRound, Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, ShieldCheck, Clock, BarChart3 } from 'lucide-react';

function RecuperarPassword({ onVolver }) {
  const [paso, setPaso] = useState(1); // 1: email, 2: código + nueva contraseña, 3: éxito
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const solicitarCodigo = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const res = await fetch('/api/recuperar/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.ok) {
        setMensaje(data.mensaje || 'Si el email está registrado, recibirás un código en unos minutos');
        setPaso(2);
      } else {
        setError(data.error || 'No se pudo enviar el código');
      }
    } catch (err) {
      setError('Error conectando al servidor');
    }
    setCargando(false);
  };

  const cambiarPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setCargando(true);
    try {
      const res = await fetch('/api/recuperar/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), codigo, password }),
      });
      const data = await res.json();
      if (data.ok) {
        setPaso(3);
      } else {
        setError(data.error || 'Código incorrecto o expirado');
      }
    } catch (err) {
      setError('Error conectando al servidor');
    }
    setCargando(false);
  };

  const inputStyle = {
    width: '100%', padding: '0.85rem 0.85rem 0.85rem 2.8rem', border: '2px solid #e8e8f0',
    borderRadius: 12, fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.3s',
  };
  const labelStyle = { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#4a4a68', marginBottom: '0.4rem' };
  const focus = (e) => e.target.style.borderColor = '#F57C00';
  const blur = (e) => e.target.style.borderColor = '#e8e8f0';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter',sans-serif" }}>
      {/* IZQUIERDA - FORMULARIO */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', padding: '2rem', background: '#fff',
      }}>
        <div className="recuperar-form-anim" style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}>
              <Zap size={28} color="#F57C00" fill="#F57C00" />
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '1.8rem' }}>
                <span style={{ color: '#F57C00' }}>Flash</span><span style={{ color: '#1A1A2E' }}>Pago</span>
              </span>
            </div>
            <p style={{ color: '#8888a8', fontSize: '0.95rem', margin: 0 }}>
              {paso === 1 && 'Recupera el acceso a tu panel'}
              {paso === 2 && 'Ingresa el código y tu nueva contraseña'}
              {paso === 3 && 'Contraseña actualizada'}
            </p>
          </div>

          {error && (
            <div style={{
              background: '#FFF3E0', color: '#E65100', padding: '0.75rem 1rem',
              borderRadius: 10, fontSize: '0.85rem', marginBottom: '1.25rem',
              border: '1px solid #FFE0B2',
            }}>
              {error}
            </div>
          )}

          {/* PASO 1: EMAIL */}
          {paso === 1 && (
            <form onSubmit={solicitarCodigo}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Email de tu cuenta</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} color="#999" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@negocio.com"
                    required
                    style={inputStyle}
                    onFocus={focus}
                    onBlur={blur}
                  />
                </div>
              </div>

              <button type="submit" disabled={cargando} className="btn-recuperar-anim" style={{
                width: '100%', padding: '0.9rem', background: '#F57C00', color: 'white',
                border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 600,
                cursor: cargando ? 'not-allowed' : 'pointer', opacity: cargando ? 0.7 : 1,
                transition: 'all 0.3s', fontFamily: "'Inter',sans-serif",
              }}>
                {cargando ? 'Enviando...' : 'Enviar código'}
              </button>
            </form>
          )}

          {/* PASO 2: CÓDIGO + NUEVA CONTRASEÑA */}
          {paso === 2 && (
            <form onSubmit={cambiarPassword}>
              {mensaje && (
                <div style={{
                  background: '#FFF8F0', color: '#F57C00', padding: '0.75rem 1rem',
                  borderRadius: 10, fontSize: '0.85rem', marginBottom: '1.25rem',
                  border: '1px solid #FFE0B2',
                }}>
                  {mensaje}
                </div>
              )}

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Código de verificación</label>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={18} color="#999" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    required
                    maxLength={6}
                    style={{ ...inputStyle, letterSpacing: 4, fontWeight: 600 }}
                    onFocus={focus}
                    onBlur={blur}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Nueva contraseña</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="#999" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={verPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    style={{ ...inputStyle, paddingRight: '3rem' }}
                    onFocus={focus}
                    onBlur={blur}
                  />
                  <button type="button" onClick={() => setVerPassword(!verPassword)}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {verPassword ? <EyeOff size={18} color="#999" /> : <Eye size={18} color="#999" />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Confirmar contraseña</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="#999" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={verPassword ? 'text' : 'password'}
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    placeholder="Repite la contraseña"
                    required
                    style={inputStyle}
                    onFocus={focus}
                    onBlur={blur}
                  />
                </div>
              </div>

              <button type="submit" disabled={cargando} className="btn-recuperar-anim" style={{
                width: '100%', padding: '0.9rem', background: '#F57C00', color: 'white',
                border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 600,
                cursor: cargando ? 'not-allowed' : 'pointer', opacity: cargando ? 0.7 : 1,
                transition: 'all 0.3s', fontFamily: "'Inter',sans-serif",
              }}>
                {cargando ? 'Guardando...' : 'Cambiar contraseña'}
              </button>

              <p style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button type="button" onClick={() => setPaso(1)} style={{
                  background: 'none', border: 'none', color: '#F57C00',
                  fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit',
                }}>
                  ¿No te llegó? Solicitar de nuevo
                </button>
              </p>
            </form>
          )}

          {/* PASO 3: ÉXITO */}
          {paso === 3 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: '#E8F5E9',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem',
              }}>
                <CheckCircle2 size={32} color="#43A047" />
              </div>
              <p style={{ color: '#4a4a68', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión con tu nueva contraseña.
              </p>
              <button onClick={onVolver} style={{
                width: '100%', padding: '0.9rem', background: '#F57C00', color: 'white',
                border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: "'Inter',sans-serif",
              }}>
                Ir a iniciar sesión
              </button>
            </div>
          )}

          {paso !== 3 && (
            <p style={{ textAlign: 'center', color: '#666', fontSize: '0.85rem', marginTop: '1.5rem' }}>
              <button onClick={onVolver} style={{
                background: 'none', border: 'none', color: '#666', display: 'inline-flex',
                alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit',
              }}>
                <ArrowLeft size={14} /> Volver a iniciar sesión
              </button>
            </p>
          )}

          <p style={{ textAlign: 'center', color: '#b0b0c8', fontSize: '0.8rem', marginTop: '1rem' }}>
            © 2026 FlashPago — Verificación de pagos con IA
          </p>
        </div>
      </div>

      {/* DERECHA - PANEL DE MARCA */}
      <div className="recuperar-visual" style={{
        flex: 1, background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        padding: '2.5rem', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-15%', right: '-15%', width: 300, height: 300, borderRadius: '50%', border: '1px solid rgba(245,124,0,0.08)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: 350, height: 350, borderRadius: '50%', border: '1px solid rgba(245,124,0,0.06)' }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{
            width: 140, height: 140, borderRadius: 30, background: '#F57C00', margin: '0 auto 1.5rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            boxShadow: '0 0 80px rgba(245,124,0,0.25), 0 0 30px rgba(245,124,0,0.15)',
          }}>
            <img src="/logo.png" alt="FlashPago" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          <h2 style={{
            fontFamily: "'Space Grotesk',sans-serif", fontSize: '1.8rem', fontWeight: 700,
            color: '#fff', margin: '0 0 0.5rem', letterSpacing: '-0.5px',
          }}>
            <span style={{ color: '#F57C00' }}>Flash</span>Pago
          </h2>
          <p style={{ color: '#8888a8', fontSize: '0.9rem', margin: '0 0 2.5rem', lineHeight: 1.6 }}>
            Verificación de pagos<br />con inteligencia artificial
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 18px', borderRadius: 50 }}>
              <ShieldCheck size={16} color="#2ecc71" />
              <span style={{ color: '#b0b0c8', fontSize: '0.85rem' }}>Anti-fraude con IA</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 18px', borderRadius: 50 }}>
              <Clock size={16} color="#F57C00" />
              <span style={{ color: '#b0b0c8', fontSize: '0.85rem' }}>Verificación en segundos</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 18px', borderRadius: 50 }}>
              <BarChart3 size={16} color="#3498db" />
              <span style={{ color: '#b0b0c8', fontSize: '0.85rem' }}>Dashboard en tiempo real</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');

        .recuperar-form-anim {
          animation: recSlideUp 0.6s ease both;
        }
        @keyframes recSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .btn-recuperar-anim {
          box-shadow: 0 4px 15px rgba(245,124,0,0.3);
        }
        .btn-recuperar-anim:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(245,124,0,0.4);
        }
        .btn-recuperar-anim:active {
          transform: translateY(0);
        }

        @media (max-width: 768px) {
          .recuperar-visual { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export default RecuperarPassword;
