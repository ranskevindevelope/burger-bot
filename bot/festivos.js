// festivos.js — Calcula los días festivos de Colombia según la Ley Emiliani
// Permite saber si hoy es festivo para decidir horarios de reportes/verificación.

// ─── Devuelve la fecha de Pascua (Domingo de Resurrección) de un año dada.
//     Algoritmo de computus de Jean Meeus / Anonymous Gregorian.
function calcularPascua(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
}

// Regla de la Ley Emiliani (Ley 51 de 1983):
// Los festivos movibles se celebran el LUNES de la misma semana cuando la
// fecha fija cae en sábado, domingo o lunes. Si cae en martes, miércoles,
// jueves o viernes, se celebra ese mismo día (no se traslada).
function trasladarALunes(fecha) {
  const d = new Date(fecha);
  const dia = d.getDay(); // 0=dgo, 1=lun, 6=sáb
  // Solo se traslada si cae en sábado (6) o domingo (0).
  if (dia === 6) {
    // sábado → lunes siguiente (+2)
    d.setDate(d.getDate() + 2);
  } else if (dia === 0) {
    // domingo → lunes siguiente (+1)
    d.setDate(d.getDate() + 1);
  }
  // si ya es lunes (1) o cae de martes a viernes, se mantiene la fecha
  return d;
}

// ─── Convierte una fecha en "YYYY-MM-DD" para comparar de forma simple
function aYMD(fecha) {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

// ─── Lista de festivos de un año dado (array de Date ya trasladados/calculados)
function festivosDelAnio(anio) {
  const festivos = [];

  // Festivos fijos que NO se trasladan
  festivos.push(new Date(anio, 0, 1));           // Año Nuevo
  festivos.push(new Date(anio, 4, 1));           // Día del Trabajo
  festivos.push(new Date(anio, 6, 20));          // Independencia
  festivos.push(new Date(anio, 7, 7));           // Batalla de Boyacá
  festivos.push(new Date(anio, 11, 25));         // Navidad

  // Festivos que SÍ se trasladan al lunes siguiente
  festivos.push(trasladarALunes(new Date(anio, 0, 6)));      // Reyes Magos
  festivos.push(trasladarALunes(new Date(anio, 2, 19)));     // San José
  festivos.push(trasladarALunes(new Date(anio, 5, 29)));     // San Pedro y San Pablo
  festivos.push(trasladarALunes(new Date(anio, 7, 15)));     // Asunción
  festivos.push(trasladarALunes(new Date(anio, 9, 12)));     // Día de la Raza
  festivos.push(trasladarALunes(new Date(anio, 10, 1)));     // Todos los Santos
  festivos.push(trasladarALunes(new Date(anio, 10, 11)));    // Independencia de Cartagena
  festivos.push(trasladarALunes(new Date(anio, 11, 8)));     // Inmaculada Concepción

  // Semana Santa (fechas variables): Jueves y Viernes Santo
  const pascua = calcularPascua(anio);
  const juevesSanto = new Date(pascua);
  juevesSanto.setDate(juevesSanto.getDate() - 3);
  const viernesSanto = new Date(pascua);
  viernesSanto.setDate(viernesSanto.getDate() - 2);

  festivos.push(juevesSanto);
  festivos.push(viernesSanto);

  return festivos.map(aYMD);
}

// ─── ¿Es festivo la fecha dada? (si no se pasa fecha, usa hoy)
function esFestivo(fecha = new Date()) {
  const anio = fecha.getFullYear();
  const fechaStr = aYMD(fecha);
  return festivosDelAnio(anio).includes(fechaStr);
}

// ─── ¿Es fin de semana? (sábado o domingo)
function esFinDeSemana(fecha = new Date()) {
  const dia = fecha.getDay();
  return dia === 0 || dia === 6;
}

// ─── ¿Es un día laborable en Colombia? (ni festivo, ni fin de semana)
function esDiaLaborable(fecha = new Date()) {
  return !esFestivo(fecha) && !esFinDeSemana(fecha);
}

module.exports = {
  esFestivo,
  esFinDeSemana,
  esDiaLaborable,
  festivosDelAnio,
};
