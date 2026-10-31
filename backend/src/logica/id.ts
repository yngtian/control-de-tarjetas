// trae la función que genera números al azar
import { randomBytes } from 'node:crypto';

// letras y números que se pueden usar en la parte al azar
const LETRAS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Genera un identificador legible a partir de un texto, más 4 letras al azar para que no se repita.
 * Ej: generarId('Banco Santander') -> "banco-santander-k3f9"; generarId('Jaimito') -> "jaimito-p4q8".
 * Así en la consola de Firebase se entiende a qué corresponde cada cosa.
 */
export function generarId(texto = ''): string {
  // arma la parte legible a partir del texto recibido
  const legible = texto
    // separa las tildes de las letras
    .normalize('NFD')
    // quita las tildes
    .replace(/[̀-ͯ]/g, '') // sin tildes: "Línea" -> "Linea"
    // pasa todo a minúsculas
    .toLowerCase()
    // cambia espacios y símbolos por guiones
    .replace(/[^a-z0-9]+/g, '-')
    // quita guiones al inicio y al final
    .replace(/^-+|-+$/g, '')
    // deja como máximo 24 caracteres
    .slice(0, 24)
    // quita un guion que haya quedado al final al cortar
    .replace(/-+$/, '');
  // elige 4 letras o números al azar
  const azar = Array.from(randomBytes(4), (byte) => LETRAS[byte % LETRAS.length]).join('');
  // junta la parte legible con la parte al azar
  return legible ? `${legible}-${azar}` : azar;
}
