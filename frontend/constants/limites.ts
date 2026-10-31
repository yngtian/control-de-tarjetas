/**
 * Límites de los datos. Son los mismos que valida la API (backend/src/limites.ts):
 * si cambias un valor aquí, cámbialo también allá.
 */
export const LIMITES = {
  cuotasMax: 48,             // Máximo de cuotas de una compra
  digitosMonto: 9,           // Hasta $999.999.999: cupos, compras y suscripciones
  motivoMax: 60,             // Largo máximo del motivo de una compra
  nombreMax: 40,             // Nombre de la suscripción
  planMax: 40,
  aliasMax: 30,
  emailMax: 100,
  contrasenaMin: 8,
  contrasenaMax: 72,
};
