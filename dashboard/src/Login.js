import React, { useState } from 'react';
import { Zap, Lock, User, Eye, EyeOff, ShieldCheck, Clock, BarChart3 } from 'lucide-react';

function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password }),
      });

      const data = await res.json();

      if (data.ok) {
        localStorage.setItem('fp_token', data.token);
        localStorage.setItem('fp_user', JSON.stringify(data.user));
        onLogin();
      } else {
        setError(data.error || 'Usuario o contraseña incorrectos');
      }
    } catch (err) {
      setError('Error conectando al servidor');
    }

    setCargando(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter',sans-serif" }}>
      {/* IZQUIERDA - LOGIN */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
                alignItems: 'center', padding: '2rem', background: '#fff',
      }}>
        <div className="login-form-anim" style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}>
              <Zap size={28} color="#F57C00" fill="#F57C00" />
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '1.8rem' }}>
                <span style={{ color: '#F57C00' }}>Flash</span><span style={{ color: '#1A1A2E' }}>Pago</span>
              </span>
            </div>
            <p style={{ color: '#8888a8', fontSize: '0.95rem', margin: 0 }}>Ingresa a tu panel de administración</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#4a4a68', marginBottom: '0.4rem' }}>Usuario</label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="#999" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="Tu usuario"
                  required
                  style={{
                    width: '100%', padding: '0.85rem 0.85rem 0.85rem 2.8rem', border: '2px solid #e8e8f0',
                    borderRadius: 12, fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.3s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#F57C00'}
                  onBlur={(e) => e.target.style.borderColor = '#e8e8f0'}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#4a4a68', marginBottom: '0.4rem' }}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="#999" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={verPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', padding: '0.85rem 3rem 0.85rem 2.8rem', border: '2px solid #e8e8f0',
                    borderRadius: 12, fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.3s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#F57C00'}
                  onBlur={(e) => e.target.style.borderColor = '#e8e8f0'}
                />
                <button type="button" onClick={() => setVerPassword(!verPassword)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {verPassword ? <EyeOff size={18} color="#999" /> : <Eye size={18} color="#999" />}
                </button>
              </div>
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

                        <button type="submit" disabled={cargando} className="btn-login-anim" style={{
              width: '100%', padding: '0.9rem', background: '#F57C00', color: 'white',
              border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 600,
              cursor: cargando ? 'not-allowed' : 'pointer', opacity: cargando ? 0.7 : 1,
              transition: 'all 0.3s', fontFamily: "'Inter',sans-serif",
            }}>
              {cargando ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: '#b0b0c8', fontSize: '0.8rem', marginTop: '2rem' }}>
            © 2026 FlashPago — Verificación de pagos con IA
          </p>
        </div>
      </div>

      {/* DERECHA - ILUSTRACIÓN ABSTRACTA */}
            <div className="login-visual login-visual-anim" style={{
        flex: 1, background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        padding: '2.5rem', position: 'relative', overflow: 'hidden',
      }}>
        {/* Círculos abstractos */}
        <div style={{ position: 'absolute', top: '-15%', right: '-15%', width: 300, height: 300, borderRadius: '50%', border: '1px solid rgba(245,124,0,0.08)' }} />
        <div style={{ position: 'absolute', top: '-5%', right: '-5%', width: 250, height: 250, borderRadius: '50%', border: '1px solid rgba(245,124,0,0.12)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: 350, height: 350, borderRadius: '50%', border: '1px solid rgba(245,124,0,0.06)' }} />
        <div style={{ position: 'absolute', bottom: '-10%', left: '0%', width: 280, height: 280, borderRadius: '50%', border: '1px solid rgba(245,124,0,0.1)' }} />

        {/* Puntos flotantes */}
        <div style={{ position: 'absolute', top: '20%', left: '15%', width: 6, height: 6, background: 'rgba(245,124,0,0.4)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: '35%', right: '20%', width: 4, height: 4, background: 'rgba(245,124,0,0.3)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '25%', left: '25%', width: 5, height: 5, background: 'rgba(245,124,0,0.35)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: '15%', right: '35%', width: 3, height: 3, background: 'rgba(255,183,77,0.4)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '40%', right: '15%', width: 7, height: 7, background: 'rgba(245,124,0,0.2)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: '60%', left: '10%', width: 4, height: 4, background: 'rgba(255,183,77,0.3)', borderRadius: '50%' }} />

        {/* Líneas conectoras SVG */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.15 }} viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg">
          <line x1="50" y1="100" x2="200" y2="250" stroke="#F57C00" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="350" y1="80" x2="200" y2="250" stroke="#F57C00" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="80" y1="400" x2="200" y2="250" stroke="#F57C00" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="320" y1="420" x2="200" y2="250" stroke="#F57C00" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="150" y1="50" x2="200" y2="250" stroke="#FFB74D" strokeWidth="0.3" strokeDasharray="3 6" />
          <line x1="300" y1="350" x2="200" y2="250" stroke="#FFB74D" strokeWidth="0.3" strokeDasharray="3 6" />
        </svg>

                {/* Centro: Logo + texto + pills */}
        <div className="center-content-anim" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                    <div className="logo-anim" style={{
                      width: 140, height: 140, borderRadius: 30,
                      overflow: 'hidden', margin: '0 auto 1.5rem',
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

                    <div className="pills-anim" style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <div className="pill-item" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 18px', borderRadius: 50 }}>
              <ShieldCheck size={16} color="#2ecc71" />
              <span style={{ color: '#b0b0c8', fontSize: '0.85rem' }}>Anti-fraude con IA</span>
            </div>
            <div className="pill-item pill-item-2" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 18px', borderRadius: 50 }}>
              <Clock size={16} color="#F57C00" />
              <span style={{ color: '#b0b0c8', fontSize: '0.85rem' }}>Verificación en segundos</span>
            </div>
            <div className="pill-item pill-item-3" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 18px', borderRadius: 50 }}>
              <BarChart3 size={16} color="#3498db" />
              <span style={{ color: '#b0b0c8', fontSize: '0.85rem' }}>Dashboard en tiempo real</span>
            </div>
          </div>
        </div>
      </div>

            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');

        /* ─── Animación: entrada del formulario (lado izquierdo) ─── */
        .login-form-anim {
          animation: slideUp 0.8s ease both;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(25px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ─── Animación: panel derecho entra desde la derecha ─── */
        .login-visual-anim {
          animation: slideRight 1s ease both;
        }
        @keyframes slideRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        /* ─── Animación: contenido central (logo, título, pills) ─── */
        .center-content-anim {
          animation: fadeScale 1.2s ease both;
          animation-delay: 0.3s;
        }
        @keyframes fadeScale {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }

                /* ─── Animación: logo se despliega y queda estable ─── */
        .logo-anim {
          animation: logoDeploy 1s cubic-bezier(0.25, 1, 0.5, 1) both;
        }
        @keyframes logoDeploy {
          0%   { opacity: 0; transform: scale(0.5); }
          60%  { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }

        /* ─── Animación: pills (3 bloques) aparecen escalonados ─── */
        .pills-anim .pill-item {
          animation: pillSlide 0.7s ease both;
        }
        .pills-anim .pill-item-2 { animation-delay: 0.4s; }
        .pills-anim .pill-item-3 { animation-delay: 0.6s; }
        @keyframes pillSlide {
          from { opacity: 0; transform: translateX(-15px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        /* ─── Botón: efecto hover elevado con sombra ─── */
        .btn-login-anim {
          box-shadow: 0 4px 15px rgba(245,124,0,0.3);
        }
        .btn-login-anim:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(245,124,0,0.4);
        }
        .btn-login-anim:active {
          transform: translateY(0);
        }

        @media(max-width:768px) {
          .login-visual { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export default Login;