import { randomBytes } from 'node:crypto';

const LETRAS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Genera un identificador legible a partir de un texto, más 4 letras al azar para que no se repita.
 * Ej: generarId('Banco Santander') -> "banco-santander-k3f9"; generarId('Jaimito') -> "jaimito-p4q8".
 * Así en la consola de Firebase se entiende a qué corresponde cada cosa.
 */
export function generarId(texto = ''): string {
  const legible = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // sin tildes: "Línea" -> "Linea"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/, '');
  const azar = Array.from(randomBytes(4), (byte) => LETRAS[byte % LETRAS.length]).join('');
  return legible ? `${legible}-${azar}` : azar;
}
