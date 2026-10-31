/* ============================================================
   Límites de los datos que acepta la API.
   La app tiene una copia en frontend/constants/limites.ts:
   si cambias un valor aquí, cámbialo también allá.
   ============================================================ */

// lista de topes máximos y mínimos que acepta el servidor
export const LIMITES = {
  cuotasMax: 48,             // Máximo de cuotas de una compra
  montoMax: 999_999_999,     // $999.999.999: tope para cupos, compras y suscripciones
  motivoMax: 60,             // Largo máximo del motivo de una compra
  nombreMax: 40,             // Nombre de la tarjeta, del banco o de la suscripción
  // largo máximo del nombre del plan de una suscripción
  planMax: 40,
  // largo máximo del apodo de la tarjeta
  aliasMax: 30,
  // cuántos meses hacia adelante se puede ver la proyección de pagos
  mesesProyeccionMax: 24,
  // largo máximo del correo
  emailMax: 100,
  // la contraseña debe tener al menos 8 letras
  contrasenaMin: 8,
  // la contraseña puede tener como máximo 72 letras
  contrasenaMax: 72,
};

/** Emisores válidos (los mismos id de frontend/constants/banks.ts). */
export const EMISORES = ['bancoestado', 'falabella', 'santander', 'mastercard', 'visa'];

/** Emisores genéricos: sin alias no se puede saber de qué banco es la tarjeta. */
export const EMISORES_CON_ALIAS = ['visa', 'mastercard'];
