import { ArrowLeft } from 'lucide-react';

export default function Privacidad({ onVolver }) {
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
          Política de Tratamiento de Datos Personales
        </h1>
        <p style={{ color: "#8888a8", marginBottom: "2.5rem" }}>Última actualización: Agosto 2026</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "2rem", lineHeight: 1.8, fontSize: "0.95rem" }}>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>1. Responsable del tratamiento</h2>
            <p>
              <strong>Kevin Ramírez Torres</strong>, identificado con cédula de ciudadanía No. <strong>70118928-1</strong>,
              actuando bajo el nombre comercial <strong>Vinson Burgers</strong> (registrado ante la Cámara de Comercio),
              con domicilio en Antioquia, Colombia, correo de contacto <strong>contacto@flashpago.co</strong> y WhatsApp{' '}
              <strong>+57 316 7064671</strong>, en calidad de responsable del tratamiento de datos personales
              recolectados a través de la plataforma <strong>FlashPago</strong> (sitio web, panel de administración
              y bot de WhatsApp), en adelante "FlashPago" o "el Servicio".
            </p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>2. Marco legal aplicable</h2>
            <p>
              Esta política se rige por la <strong>Constitución Política de Colombia (artículo 15)</strong>, la{' '}
              <strong>Ley Estatutaria 1581 de 2012</strong> ("Ley de Protección de Datos Personales" o Habeas Data), el{' '}
              <strong>Decreto 1377 de 2013</strong> (compilado en el <strong>Decreto Único Reglamentario 1074 de 2015</strong>,
              Título 2, Capítulo 25) y la <strong>Circular Externa 002 de 2015</strong> de la Superintendencia de
              Industria y Comercio (SIC), así como las demás normas que las modifiquen, adicionen o sustituyan.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>3. Datos personales que recopilamos</h2>
            <p>Según cómo se use el Servicio, recopilamos:</p>
            <p style={{ marginTop: "0.75rem" }}>
              <strong>De los negocios registrados y sus empleados:</strong> nombre, número de WhatsApp, correo
              electrónico, ciudad, banco principal, usuario y contraseña (esta última nunca se almacena en texto
              plano, ver sección 9).
            </p>
            <p style={{ marginTop: "0.75rem" }}>
              <strong>De las transacciones verificadas:</strong> monto, referencia bancaria, banco, fecha y hora,
              nombre del cliente que realizó el pago (cuando aparece en el comprobante o en la notificación
              bancaria), y la imagen del comprobante enviado por WhatsApp.
            </p>
            <p style={{ marginTop: "0.75rem" }}>
              <strong>Datos técnicos:</strong> dirección IP, fecha y hora de acceso, y registros (logs) de uso del
              Servicio, con fines de seguridad y prevención de fraude.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>4. Finalidades del tratamiento</h2>
            <p>Los datos recolectados se usan exclusivamente para:</p>
            <p style={{ marginTop: "0.75rem" }}>
              a) Verificar la autenticidad de comprobantes de pago mediante inteligencia artificial y cruce con
              notificaciones bancarias.<br />
              b) Detectar comprobantes duplicados o fraudulentos.<br />
              c) Generar reportes, estadísticas y el panel de administración de cada negocio.<br />
              d) Enviar notificaciones operativas por WhatsApp o correo electrónico (confirmaciones, alertas,
              códigos de verificación, reportes diarios).<br />
              e) Gestionar el registro, autenticación y facturación de las cuentas.<br />
              f) Cumplir obligaciones legales y atender requerimientos de autoridades competentes.
            </p>
            <p style={{ marginTop: "0.75rem" }}>
              No usamos los datos personales para fines publicitarios de terceros ni los vendemos ni los cedemos a
              cambio de una contraprestación.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>5. Cómo se obtiene su autorización</h2>
            <p>
              La autorización para el tratamiento de datos se obtiene de forma previa, expresa e informada al momento
              del registro en la plataforma, mediante la aceptación explícita de esta Política y de los{' '}
              <strong>Términos y Condiciones</strong>. En el caso de la conexión con Gmail, la autorización adicional
              se otorga directamente a través del flujo de consentimiento (OAuth) de Google, y puede revocarse en
              cualquier momento desde la cuenta de Google del negocio.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>6. Encargados del tratamiento y proveedores</h2>
            <p>
              Para operar el Servicio, algunos datos se comparten con proveedores tecnológicos que actúan como{' '}
              <strong>encargados del tratamiento</strong> (procesan los datos por cuenta nuestra, no como
              responsables independientes):
            </p>
            <p style={{ marginTop: "0.75rem" }}>
              <strong>Lectura automática del comprobante:</strong> para leer el monto, el banco, la referencia y la
              fecha de la foto que envías por WhatsApp, usamos un servicio de inteligencia artificial (Anthropic).
              Solo procesa la imagen del comprobante — nunca contraseñas ni otros datos financieros.<br />
              <strong>Confirmación con tu banco:</strong> para confirmar tus pagos automáticamente, comparamos los
              comprobantes con las notificaciones que tu banco te envía por correo. Esto requiere que el negocio
              autorice el acceso una sola vez a través de Google; FlashPago solo revisa esas notificaciones
              bancarias, nunca correos personales ni contactos, y esa autorización se puede revocar cuando quieras.<br />
              <strong>Verificación bancaria complementaria (Prometeo):</strong> un método adicional de confirmación
              directa con el banco, cuando el negocio lo tiene activado.<br />
              <strong>Cobro de tu suscripción (Wompi):</strong> el pago de tu plan de FlashPago se procesa a través
              de Wompi, una pasarela de pagos certificada. FlashPago nunca ve ni almacena el número de tu tarjeta —
              eso lo maneja Wompi directamente.<br />
              <strong>Envío de mensajes (OpenWA):</strong> intermediario técnico para enviar y recibir los mensajes
              del bot de WhatsApp.<br />
              <strong>Hosting:</strong> el proveedor donde vive el servidor almacena la base de datos y las imágenes
              de comprobantes de forma segura.
            </p>
            <p style={{ marginTop: "0.75rem" }}>
              Todos los encargados están obligados contractualmente o por sus propios términos de servicio a
              proteger la información y a no usarla para fines distintos a los aquí descritos.
            </p>
            <p style={{ marginTop: "0.75rem" }}>
              <strong>Uso de datos de Google (Gmail):</strong> el acceso a Gmail que el negocio autoriza mediante
              Google OAuth se usa exclusivamente para comparar automáticamente el monto de un comprobante de pago
              con las notificaciones bancarias que el negocio recibe por correo, con el fin de confirmar
              transacciones de forma automática. No se usa para ningún otro propósito — no se usa para publicidad,
              no se usa para entrenar modelos de inteligencia artificial ni sistemas de aprendizaje automático, y
              no se transfiere a terceros salvo lo estrictamente necesario para prestar esta funcionalidad de
              verificación. El uso y la transferencia por parte de FlashPago de la información recibida de las
              APIs de Google cumplen con la{' '}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" style={{ color: "#F57C00" }}>
                Google API Services User Data Policy
              </a>, incluyendo los requisitos de Uso Limitado ("Limited Use").
            </p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>7. Transferencia y transmisión internacional de datos</h2>
            <p>
              Algunos de los proveedores mencionados en la sección 6 (Anthropic, Google) procesan información en
              servidores ubicados fuera de Colombia. Al aceptar esta Política, el titular autoriza dicha
              transmisión internacional, la cual se realiza únicamente para las finalidades descritas y bajo los
              estándares de protección exigidos por la legislación colombiana, conforme al artículo 26 de la Ley
              1581 de 2012.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>8. Tiempo de conservación</h2>
            <p>
              Los datos se conservan mientras la cuenta del negocio esté activa y durante el tiempo adicional
              necesario para cumplir obligaciones legales, contables o fiscales, o para atender eventuales
              reclamaciones. Al solicitar la eliminación de una cuenta, los datos personales se eliminan o
              anonimizan, salvo aquellos que debamos conservar por mandato legal.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>9. Medidas de seguridad</h2>
            <p>
              Aplicamos medidas técnicas y administrativas razonables para proteger los datos personales, entre
              ellas: contraseñas almacenadas mediante funciones de cifrado unidireccional con sal aleatoria (nunca
              en texto plano), control de acceso basado en roles y por negocio, límite de intentos de inicio de
              sesión, y comunicación cifrada (HTTPS) para el acceso al panel de administración.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>10. Derechos del titular de los datos</h2>
            <p>Como titular de datos personales, usted tiene derecho a:</p>
            <p style={{ marginTop: "0.75rem" }}>
              a) Conocer, actualizar y rectificar sus datos personales.<br />
              b) Solicitar prueba de la autorización otorgada.<br />
              c) Ser informado sobre el uso que se le ha dado a sus datos.<br />
              d) Presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a la ley.<br />
              e) Revocar la autorización y/o solicitar la supresión de sus datos, cuando no exista un deber legal
              o contractual que impida eliminarlos.<br />
              f) Acceder de forma gratuita a sus datos personales que hayan sido objeto de tratamiento.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>11. Cómo ejercer sus derechos</h2>
            <p>
              Las solicitudes relacionadas con sus datos personales (consultas, reclamos, actualización,
              rectificación o supresión) pueden enviarse al correo <strong>contacto@flashpago.co</strong> o al
              WhatsApp <strong>+57 316 7064671</strong>, indicando su nombre, el negocio asociado y el motivo
              de la solicitud. Las consultas se atenderán en un plazo máximo de <strong>10 días hábiles</strong>{' '}
              (prorrogable 5 días hábiles más, informando el motivo) y los reclamos en un plazo máximo de{' '}
              <strong>15 días hábiles</strong>, conforme al artículo 14 de la Ley 1581 de 2012.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>12. Menores de edad</h2>
            <p>
              FlashPago está dirigido a negocios y personas mayores de edad. No recolectamos intencionalmente
              datos de menores de edad. Si detectamos que se registró una cuenta a nombre de un menor, procederemos
              a eliminar la información correspondiente.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>13. Almacenamiento local y sesión</h2>
            <p>
              El panel de administración guarda en el navegador (localStorage) el token de sesión y datos básicos
              del usuario autenticado, únicamente para mantener la sesión iniciada. Esta información permanece en
              el dispositivo del usuario y se elimina al cerrar sesión.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>14. Autoridad de control</h2>
            <p>
              La autoridad competente en Colombia para vigilar el cumplimiento de la normativa de protección de
              datos personales es la <strong>Superintendencia de Industria y Comercio (SIC)</strong>, Delegatura
              para la Protección de Datos Personales.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>15. Cambios a esta política</h2>
            <p>
              Esta Política puede actualizarse para reflejar cambios en el Servicio o en la normativa aplicable.
              Los cambios sustanciales se notificarán a los usuarios registrados por correo electrónico o WhatsApp
              antes de su entrada en vigencia.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#F57C00", fontSize: "1.1rem", marginBottom: "0.5rem" }}>16. Contacto</h2>
            <p>
              Para preguntas sobre esta Política o el tratamiento de sus datos personales, contáctenos en{' '}
              <strong>contacto@flashpago.co</strong> o por WhatsApp al <strong>+57 316 7064671</strong>.
            </p>
          </section>

        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: "3rem", paddingTop: "1.5rem", textAlign: "center", color: "#6868a0", fontSize: "0.8rem" }}>
          © 2026 FlashPago. Todos los derechos reservados. Hecho en Colombia 🇨🇴
        </div>
      </div>
    </div>
  );
}
