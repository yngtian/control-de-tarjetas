/* ============================================================
   Cálculo de cuotas (funciones puras: no dependen de React)

   Problema que resuelven: al dividir un monto en cuotas casi nunca sale exacto.
   Ej: $100.000 en 3 cuotas. Si cada cuota se redondea (33.333 x 3) la suma da
   $99.999 y la app terminaba "perdiendo" un peso (o regalándolo, según el redondeo).

   Solución: las cuotas 1 a N-1 valen lo mismo (monto / cuotas, hacia abajo) y la
   ÚLTIMA cuota absorbe la diferencia. Así la suma siempre da exactamente el monto.
   Ej: $100.000 en 3 -> $33.333 + $33.333 + $33.334.
   ============================================================ */

/** Los datos mínimos de una compra en cuotas que necesitan estas funciones. */
export interface DatosCuotas {
  // cuánto costó la compra completa
  montoTotal: number;
  // en cuántas cuotas se dividió la compra
  totalCuotas: number;
  // cuánto vale cada cuota normal
  cuotaMensual: number; // Valor de las cuotas 1 a N-1 (ver calcularCuotaBase)
}

/** Valor de las cuotas "normales": el monto dividido en cuotas, redondeado hacia abajo. */
export function calcularCuotaBase(montoTotal: number, totalCuotas: number): number {
  // divide el monto en las cuotas y quita los decimales
  return Math.floor(montoTotal / totalCuotas);
}

/**
 * Cuánto se paga en una cuota concreta (1 a N).
 * Todas valen `cuotaMensual`, excepto la última, que completa el monto total.
 */
export function montoDeCuota(tx: DatosCuotas, numeroCuota: number): number {
  // si es la última cuota, cobra lo que falta para completar
  if (numeroCuota >= tx.totalCuotas) {
    // total menos lo que ya se pagó en las cuotas anteriores
    return tx.montoTotal - tx.cuotaMensual * (tx.totalCuotas - 1);
  }
  // cualquier otra cuota vale lo normal
  return tx.cuotaMensual;
}

/**
 * Lo que todavía falta pagar de una compra, incluida la cuota actual.
 * Las cuotas ya pagadas (1 a cuotaActual-1) siempre son "normales", por eso
 * basta restarlas del total: el resultado es exacto, sin errores de redondeo.
 * Es lo que "ocupa" cupo en la tarjeta.
 */
export function saldoPendienteTx(tx: DatosCuotas & { cuotaActual: number }): number {
  // total menos las cuotas que ya se pagaron
  return tx.montoTotal - tx.cuotaMensual * (tx.cuotaActual - 1);
}
