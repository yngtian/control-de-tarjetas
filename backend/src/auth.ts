/* ============================================================
   Cuentas y sesiones

   - Contraseñas: nunca se guardan tal cual. Se guarda un hash scrypt con una
     sal aleatoria por cuenta ("sal:hash" en hexadecimal).
   - Sesión: un token firmado con HMAC-SHA256 que dice qué usuario es y hasta
     cuándo vale. El servidor no guarda sesiones: le basta revisar la firma.
     Formato: "<datos en base64url>.<firma en base64url>".
   ============================================================ */

import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (clave: string, sal: Buffer, largo: number) => Promise<Buffer>;

/** Cuánto dura una sesión antes de pedir ingresar de nuevo. */
const DURACION_SESION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

export async function cifrarContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scrypt(contrasena, sal, 64);
  return `${sal.toString('hex')}:${hash.toString('hex')}`;
}

export async function verificarContrasena(contrasena: string, guardada: string): Promise<boolean> {
  const [salHex, hashHex] = guardada.split(':');
  const esperado = Buffer.from(hashHex ?? '', 'hex');
  if (!salHex || esperado.length === 0) return false;
  const hash = await scrypt(contrasena, Buffer.from(salHex, 'hex'), esperado.length);
  // Comparación en tiempo constante: no revela cuántos bytes coinciden
  return timingSafeEqual(hash, esperado);
}

export function crearToken(uid: string, secreto: string): string {
  const datos = Buffer.from(JSON.stringify({ uid, exp: Date.now() + DURACION_SESION_MS })).toString('base64url');
  const firma = createHmac('sha256', secreto).update(datos).digest('base64url');
  return `${datos}.${firma}`;
}

/** Devuelve el id del usuario si el token es auténtico y no ha vencido; si no, null. */
export function leerToken(token: string, secreto: string): string | null {
  const [datos, firma] = token.split('.');
  if (!datos || !firma) return null;

  const esperada = createHmac('sha256', secreto).update(datos).digest();
  const recibida = Buffer.from(firma, 'base64url');
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null;

  try {
    const { uid, exp } = JSON.parse(Buffer.from(datos, 'base64url').toString('utf8'));
    if (typeof uid !== 'string' || typeof exp !== 'number' || exp < Date.now()) return null;
    return uid;
  } catch {
    return null;
  }
}

/**
 * Secreto con que se firman los tokens. Si se cambia, todas las sesiones se cierran.
 * Se toma de SESSION_SECRET; sin ella se genera uno al azar y se guarda en
 * backend/.secreto-sesion, para que las sesiones sobrevivan a los reinicios en desarrollo.
 */
export function obtenerSecreto(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const archivo = path.resolve('.secreto-sesion');
  if (existsSync(archivo)) return readFileSync(archivo, 'utf8').trim();
  const secreto = randomBytes(32).toString('hex');
  writeFileSync(archivo, secreto);
  return secreto;
}

/**
 * Clave de una cuenta en la base de datos a partir de su correo.
 * Firebase no acepta "." en las claves, y así el correo tampoco queda a la vista en la ruta.
 */
export const claveDeCorreo = (correo: string) =>
  createHash('sha256').update(correo.trim().toLowerCase()).digest('hex');
