import { ArrowLeft } from 'lucide-react';

export default function Terminos({ onVolver }) {
  return (
    <div style={{ fontFamily: "'Inter',sans-serif", background: "#1A1A2E", minHeight: "100vh", color: "#e0e0e0" }}>
      <nav style={{ background: "rgba(26,26,46,0.97)", padding: "1rem 2rem", display: "flex", alignItems: "center", gap: "1rem", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(12px)" }}>
        <button onClick={onVolver} style={{ background: "none", border: "none", color: "#F57C00", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: "0.9rem" }}>
          <ArrowLeft size={18} /> Volver
        </button>
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, color: "#F57C00" }}>
          Flash<span style={{ color: "#fff" }}>Pago</span>
        </span>
      </nav>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 2rem" }}>
        <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "2rem", color: "#fff", marginBottom: "0.5rem" }}>
          Términos y Condiciones
        </h1>
        <p style={{ color: "#8888a8", marginBottom: "2.5rem" }}>Última actualización: Agosto 2026</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "2rem", lineHeight: 1.8, fontSize: "0.95rem" }}>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>1. Aceptación de los términos</h2>
            <p>Al usar FlashPago aceptas estos términos y condiciones. Si no estás de acuerdo, no uses el servicio. El uso continuado del servicio constituye aceptación de cualquier actualización de estos términos.</p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>2. Descripción del servicio</h2>
            <p>FlashPago es un servicio de verificación de comprobantes de pago por WhatsApp que utiliza inteligencia artificial para leer y validar transferencias bancarias. El servicio incluye lectura de comprobantes, detección de duplicados, reportes automáticos y panel de administración según el plan contratado.</p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>3. Uso del servicio</h2>
            <p>El usuario se compromete a usar FlashPago únicamente para verificar pagos legítimos de su negocio. Está prohibido usar el servicio para actividades ilegales, fraude, lavado de activos o cualquier actividad contraria a la ley colombiana.</p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>4. Precisión de la verificación</h2>
            <p>FlashPago utiliza inteligencia artificial para leer comprobantes. Aunque la precisión es alta, no garantizamos que la lectura sea 100% correcta en todos los casos. El usuario es responsable de confirmar pagos críticos directamente con su entidad bancaria.</p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>5. Privacidad y datos</h2>
            <p>FlashPago almacena datos de pagos verificados (monto, referencia, banco, fecha, foto del comprobante) para el funcionamiento del servicio. Estos datos son confidenciales y no se comparten con terceros. Las imágenes de comprobantes se almacenan de forma segura y solo son accesibles por usuarios autorizados del negocio.</p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>6. Integración con Gmail y acceso a notificaciones bancarias</h2>
            <p>FlashPago utiliza la API de Gmail de Google para verificar pagos en tiempo real. Para que el servicio funcione, el titular del negocio debe conceder acceso de lectura a la cuenta de Gmail donde recibe las notificaciones bancarias (Bancolombia, Nequi, Daviplata, etc.).</p>
            <p style={{ marginTop: "0.75rem" }}>Al autorizar el acceso, FlashPago únicamente lee los correos de notificación de transacciones bancarias para cruzar los datos con los comprobantes enviados. FlashPago NO lee, almacena ni accede a correos personales, contactos, ni ningún otro dato de la cuenta de Gmail.</p>
            <p style={{ marginTop: "0.75rem" }}>El usuario puede revocar el acceso a Gmail en cualquier momento desde su cuenta de Google (myaccount.google.com → Seguridad → Aplicaciones de terceros). Al revocar el acceso, la verificación automática de pagos dejará de funcionar.</p>
            <p style={{ marginTop: "0.75rem" }}>FlashPago cumple con las políticas de uso de la API de Gmail de Google y no comparte los datos obtenidos con terceros.</p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>6. Planes y pagos</h2>
            <p>Los precios están en pesos colombianos (COP) y se facturan mensualmente. El servicio puede cancelarse en cualquier momento sin penalización. No se realizan reembolsos por días no utilizados del periodo en curso.</p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>7. Disponibilidad</h2>
            <p>FlashPago funciona 24/7, sin embargo, pueden existir interrupciones por mantenimiento, actualizaciones o causas de fuerza mayor. No nos hacemos responsables por pérdidas derivadas de la indisponibilidad temporal del servicio.</p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>8. Responsabilidad</h2>
            <p>FlashPago es una herramienta de apoyo para la verificación de pagos. La decisión final de aceptar o rechazar un pago es responsabilidad del usuario. FlashPago no se hace responsable por pérdidas económicas derivadas de pagos fraudulentos que no hayan sido detectados por el sistema.</p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>9. Propiedad intelectual</h2>
            <p>FlashPago, su logo, diseño y tecnología son propiedad de sus creadores. Queda prohibida la reproducción, distribución o modificación del servicio sin autorización.</p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>10. Modificaciones</h2>
            <p>Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios se notificarán a los usuarios y entrarán en vigencia al publicarse.</p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>11. Contacto</h2>
            <p>Para preguntas sobre estos términos, contáctanos por WhatsApp o a través de nuestra página web.</p>
          </section>

        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: "3rem", paddingTop: "1.5rem", textAlign: "center", color: "#6868a0", fontSize: "0.8rem" }}>
          © 2026 FlashPago. Todos los derechos reservados. Hecho en Colombia 🇨🇴
        </div>
      </div>
    </div>
  );
}