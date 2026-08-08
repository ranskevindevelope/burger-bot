import { useState, useEffect } from "react";
import {
  Zap, MessageCircle, Lock, Camera, Bot, CheckCircle2, Shield, BarChart3,
  Search, RefreshCw, Clock, AlertTriangle, Building2, Wallet, Database,
  FileText, Landmark, Smartphone, TrendingUp, Users, FileSpreadsheet,
  Headphones, Star, Check, Minus, Hourglass, ArrowRight
} from "lucide-react";

const COLORS = {
  naranja: "#F57C00",
  naranjaFuerte: "#E65100",
  naranjaSuave: "#FFB74D",
  oscuro: "#1A1A2E",
  oscuro2: "#16213E",
  grisTxt: "#4a4a68",
  grisClaro: "#f0f0f5",
  blanco: "#ffffff",
  verde: "#2ecc71",
};

// Ícono con fondo suave estilo dashboard
function IconBadge({ icon: Icon, bg, color, size = 22, boxSize = 44 }) {
  return (
    <div style={{
      width: boxSize, height: boxSize, background: bg, borderRadius: 12,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <Icon size={size} color={color} strokeWidth={2} />
    </div>
  );
}

// ─── NAV ─────────────────────────────────
function Nav({ onLogin }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav style={{
      position: "fixed", top: 0, width: "100%", zIndex: 100,
      background: scrolled ? "rgba(26,26,46,0.97)" : "rgba(26,26,46,0.92)",
      backdropFilter: "blur(12px)", padding: "1rem 2rem",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      transition: "background 0.3s", boxSizing: "border-box",
    }}>
      <a href="#" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: "1.5rem", color: COLORS.naranja, textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
        <Zap size={24} fill={COLORS.naranja} />
        Flash<span style={{ color: COLORS.blanco }}>Pago</span>
      </a>

      <ul className="nav-links-list" style={{
        gap: "1.5rem", listStyle: "none", alignItems: "center", margin: 0, padding: 0,
        ...(menuOpen ? { display: "flex", flexDirection: "column", position: "absolute", top: "100%", left: 0, right: 0, background: "rgba(26,26,46,0.98)", padding: "1.5rem 2rem", zIndex: 200 } : {}),
      }}>
        {[["#como-funciona", "Cómo funciona"], ["#beneficios", "Beneficios"], ["#planes", "Planes"]].map(([href, label]) => (
          <li key={href}>
            <a href={href} onClick={() => setMenuOpen(false)} style={{ color: "#b0b0c8", textDecoration: "none", fontSize: "0.9rem", fontWeight: 500 }}>{label}</a>
          </li>
        ))}
      </ul>

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button onClick={onLogin} style={{ background: "transparent", border: "2px solid rgba(255,255,255,0.2)", color: COLORS.blanco, padding: "0.45rem 1.1rem", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 6 }}>
          <Lock size={15} /> Iniciar sesión
        </button>
        <a href="#contacto" style={{ background: COLORS.naranja, color: "white", padding: "0.5rem 1.1rem", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: "0.85rem" }}>
          Contactar
        </a>
        <button className="menu-toggle-btn" onClick={() => setMenuOpen(!menuOpen)}
          style={{ display: "none", background: "none", border: "none", cursor: "pointer", flexDirection: "column", gap: 5, marginLeft: 8 }}>
          <span style={{ width: 25, height: 3, background: COLORS.blanco, borderRadius: 2, display: "block" }} />
          <span style={{ width: 25, height: 3, background: COLORS.blanco, borderRadius: 2, display: "block" }} />
          <span style={{ width: 25, height: 3, background: COLORS.blanco, borderRadius: 2, display: "block" }} />
        </button>
      </div>
    </nav>
  );
}

// ─── PHONE CHAT ANIMATION ────────────────
function PhoneMockup() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [];
    function run() {
      setStep(0);
      timers.push(setTimeout(() => setStep(1), 500));
      timers.push(setTimeout(() => setStep(2), 1500));
      timers.push(setTimeout(() => setStep(3), 4000));
      timers.push(setTimeout(() => setStep(4), 5000));
      timers.push(setTimeout(() => run(), 10000));
    }
    run();
    return () => timers.forEach(clearTimeout);
  }, []);

  const bubbleBase = { padding: "0.75rem 1rem", borderRadius: 12, marginBottom: "0.75rem", fontSize: "0.85rem", maxWidth: "85%", transition: "all 0.4s ease-out" };
  const hidden = { opacity: 0, transform: "translateY(15px)" };
  const visible = { opacity: 1, transform: "translateY(0)" };

  return (
    <div style={{ background: COLORS.oscuro, border: "2px solid rgba(255,255,255,0.1)", borderRadius: 32, padding: "1.5rem", width: "100%", maxWidth: 320, boxShadow: "0 20px 60px rgba(0,0,0,0.4)", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", paddingBottom: "1rem", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: "1rem" }}>
        <div style={{ width: 40, height: 40, background: COLORS.naranja, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Zap size={20} color="white" fill="white" />
        </div>
        <div>
          <div style={{ color: COLORS.blanco, fontWeight: 600, fontSize: "0.95rem" }}>FlashPago</div>
          <div style={{ color: COLORS.verde, fontSize: "0.75rem" }}>● en línea</div>
        </div>
      </div>

      <div style={{ ...bubbleBase, background: "#005c4b", color: "white", marginLeft: "auto", borderBottomRightRadius: 4, display: "flex", alignItems: "center", gap: 6, ...(step >= 1 ? visible : hidden) }}>
        <Camera size={16} /> [Comprobante de pago]
      </div>

      <div style={{ ...bubbleBase, background: "rgba(255,255,255,0.08)", color: "#e0e0e0", borderBottomLeftRadius: 4, ...(step >= 2 ? visible : hidden) }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Hourglass size={14} /> Verificando el pago...</span>
        {step === 2 && (
          <div style={{ display: "inline-flex", gap: 4, paddingTop: 6 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ width: 7, height: 7, background: "#b0b0c8", borderRadius: "50%", display: "inline-block", animation: `typingDot 1.4s infinite ${i * 0.2}s` }} />
            ))}
          </div>
        )}
      </div>

      {step >= 3 && (
        <div style={{ ...bubbleBase, background: "rgba(255,255,255,0.08)", color: "#e0e0e0", borderBottomLeftRadius: 4, ...visible }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ display: "inline-flex", animation: "popIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275)" }}>
              <CheckCircle2 size={18} color={COLORS.verde} />
            </span>
            <strong>PAGO VERIFICADO</strong>
          </div>
          <div style={{ lineHeight: 1.8 }}>
            Monto: <strong>$53.300</strong><br />
            Banco: Nequi<br />
            Cliente: María López<br />
            Fecha: 22/07/2026
          </div>
        </div>
      )}

      {step >= 4 && (
        <div style={{ background: "rgba(46,204,113,0.15)", border: "1px solid rgba(46,204,113,0.3)", color: COLORS.verde, padding: "0.5rem 1rem", borderRadius: 8, fontSize: "0.75rem", fontWeight: 600, textAlign: "center", marginTop: "0.75rem", animation: "fadeIn 0.5s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Zap size={14} /> Verificado en 6 segundos — Ahorra 3 min por pago
        </div>
      )}
    </div>
  );
}

// ─── HUB SVG DIAGRAM ─────────────────────
function HubDiagram() {
  const nodos = [
    { x: 100, y: 80, Icon: MessageCircle, label: "WhatsApp" },
    { x: 500, y: 80, Icon: Landmark, label: "Banco" },
    { x: 80, y: 240, Icon: Camera, label: "Comprobante" },
    { x: 520, y: 240, Icon: Shield, label: "Anti-fraude" },
    { x: 160, y: 350, Icon: BarChart3, label: "Reportes" },
    { x: 440, y: 350, Icon: Database, label: "Registro" },
  ];

  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "2rem 0 3rem" }}>
      <svg viewBox="0 0 600 400" width="100%" style={{ maxWidth: 650 }} xmlns="http://www.w3.org/2000/svg">
        {nodos.map((n, i) => (
          <g key={`line-${i}`}>
            <line x1="300" y1="200" x2={n.x} y2={n.y} stroke="#F57C00" strokeWidth="2" strokeDasharray="8,4" opacity="0.3">
              <animate attributeName="opacity" values="0.1;0.5;0.1" dur="3s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
            </line>
            <circle r="4" fill="#FFB74D">
              <animateMotion dur="2s" begin={`${i * 0.5}s`} repeatCount="indefinite" path={`M300,200 L${n.x},${n.y}`} />
            </circle>
          </g>
        ))}

        {nodos.map((n, i) => (
          <g key={n.label}>
            <rect x={n.x - 28} y={n.y - 28} width="56" height="56" rx="14" fill="rgba(255,255,255,0.06)" stroke="rgba(245,124,0,0.4)" strokeWidth="1.5" />
            <foreignObject x={n.x - 14} y={n.y - 14} width="28" height="28">
              <n.Icon size={28} color="#FFB74D" strokeWidth={1.8} />
            </foreignObject>
            <text x={n.x} y={n.y + 45} textAnchor="middle" fill="#b0b0c8" fontSize="11" fontFamily="Inter,sans-serif">{n.label}</text>
          </g>
        ))}

        <circle cx="300" cy="200" r="55" fill="none" stroke="#F57C00" strokeWidth="1" opacity="0.2">
          <animate attributeName="r" values="55;65;55" dur="2s" repeatCount="indefinite" />
        </circle>
        <rect x="258" y="158" width="84" height="84" rx="20" fill="#F57C00" />
        <foreignObject x="284" y="172" width="32" height="32">
          <Zap size={32} color="white" fill="white" />
        </foreignObject>
        <text x="300" y="226" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.9)" fontFamily="Space Grotesk,sans-serif" fontWeight="600">FlashPago</text>
      </svg>
    </div>
  );
}

// ─── MAIN ────────────────────────────────
export default function FlashPagoLanding({ onLogin }) {
  const handleLogin = () => {
    if (onLogin) onLogin();
  };

  const stats = [
    ["<8s", "Verificación"],
    ["5", "Bancos soportados"],
    ["24/7", "Disponible"],
  ];

  // Estilo dashboard: ícono + fondo suave de color
  const problemas = [
    { Icon: Clock, bg: "#FFF3E0", color: "#F57C00", title: "Pierdes tiempo", desc: "Cada comprobante requiere abrir la app del banco, buscar el pago, comparar montos. Minutos que se acumulan cada día." },
    { Icon: AlertTriangle, bg: "#FFEBEE", color: "#E53935", title: "Comprobantes falsos", desc: "Capturas editadas, comprobantes viejos reutilizados, pagos que nunca llegaron. Sin verificación, cualquiera puede estafarte." },
    { Icon: BarChart3, bg: "#EDE7F6", color: "#7E57C2", title: "Sin control", desc: "No sabes cuánto vendiste hoy, quién pagó, ni tienes un registro ordenado. Al final del día, las cuentas no cuadran." },
  ];

  const pasos = [
    { Icon: Camera, title: "Envía la foto", desc: "El empleado toma la foto del comprobante que le muestra el cliente y la envía al bot por WhatsApp." },
    { Icon: Bot, title: "La IA lo analiza", desc: "FlashPago lee el comprobante con inteligencia artificial, extrae el monto, banco, referencia y fecha automáticamente." },
    { Icon: CheckCircle2, title: "Verificación al instante", desc: "El bot cruza los datos con el banco para confirmar que el pago realmente llegó a tu cuenta. Respuesta en segundos." },
  ];

  const beneficios = [
    { Icon: Shield, bg: "#E3F2FD", color: "#1E88E5", title: "Protección contra fraudes", desc: "Detecta comprobantes falsos, editados o reutilizados. Nunca más te engañan con un pago que no existe." },
    { Icon: Zap, bg: "#FFF3E0", color: "#F57C00", title: "Verificación en menos de 10 segundos", desc: "Lo que te tomaba minutos ahora tarda segundos. Tu empleado solo envía la foto y listo." },
    { Icon: BarChart3, bg: "#E8F5E9", color: "#43A047", title: "Reportes automáticos", desc: "Recibe el cierre del día en tu WhatsApp sin pedirlo. Total de ventas, pagos confirmados y más." },
    { Icon: Search, bg: "#EDE7F6", color: "#7E57C2", title: "Registro completo de pagos", desc: "Cada pago queda guardado con nombre del cliente, monto, fecha, hora y foto del comprobante." },
    { Icon: RefreshCw, bg: "#FFEBEE", color: "#E53935", title: "Detección de duplicados", desc: "Si alguien intenta usar el mismo comprobante dos veces, FlashPago lo detecta y lo bloquea." },
    { Icon: MessageCircle, bg: "#E0F7FA", color: "#00ACC1", title: "Funciona por WhatsApp", desc: "No necesitas instalar apps nuevas. Todo se hace desde WhatsApp, que tu equipo ya usa todos los días." },
  ];

  const bancos = [
    { Icon: Landmark, label: "Bancolombia" },
    { Icon: Smartphone, label: "Nequi" },
    { Icon: Wallet, label: "Daviplata" },
    { Icon: Building2, label: "AV Villas" },
    { Icon: ArrowRight, label: "Transfiya" },
  ];

  const planes = [
    {
      name: "Básico", price: "$39.900",
      features: ["Verificación de pagos por WhatsApp", "Lectura con IA (5 bancos)", "Detección de duplicados", "Registro de pagos", "Soporte por WhatsApp"],
      disabled: ["Reportes automáticos", "Dashboard web"],
    },
    {
      name: "Premium", price: "$79.900", popular: true,
      features: ["Todo lo del plan Básico", "Reportes diarios automáticos", "Dashboard web", "Búsqueda de clientes", "Fotos de comprobantes", "Estadísticas del negocio", "Soporte prioritario"],
      disabled: [],
    },
    {
      name: "Empresarial", price: "$149.900",
      features: ["Todo lo del plan Premium", "Multi-sucursal", "Exportar a Excel", "Usuarios ilimitados", "Soporte dedicado"],
      disabled: [], pronto: ["API bancaria directa (pronto)", "Integración contable (pronto)"],
    },
  ];

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", color: COLORS.oscuro, lineHeight: 1.6, overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
        html { scroll-behavior: smooth; }
        body { margin: 0; }
        .nav-links-list { display: flex; flex-direction: row; }
        @keyframes typingDot { 0%,60%,100%{opacity:.3;transform:scale(.8)} 30%{opacity:1;transform:scale(1.1)} }
        @keyframes popIn { 0%{transform:scale(0);opacity:0} 70%{transform:scale(1.2)} 100%{transform:scale(1);opacity:1} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @media(max-width:1024px) {
       .hero-grid { gap:2rem !important; }
       .grid-3 { grid-template-columns:repeat(2,1fr) !important; }
       .planes-grid-wrap { grid-template-columns:repeat(2,1fr) !important; }
    }
  @media(max-width:768px) {
  .menu-toggle-btn { display:flex !important; }
  .nav-links-list { display:none; }
  .hero-grid { grid-template-columns:1fr !important; text-align:center; }
  .hero-visual-wrap { order:-1; }
  .hero-h1 { font-size:2.2rem !important; }
  .hero-buttons-wrap { justify-content:center; }
  .hero-stats-wrap { justify-content:center; }
  .grid-3 { grid-template-columns:1fr !important; }
  .grid-2 { grid-template-columns:1fr !important; }
  .planes-grid-wrap { grid-template-columns:1fr !important; max-width:400px; margin:1rem auto 0; }
  .cta-h2 { font-size:1.8rem !important; }
}
@media(max-width:480px) {
  .hero-h1 { font-size:1.8rem !important; }
  .cta-h2 { font-size:1.5rem !important; }
}
      `}</style>

      <Nav onLogin={handleLogin} />

      {/* ─── HERO ─── */}
      <section style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${COLORS.oscuro} 0%, ${COLORS.oscuro2} 100%)`, display: "flex", alignItems: "center", padding: "8rem 2rem 4rem", position: "relative", overflow: "hidden", boxSizing: "border-box" }}>
        <div style={{ position: "absolute", top: "-50%", right: "-20%", width: "60vw", height: "60vw", background: "radial-gradient(circle, rgba(245,124,0,0.15) 0%, transparent 70%)", borderRadius: "50%" }} />
        <div className="hero-grid" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center", position: "relative", zIndex: 1, width: "100%" }}>
          <div>
            <h1 className="hero-h1" style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "3.5rem", fontWeight: 700, lineHeight: 1.1, color: COLORS.blanco, marginBottom: "1.5rem", marginTop: 0 }}>
              Verifica pagos por transferencia{" "}
              <span style={{ background: `linear-gradient(135deg, ${COLORS.naranja}, ${COLORS.naranjaSuave})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>en segundos</span>
            </h1>
            <p style={{ fontSize: "1.2rem", color: "#b0b0c8", marginBottom: "2rem", maxWidth: 500 }}>
              Bot de WhatsApp con inteligencia artificial que lee comprobantes, verifica pagos reales y protege tu negocio contra fraudes.
            </p>
            <div className="hero-buttons-wrap" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <a href="#contacto" style={{ background: COLORS.naranja, color: "white", padding: "1rem 2rem", borderRadius: 12, textDecoration: "none", fontWeight: 600, fontSize: "1.05rem", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <MessageCircle size={18} /> Quiero probarlo
              </a>
              <a href="#como-funciona" style={{ background: "transparent", color: COLORS.blanco, padding: "1rem 2rem", borderRadius: 12, textDecoration: "none", fontWeight: 600, fontSize: "1.05rem", border: "2px solid rgba(255,255,255,0.2)" }}>
                ¿Cómo funciona?
              </a>
            </div>
            <div className="hero-stats-wrap" style={{ display: "flex", gap: "2rem", marginTop: "2.5rem" }}>
              {stats.map(([num, label]) => (
                <div key={label}>
                  <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "1.8rem", fontWeight: 700, color: COLORS.naranja }}>{num}</div>
                  <div style={{ fontSize: "0.8rem", color: "#8888a8", marginTop: "0.2rem" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="hero-visual-wrap" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* ─── PROBLEMA ─── */}
      <section style={{ padding: "6rem 2rem", background: COLORS.blanco, boxSizing: "border-box" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "0.85rem", fontWeight: 600, color: COLORS.naranja, textTransform: "uppercase", letterSpacing: 2, marginBottom: "1rem" }}>El problema</div>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "2.5rem", fontWeight: 700, marginBottom: "1.5rem", lineHeight: 1.2, marginTop: 0 }}>¿Te ha pasado esto?</h2>
          <p style={{ fontSize: "1.1rem", color: COLORS.grisTxt, maxWidth: 650, marginBottom: "3rem" }}>Miles de negocios en Colombia pierden tiempo y dinero verificando transferencias manualmente.</p>
          <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "2rem" }}>
            {problemas.map(p => (
              <div key={p.title} style={{ background: COLORS.grisClaro, borderRadius: 16, padding: "2rem" }}>
                <div style={{ marginBottom: "1.25rem" }}>
                  <IconBadge icon={p.Icon} bg={p.bg} color={p.color} size={24} boxSize={48} />
                </div>
                <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "1.15rem", fontWeight: 600, marginBottom: "0.75rem", marginTop: 0 }}>{p.title}</h3>
                <p style={{ fontSize: "0.95rem", color: COLORS.grisTxt, margin: 0 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CÓMO FUNCIONA ─── */}
      <section id="como-funciona" style={{ padding: "6rem 2rem", background: COLORS.oscuro, color: COLORS.blanco, boxSizing: "border-box" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "0.85rem", fontWeight: 600, color: COLORS.naranja, textTransform: "uppercase", letterSpacing: 2, marginBottom: "1rem" }}>La solución</div>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "2.5rem", fontWeight: 700, color: COLORS.blanco, marginBottom: "1.5rem", lineHeight: 1.2, marginTop: 0 }}>Así de fácil funciona</h2>
          <p style={{ fontSize: "1.1rem", color: "#b0b0c8", maxWidth: 650, marginBottom: "1rem" }}>Tu empleado envía el comprobante al bot por WhatsApp. FlashPago hace el resto.</p>
          <HubDiagram />
          <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "2rem", marginTop: "1rem" }}>
            {pasos.map((p, i) => (
              <div key={p.title} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "2.5rem 2rem", textAlign: "center", position: "relative" }}>
                <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "3rem", fontWeight: 700, color: COLORS.naranja, opacity: 0.3, position: "absolute", top: "1rem", right: "1.5rem" }}>{i + 1}</div>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
                  <IconBadge icon={p.Icon} bg="rgba(245,124,0,0.15)" color={COLORS.naranjaSuave} size={26} boxSize={56} />
                </div>
                <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.75rem", marginTop: 0 }}>{p.title}</h3>
                <p style={{ fontSize: "0.95rem", color: "#b0b0c8", margin: 0 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── BENEFICIOS ─── */}
      <section id="beneficios" style={{ padding: "6rem 2rem", background: COLORS.blanco, boxSizing: "border-box" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "0.85rem", fontWeight: 600, color: COLORS.naranja, textTransform: "uppercase", letterSpacing: 2, marginBottom: "1rem" }}>Por qué FlashPago</div>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "2.5rem", fontWeight: 700, marginBottom: "1.5rem", lineHeight: 1.2, marginTop: 0 }}>Todo lo que tu negocio necesita</h2>
          <p style={{ fontSize: "1.1rem", color: COLORS.grisTxt, maxWidth: 650, marginBottom: "3rem" }}>Más que un bot — es el sistema de verificación de pagos de tu negocio.</p>
          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "1.5rem" }}>
            {beneficios.map(b => (
              <div key={b.title} style={{ display: "flex", gap: "1rem", padding: "1.5rem", borderRadius: 12 }}>
                <IconBadge icon={b.Icon} bg={b.bg} color={b.color} size={20} boxSize={44} />
                <div>
                  <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "1.05rem", fontWeight: 600, marginBottom: "0.3rem", marginTop: 0 }}>{b.title}</h3>
                  <p style={{ fontSize: "0.9rem", color: COLORS.grisTxt, margin: 0 }}>{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── BANCOS ─── */}
      <section style={{ padding: "4rem 2rem", background: COLORS.grisClaro, textAlign: "center", boxSizing: "border-box" }}>
        <p style={{ fontSize: "1rem", color: COLORS.grisTxt, marginBottom: "2rem", marginTop: 0 }}>Compatible con los principales bancos y billeteras de Colombia</p>
        <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", flexWrap: "wrap" }}>
          {bancos.map(b => (
            <span key={b.label} style={{ background: COLORS.blanco, padding: "0.75rem 1.5rem", borderRadius: 50, fontWeight: 600, fontSize: "0.9rem", color: COLORS.oscuro, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <b.Icon size={16} color={COLORS.naranja} /> {b.label}
            </span>
          ))}
        </div>
      </section>

      {/* ─── PLANES ─── */}
      <section id="planes" style={{ padding: "6rem 2rem", background: COLORS.blanco, boxSizing: "border-box" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "0.85rem", fontWeight: 600, color: COLORS.naranja, textTransform: "uppercase", letterSpacing: 2, marginBottom: "1rem" }}>Planes</div>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "2.5rem", fontWeight: 700, marginBottom: "1.5rem", lineHeight: 1.2, marginTop: 0 }}>Elige el plan para tu negocio</h2>
          <p style={{ fontSize: "1.1rem", color: COLORS.grisTxt, maxWidth: 650, marginBottom: "3rem" }}>Sin contratos largos. Cancela cuando quieras.</p>
          <div className="planes-grid-wrap" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "2rem" }}>
            {planes.map(plan => (
              <div key={plan.name} style={{ border: `2px solid ${plan.popular ? COLORS.naranja : "#e8e8f0"}`, borderRadius: 20, padding: "2.5rem 2rem", position: "relative", ...(plan.popular ? { background: "linear-gradient(180deg, rgba(245,124,0,0.03) 0%, transparent 100%)" } : {}) }}>
                {plan.popular && (
                  <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: COLORS.naranja, color: "white", padding: "0.3rem 1.2rem", borderRadius: 50, fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                    <Star size={12} fill="white" /> Más popular
                  </div>
                )}
                <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.5rem" }}>{plan.name}</div>
                <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "2.5rem", fontWeight: 700, color: COLORS.naranja, marginBottom: "0.25rem" }}>{plan.price}</div>
                <div style={{ fontSize: "0.9rem", color: COLORS.grisTxt, marginBottom: "2rem" }}>COP / mes</div>
                <ul style={{ listStyle: "none", padding: 0, marginBottom: "2rem", margin: "0 0 2rem 0" }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ padding: "0.5rem 0", fontSize: "0.9rem", color: COLORS.grisTxt, display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <Check size={16} color={COLORS.naranja} strokeWidth={3} style={{ flexShrink: 0, marginTop: 3 }} /> {f}
                    </li>
                  ))}
                  {plan.disabled?.map(f => (
                    <li key={f} style={{ padding: "0.5rem 0", fontSize: "0.9rem", color: COLORS.grisTxt, opacity: 0.4, display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <Minus size={16} color="#ccc" style={{ flexShrink: 0, marginTop: 3 }} /> {f}
                    </li>
                  ))}
                  {plan.pronto?.map(f => (
                    <li key={f} style={{ padding: "0.5rem 0", fontSize: "0.9rem", color: COLORS.grisTxt, display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <Hourglass size={16} color={COLORS.naranjaSuave} style={{ flexShrink: 0, marginTop: 3 }} /> {f}
                    </li>
                  ))}
                </ul>
                <a href="#contacto" style={{ display: "block", width: "100%", padding: "0.9rem", borderRadius: 12, fontWeight: 600, fontSize: "1rem", textAlign: "center", textDecoration: "none", cursor: "pointer", boxSizing: "border-box", ...(plan.popular ? { background: COLORS.naranja, color: "white" } : { background: "transparent", color: COLORS.naranja, border: `2px solid ${COLORS.naranja}` }) }}>
                  {plan.name === "Empresarial" ? "Contactar" : "Empezar"}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section id="contacto" style={{ padding: "6rem 2rem", background: `linear-gradient(135deg, ${COLORS.oscuro} 0%, ${COLORS.oscuro2} 100%)`, textAlign: "center", position: "relative", overflow: "hidden", boxSizing: "border-box" }}>
        <div style={{ position: "absolute", bottom: "-30%", left: "-10%", width: "40vw", height: "40vw", background: "radial-gradient(circle, rgba(245,124,0,0.1) 0%, transparent 70%)", borderRadius: "50%" }} />
        <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative" }}>
          <h2 className="cta-h2" style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "2.5rem", fontWeight: 700, color: COLORS.blanco, marginBottom: "1rem", marginTop: 0 }}>¿Listo para proteger tu negocio?</h2>
          <p style={{ fontSize: "1.1rem", color: "#b0b0c8", marginBottom: "2rem", maxWidth: 550, marginLeft: "auto", marginRight: "auto" }}>Escríbenos por WhatsApp y te activamos FlashPago en menos de 24 horas. Sin contratos, sin complicaciones.</p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <a href="https://wa.me/57XXXXXXXXXX?text=Hola%2C%20quiero%20conocer%20más%20sobre%20FlashPago" target="_blank" rel="noopener noreferrer" style={{ background: COLORS.naranja, color: "white", padding: "1rem 2rem", borderRadius: 12, textDecoration: "none", fontWeight: 600, fontSize: "1.05rem", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <MessageCircle size={18} /> Escribir por WhatsApp
            </a>
            <button onClick={handleLogin} style={{ background: "transparent", color: COLORS.blanco, padding: "1rem 2rem", borderRadius: 12, fontWeight: 600, fontSize: "1.05rem", border: "2px solid rgba(255,255,255,0.2)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "'Inter',sans-serif" }}>
              <Lock size={17} /> Ir al Panel
            </button>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{ background: "#0d0d1a", padding: "2.5rem 2rem", textAlign: "center", boxSizing: "border-box" }}>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: "1.2rem", color: COLORS.naranja, marginBottom: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Zap size={18} fill={COLORS.naranja} />
          Flash<span style={{ color: COLORS.blanco }}>Pago</span>
        </div>
        <p style={{ color: "#6868a0", fontSize: "0.85rem", margin: "0 0 0.75rem 0" }}>Verificación de pagos con inteligencia artificial — Hecho en Colombia 🇨🇴</p>
        <p style={{ color: "#6868a0", fontSize: "0.75rem", margin: 0 }}>© 2026 FlashPago. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}