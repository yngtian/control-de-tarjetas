/* ============================================================
   Límites de los datos que acepta la API.
   La app tiene una copia en frontend/constants/limites.ts:
   si cambias un valor aquí, cámbialo también allá.
   ============================================================ */

export const LIMITES = {
  cuotasMax: 48,             // Máximo de cuotas de una compra
  montoMax: 999_999_999,     // $999.999.999: tope para cupos, compras y suscripciones
  motivoMax: 60,             // Largo máximo del motivo de una compra
  nombreMax: 40,             // Nombre de la tarjeta, del banco o de la suscripción
  planMax: 40,
  aliasMax: 30,
  mesesProyeccionMax: 24,
  emailMax: 100,
  contrasenaMin: 8,
  contrasenaMax: 72,
};

/** Emisores válidos (los mismos id de frontend/constants/banks.ts). */
export const EMISORES = ['bancoestado', 'falabella', 'santander', 'mastercard', 'visa'];

/** Emisores genéricos: sin alias no se puede saber de qué banco es la tarjeta. */
export const EMISORES_CON_ALIAS = ['visa', 'mastercard'];
