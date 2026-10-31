/* ============================================================
   Validación de lo que llega en el body.
   Cada validación devuelve el mensaje de error, o null si el dato está bien.
   ============================================================ */

export type Validacion = string | null;

const formatearNumero = (n: number) => n.toLocaleString('es-CL');

export function validarTexto(valor: unknown, campo: string, max: number, opcional = false): Validacion {
  if (valor === undefined) return opcional ? null : `${campo} es obligatorio.`;
  if (typeof valor !== 'string') return `${campo} no es válido.`;
  const texto = valor.trim();
  if (texto === '' && !opcional) return `${campo} es obligatorio.`;
  if (texto.length > max) return `${campo} admite máximo ${max} caracteres.`;
  return null;
}

export function validarEntero(valor: unknown, campo: string, min: number, max: number): Validacion {
  if (Number.isInteger(valor) && (valor as number) >= min && (valor as number) <= max) return null;
  return `${campo} debe ser un número entero entre ${formatearNumero(min)} y ${formatearNumero(max)}.`;
}

/** El primer error de la lista, o null si todo está bien. */
export const primerError = (...validaciones: Validacion[]): Validacion =>
  validaciones.find((v) => v !== null) ?? null;

/** Lo que llega como texto opcional, ya sin espacios ('' si no vino). */
export const textoLimpio = (valor: unknown) => (typeof valor === 'string' ? valor.trim() : '');
