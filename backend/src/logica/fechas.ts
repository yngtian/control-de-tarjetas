/* ============================================================
   Cálculos de fechas (funciones puras: no dependen de React)
   ============================================================ */

// lista con los nombres de los 12 meses
export const MESES = [
  // meses de la primera mitad del año
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  // meses de la segunda mitad del año
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Identifica un mes como "2026-10" (el mes siempre con 2 dígitos).
 * Sirve para saber si algo ya se pagó en el mes actual: al cambiar de mes
 * la clave cambia sola y lo pagado vuelve a quedar pendiente.
 * Con 2 dígitos las claves se pueden comparar como texto ("2026-09" < "2026-10").
 */
export function claveMes(fecha: Date = new Date()): string {
  // junta el año y el mes con dos dígitos, ej: "2026-10"
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

/** Clave del mes siguiente: de "2026-12" pasa a "2027-01" sin problemas. */
export function claveMesSiguiente(fecha: Date = new Date()): string {
  // toma el día 1 del mes que viene y saca su clave
  return claveMes(new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1));
}

/** Nombre del mes de una clave: "2026-11" -> "Noviembre". */
export function nombreMesDeClave(clave: string): string {
  // saca el número del mes y busca su nombre en la lista
  return MESES[parseInt(clave.split('-')[1], 10) - 1];
}

/** Nombre del mes con año: "2027-02" -> "Febrero 2027". */
export function nombreMesConAnio(clave: string): string {
  // junta el nombre del mes con el año
  return `${nombreMesDeClave(clave)} ${clave.split('-')[0]}`;
}

/** Suma meses a una clave: sumarMeses("2026-11", 3) -> "2027-02". */
export function sumarMeses(clave: string, cantidad: number): string {
  // separa el año y el mes de la clave
  const [anio, mes] = clave.split('-').map(Number);
  // avanza los meses pedidos y devuelve la nueva clave
  return claveMes(new Date(anio, mes - 1 + cantidad, 1));
}

/** Meses que hay de una clave a otra: mesesEntre("2026-11", "2027-02") -> 3. */
export function mesesEntre(desde: string, hasta: string): number {
  // separa el año y el mes de la fecha de inicio
  const [anioDesde, mesDesde] = desde.split('-').map(Number);
  // separa el año y el mes de la fecha final
  const [anioHasta, mesHasta] = hasta.split('-').map(Number);
  // cuenta los meses de diferencia entre ambas
  return (anioHasta - anioDesde) * 12 + (mesHasta - mesDesde);
}

/**
 * Día de vencimiento que realmente existe en un mes.
 * Si la tarjeta vence el 31 y el mes tiene 28 días, vence el 28.
 * (`mes` va de 0 a 11, igual que en Date)
 */
export function diaEfectivo(diaVencimiento: number, anio: number, mes: number): number {
  // averigua cuántos días tiene ese mes
  const ultimoDiaDelMes = new Date(anio, mes + 1, 0).getDate();
  // usa el día de vencimiento, o el último día si el mes es corto
  return Math.min(diaVencimiento, ultimoDiaDelMes);
}

/**
 * ¿Ya pasó el día de corte de la tarjeta este mes?
 * La app maneja un solo día por tarjeta (facturación / vencimiento) y lo usa como corte:
 * una compra hecha después de ese día ya no entra en el estado de cuenta de este mes.
 */
export function pasoElCorte(diaVencimiento: number, hoy: Date = new Date()): boolean {
  // revisa si hoy ya es después del día de corte
  return hoy.getDate() > diaEfectivo(diaVencimiento, hoy.getFullYear(), hoy.getMonth());
}

// datos extra para saber qué texto de vencimiento mostrar
interface OpcionesVencimiento {
  // dice si el mes ya está pagado
  pagada?: boolean;    // ¿Ya se pagó el mes en esta tarjeta?
  // dice si hay algo que pagar este mes
  hayPagos?: boolean;  // ¿Hay algo por pagar este mes? (cuotas o suscripciones)
}

/**
 * Calcula el texto de vencimiento según el día de hoy.
 * Ejemplo: hoy es 10 y vence el 15 -> "Vence 15 de Octubre" + "Quedan 5 días".
 * Devuelve dos textos: `texto` (fecha) y `subtexto` (estado).
 *
 * Solo dice "Atrasada" si de verdad hay algo por pagar. Si el mes ya está pagado
 * o no hay pagos, muestra el próximo vencimiento en vez de una deuda que no existe.
 */
export function calcularEstadoVencimiento(
  // día del mes en que vence la tarjeta
  diaVencimiento: number,
  // si el mes ya se pagó y si hay pagos
  opciones: OpcionesVencimiento = {},
  // fecha de hoy
  hoy: Date = new Date()
  // devuelve el texto de la fecha y el texto del estado
): { texto: string; subtexto: string } {
  // lee las opciones; si faltan, usa valores por defecto
  const { pagada = false, hayPagos = true } = opciones;
  // número del día de hoy
  const diaHoy = hoy.getDate();
  // Si el día no existe este mes (ej: 31 en Febrero) se usa el último día del mes
  const dia = diaEfectivo(diaVencimiento, hoy.getFullYear(), hoy.getMonth());

  // Nada por pagar: mostramos cuándo vuelve a vencer
  if (pagada || !hayPagos) {
    // Pagada, o con el día ya pasado: el próximo vencimiento es el mes siguiente
    const mesSiguiente = pagada || diaHoy > dia;
    // primer día del mes en que vuelve a vencer
    const destino = new Date(hoy.getFullYear(), hoy.getMonth() + (mesSiguiente ? 1 : 0), 1);
    // día real de vencimiento en ese mes
    const diaDestino = diaEfectivo(diaVencimiento, destino.getFullYear(), destino.getMonth());
    // devuelve los textos del próximo vencimiento
    return {
      // texto con la fecha del próximo vencimiento
      texto: `Próximo vencimiento ${diaDestino} de ${MESES[destino.getMonth()]}`,
      // dice si está pagada o si no hay pagos este mes
      subtexto: pagada ? 'Pagada este mes' : 'Sin pagos este mes',
    };
  }

  // nombre del mes actual
  const nombreMes = MESES[hoy.getMonth()]; // getMonth() devuelve 0-11
  // texto con la fecha, ej: "15 de Octubre"
  const textoFecha = `${dia} de ${nombreMes}`;

  // si todavía no llega el día de vencimiento
  if (diaHoy < dia) {
    // Aún no vence: contamos los días que faltan
    const diff = dia - diaHoy;
    // devuelve la fecha y los días que faltan
    return {
      // texto con la fecha de vencimiento
      texto: `Vence ${textoFecha}`,
      // texto con los días que faltan
      subtexto: `Quedan ${diff} día${diff > 1 ? 's' : ''}`,
    };
    // si hoy es justo el día de vencimiento
  } else if (diaHoy === dia) {
    // Vence justo hoy
    return {
      // texto que avisa que vence hoy
      texto: `Vence hoy (${textoFecha})`,
      // aviso para pagar hoy
      subtexto: '¡Paga hoy!',
    };
    // si ya pasó el día de vencimiento
  } else {
    // Ya pasó la fecha y quedan pagos pendientes: contamos los días de atraso
    const diff = diaHoy - dia;
    // devuelve la fecha y los días de atraso
    return {
      // texto con la fecha de vencimiento
      texto: `Vence ${textoFecha}`,
      // texto con los días de atraso
      subtexto: `Atrasada por ${diff} día${diff > 1 ? 's' : ''}`,
    };
  }
}

/**
 * Calcula cuándo es el próximo cobro de una suscripción.
 * - Si el día no existe en el mes (ej: 31 en Febrero) usa el último día del mes.
 * - `saltarMesActual` fuerza el mes siguiente (se usa cuando ya se pagó este mes).
 */
export function calcularProximoCobro(
  // día del mes en que se cobra la suscripción
  diaCobro: number,
  // si es verdadero, salta directo al mes siguiente
  saltarMesActual: boolean = false,
  // fecha y hora de ahora
  ahora: Date = new Date()
) {
  // copia la fecha de hoy
  const hoy = new Date(ahora);
  // deja la hora en cero para comparar solo días
  hoy.setHours(0, 0, 0, 0);

  // averigua el último día de un mes
  const ultimoDia = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  // arma la fecha de cobro de un mes, sin pasarse de su último día
  const construir = (y: number, m: number) =>
    // fecha con el día de cobro o el último día del mes
    new Date(y, m, Math.min(diaCobro, ultimoDia(y, m)));

  // fecha de cobro de este mes
  let fecha = construir(hoy.getFullYear(), hoy.getMonth());
  // si hay que saltar este mes o la fecha ya pasó
  if (saltarMesActual || fecha < hoy) {
    // Ya pasó (o ya se pagó) este mes: el cobro es el mes siguiente
    fecha = construir(hoy.getFullYear(), hoy.getMonth() + 1);
  }

  // cuenta cuántos días faltan para el cobro
  const dias = Math.round((fecha.getTime() - hoy.getTime()) / 86400000);
  // devuelve la fecha, los días y un texto corto
  return {
    // texto con la fecha del cobro, ej: "5 de Noviembre"
    texto: `${fecha.getDate()} de ${MESES[fecha.getMonth()]}`,
    // cantidad de días que faltan
    dias,
    // dice "Hoy", "Mañana" o en cuántos días
    subtexto: dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `En ${dias} días`,
  };
}
