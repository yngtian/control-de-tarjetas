/* ============================================================
   Validación de lo que llega en el body.
   Cada validación devuelve el mensaje de error, o null si el dato está bien.
   ============================================================ */

// el resultado de revisar un dato: un mensaje de error o nada
export type Validacion = string | null;

// escribe un número con puntos de miles, como en Chile
const formatearNumero = (n: number) => n.toLocaleString('es-CL');

// revisa que un texto venga escrito y no sea demasiado largo
export function validarTexto(valor: unknown, campo: string, max: number, opcional = false): Validacion {
  // si no vino el dato, avisa que falta (salvo que sea opcional)
  if (valor === undefined) return opcional ? null : `${campo} es obligatorio.`;
  // si no es texto, avisa que no es válido
  if (typeof valor !== 'string') return `${campo} no es válido.`;
  // quita los espacios del principio y del final
  const texto = valor.trim();
  // si quedó vacío y era obligatorio, avisa que falta
  if (texto === '' && !opcional) return `${campo} es obligatorio.`;
  // si es más largo de lo permitido, avisa el máximo
  if (texto.length > max) return `${campo} admite máximo ${max} caracteres.`;
  // el texto está bien, no hay error
  return null;
}

// revisa que un número sea entero y esté entre un mínimo y un máximo
export function validarEntero(valor: unknown, campo: string, min: number, max: number): Validacion {
  // si el número está dentro del rango, no hay error
  if (Number.isInteger(valor) && (valor as number) >= min && (valor as number) <= max) return null;
  // si no, avisa entre qué números debe estar
  return `${campo} debe ser un número entero entre ${formatearNumero(min)} y ${formatearNumero(max)}.`;
}

/** El primer error de la lista, o null si todo está bien. */
export const primerError = (...validaciones: Validacion[]): Validacion =>
  // busca el primer mensaje de error que no esté vacío
  validaciones.find((v) => v !== null) ?? null;

/** Lo que llega como texto opcional, ya sin espacios ('' si no vino). */
export const textoLimpio = (valor: unknown) => (typeof valor === 'string' ? valor.trim() : '');
