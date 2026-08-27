import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { createApiClient } from '../services/api';

/**
 * NotificacionesEnVivo — Muestra en la esquina superior derecha una notificación
 * flotante (toast) cada vez que se detecta:
 *   - Un pago REAL nuevo 👍
 *   - Un pago NO_ENCONTRADO nuevo ⚠️ (no pudo verificar)
 *   - Un pago PENDIENTE nuevo 🕓 (duplicado por revisar)
 *
 * Funciona por polling (consulta cada N segundos) y compara contra el último
 * estado visto para saber qué es "nuevo". No modifica ningún componente existente.
 */

function NotificacionesEnVivo({ onLogout }) {
  const api = useMemo(() => createApiClient(onLogout), [onLogout]);
  const [notificaciones, setNotificaciones] = useState([]); // cola de toasts
  const audioRef = useRef(null);
  const ultimoPagoId = useRef(0);        // id máx de pagos REAL vistos
  const ultimaCantPend = useRef(0);      // cantidad de pendientes (NO_ENCONTRADO) vistos
  const ultimasDupIds = useRef(new Set()); // ids de duplicados vistos
  const iniciado = useRef(false);        // ¿ya cargamos el estado base?

  // formatear monto
  const formatearMonto = (monto) => '$' + Number(monto).toLocaleString('es-CO');

  // Reproducir sonido cuando llega una notificación de pago verificado
  const reproducirSonido = useCallback(async () => {
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
      }
    } catch (err) {
      // Silenciar si el navegador bloquea la reproducción de audio
      console.debug('Audio de notificación bloqueado por el navegador');
    }
  }, []);

  // Anunciar el pago en voz alta (como una caja registradora con voz)
  const anunciarPagoEnVoz = useCallback((monto, nombreCliente) => {
    try {
      if (!('speechSynthesis' in window)) return;
      const texto = `Pago confirmado${nombreCliente ? ' de ' + nombreCliente : ''}. ${monto} pesos.`;
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = 'es-CO';
      utterance.rate = 1;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.debug('Anuncio de voz no disponible en este navegador');
    }
  }, []);

  // Mostrar un toast (y sonar/anunciar en voz para pagos REAL verificados)
  const mostrarNotificacion = useCallback(({ tipo, titulo, detalle, monto, nombreCliente }) => {
    const id = Date.now() + Math.random();
    setNotificaciones((prev) => [...prev, { id, tipo, titulo, detalle }]);
    if (tipo === 'real') {
      reproducirSonido();
      if (monto) anunciarPagoEnVoz(monto, nombreCliente);
    }
    // auto-ocultar después de 5s
    setTimeout(() => {
      setNotificaciones((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }, [reproducirSonido, anunciarPagoEnVoz]);

  // Detección de novedades
  const revisarNovedades = useCallback(async () => {
    try {
      // 1. Pagos REAL recientes (detectar nuevos por id)
      const pagos = await api.request('/api/dashboard/pagos?limite=10');
      if (Array.isArray(pagos) && pagos.length > 0) {
        const nuevoMax = Math.max(...pagos.map((p) => p.id));
        if (iniciado.current && nuevoMax > ultimoPagoId.current) {
          // hay pagos nuevos
          const nuevos = pagos
            .filter((p) => p.id > ultimoPagoId.current)
            .sort((a, b) => a.id - b.id);
          nuevos.forEach((p) => {
            mostrarNotificacion({
              tipo: 'real',
              titulo: 'Nuevo pago verificado',
              detalle: `${p.nombre_cliente || 'Cliente'} pagó ${formatearMonto(p.monto)} · ${p.banco || ''}`,
              monto: p.monto,
              nombreCliente: p.nombre_cliente,
            });
          });
        }
        ultimoPagoId.current = nuevoMax;
      }

      // 2. Pendientes NO_ENCONTRADO (detectar aumento de cantidad)
      const pendientes = await api.request('/api/dashboard/pendientes');
      if (pendientes && typeof pendientes.cantidad === 'number') {
        if (iniciado.current && pendientes.cantidad > ultimaCantPend.current) {
          const delta = pendientes.cantidad - ultimaCantPend.current;
          mostrarNotificacion({
            tipo: 'no-encontrado',
            titulo: `${delta} pago${delta === 1 ? '' : 's'} sin verificar`,
            detalle: `${formatearMonto(pendientes.total)} en pagos NO_ENCONTRADO por revisar`,
          });
        }
        ultimaCantPend.current = pendientes.cantidad;
      }

      // 3. Duplicados pendientes (detectar nuevos ids)
      const duplicados = await api.request('/api/dashboard/duplicados?estado=PENDIENTE');
      if (Array.isArray(duplicados)) {
        duplicados.forEach((d) => {
          if (iniciado.current && !ultimasDupIds.current.has(d.id)) {
            mostrarNotificacion({
              tipo: 'duplicado',
              titulo: 'Posible duplicado detectado',
              detalle: `${d.nombre_cliente || 'Cliente'} · ${formatearMonto(d.monto)} · Ref ${d.referencia || '—'}`,
            });
          }
          ultimasDupIds.current.add(d.id);
        });
      }

      iniciado.current = true;
    } catch (err) {
      // Si hay error (ej. token expirado), silenciar para no molestar
      console.debug('NotificacionesEnVivo: sin novedades por ahora');
    }
  }, [api, mostrarNotificacion]);

  useEffect(() => {
    // Primera carga: establece el estado base (no muestrad notificaciones).
    // Después, cada 20s revisa novedades.
    const inicial = async () => {
      try {
        const [pagos, pendientes, duplicados] = await Promise.all([
          api.request('/api/dashboard/pagos?limite=10'),
          api.request('/api/dashboard/pendientes'),
          api.request('/api/dashboard/duplicados?estado=PENDIENTE'),
        ]);
        if (Array.isArray(pagos) && pagos.length > 0) {
          ultimoPagoId.current = Math.max(...pagos.map((p) => p.id));
        }
        if (pendientes && typeof pendientes.cantidad === 'number') {
          ultimaCantPend.current = pendientes.cantidad;
        }
        if (Array.isArray(duplicados)) {
          ultimasDupIds.current = new Set(duplicados.map((d) => d.id));
        }
        iniciado.current = true;
      } catch (err) {
        // Ignorar el primer error; los siguientes intentos tendrán el estado base
      }
    };
    inicial();

    const intervalo = setInterval(revisarNovedades, 20000);
    return () => clearInterval(intervalo);
  }, [api, revisarNovedades]);

  // Estilo e icono según tipo (usa los mismos iconos de lucide-react del dashboard)
  const estilo = (tipo) => {
    if (tipo === 'real')
      return {
        bg: '#E8F5E9', borde: '#2ecc71', color: '#2ecc71',
        Icono: () => <CheckCircle size={22} strokeWidth={2.2} style={{ color: '#2ecc71' }} />,
      };
    if (tipo === 'no-encontrado')
      return {
        bg: '#FFF3E0', borde: '#F57C00', color: '#F57C00',
        Icono: () => <AlertTriangle size={22} strokeWidth={2.2} style={{ color: '#F57C00' }} />,
      };
    return {
      bg: '#FFEBEE', borde: '#e74c3c', color: '#e74c3c',
      Icono: () => <XCircle size={22} strokeWidth={2.2} style={{ color: '#e74c3c' }} />,
    };
  };

  return (
    <>
      {/* Elemento de audio siempre montado para poder reproducir el sonido */}
      <audio ref={audioRef} src="/notificacion_pago.mp3" preload="auto" style={{ display: 'none' }} />
      {notificaciones.length > 0 && (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 3000,
      display: 'flex', flexDirection: 'column', gap: '0.75rem',
      maxWidth: 340, pointerEvents: 'none',
    }}>
      {notificaciones.map((n) => {
        const s = estilo(n.tipo);
        const Icono = s.Icono;
        return (
          <div key={n.id} style={{
            pointerEvents: 'auto',
            background: '#fff', borderLeft: `4px solid ${s.borde}`,
            borderRadius: 12, padding: '0.9rem 1.1rem',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', gap: '0.7rem',
            animation: 'toastIn 0.4s cubic-bezier(.25,1,.5,1) both',
          }}>
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, borderRadius: 10, background: s.bg, flexShrink: 0,
            }}>
              <Icono />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1a1a2e' }}>{n.titulo}</div>
              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.2rem', wordBreak: 'break-word' }}>{n.detalle}</div>
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
      )}
    </>
  );
}

export default NotificacionesEnVivo;
