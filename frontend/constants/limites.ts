/**
 * Límites de los datos. Son los mismos que valida la API (backend/src/limites.ts):
 * si cambias un valor aquí, cámbialo también allá.
 */
export const LIMITES = {
  // una compra puede tener hasta 48 cuotas
  cuotasMax: 48,             // Máximo de cuotas de una compra
  // los montos pueden tener hasta 9 números
  digitosMonto: 9,           // Hasta $999.999.999: cupos, compras y suscripciones
  // el motivo de una compra tiene hasta 60 letras
  motivoMax: 60,             // Largo máximo del motivo de una compra
  // el nombre de una suscripción tiene hasta 40 letras
  nombreMax: 40,             // Nombre de la suscripción
  // el plan de una suscripción tiene hasta 40 letras
  planMax: 40,
  // el nombre corto de una tarjeta tiene hasta 30 letras
  aliasMax: 30,
  // el correo tiene hasta 100 letras
  emailMax: 100,
  // la contraseña debe tener al menos 8 letras
  contrasenaMin: 8,
  // la contraseña puede tener hasta 72 letras
  contrasenaMax: 72,
};
