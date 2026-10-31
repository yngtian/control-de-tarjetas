/* ============================================================
   Cuentas y sesiones

   - Contraseñas: nunca se guardan tal cual. Se guarda un hash scrypt con una
     sal aleatoria por cuenta ("sal:hash" en hexadecimal).
   - Sesión: un token firmado con HMAC-SHA256 que dice qué usuario es y hasta
     cuándo vale. El servidor no guarda sesiones: le basta revisar la firma.
     Formato: "<datos en base64url>.<firma en base64url>".
   ============================================================ */

// trae las herramientas para cifrar contraseñas y firmar sesiones
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
// trae las funciones para ver, leer y escribir archivos
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
// trae la herramienta para armar rutas de carpetas y archivos
import path from 'node:path';
// trae la herramienta que permite esperar el resultado de una función
import { promisify } from 'node:util';

// prepara la función que cifra contraseñas para poder esperarla
const scrypt = promisify(scryptCallback) as (clave: string, sal: Buffer, largo: number) => Promise<Buffer>;

/** Cuánto dura una sesión antes de pedir ingresar de nuevo. */
const DURACION_SESION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

// convierte la contraseña en un código que no se puede leer
export async function cifrarContrasena(contrasena: string): Promise<string> {
  // crea un valor al azar distinto para cada cuenta
  const sal = randomBytes(16);
  // mezcla la contraseña con ese valor al azar
  const hash = await scrypt(contrasena, sal, 64);
  // devuelve el valor al azar y el código, separados por ":"
  return `${sal.toString('hex')}:${hash.toString('hex')}`;
}

// revisa si la contraseña escrita es la misma que la guardada
export async function verificarContrasena(contrasena: string, guardada: string): Promise<boolean> {
  // separa el valor al azar y el código guardado
  const [salHex, hashHex] = guardada.split(':');
  // convierte el código guardado para poder compararlo
  const esperado = Buffer.from(hashHex ?? '', 'hex');
  // si lo guardado está incompleto, la contraseña no sirve
  if (!salHex || esperado.length === 0) return false;
  // cifra la contraseña escrita de la misma forma
  const hash = await scrypt(contrasena, Buffer.from(salHex, 'hex'), esperado.length);
  // Comparación en tiempo constante: no revela cuántos bytes coinciden
  return timingSafeEqual(hash, esperado);
}

// crea el pase de sesión que recibe el usuario al ingresar
export function crearToken(uid: string, secreto: string): string {
  // guarda quién es el usuario y hasta cuándo vale la sesión
  const datos = Buffer.from(JSON.stringify({ uid, exp: Date.now() + DURACION_SESION_MS })).toString('base64url');
  // firma esos datos con la clave secreta para que nadie los falsifique
  const firma = createHmac('sha256', secreto).update(datos).digest('base64url');
  // devuelve los datos y la firma separados por un punto
  return `${datos}.${firma}`;
}

/** Devuelve el id del usuario si el token es auténtico y no ha vencido; si no, null. */
export function leerToken(token: string, secreto: string): string | null {
  // separa los datos de la firma
  const [datos, firma] = token.split('.');
  // si falta alguna parte, el pase no sirve
  if (!datos || !firma) return null;

  // calcula cuál debería ser la firma correcta
  const esperada = createHmac('sha256', secreto).update(datos).digest();
  // convierte la firma que llegó para compararla
  const recibida = Buffer.from(firma, 'base64url');
  // si las firmas no coinciden, el pase es falso
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null;

  // intenta leer los datos del pase
  try {
    // saca el usuario y la fecha de vencimiento
    const { uid, exp } = JSON.parse(Buffer.from(datos, 'base64url').toString('utf8'));
    // si los datos están raros o la sesión venció, no sirve
    if (typeof uid !== 'string' || typeof exp !== 'number' || exp < Date.now()) return null;
    // devuelve quién es el usuario
    return uid;
  } catch {
    // si no se pudo leer, el pase no sirve
    return null;
  }
}

/**
 * Secreto con que se firman los tokens. Si se cambia, todas las sesiones se cierran.
 * Se toma de SESSION_SECRET; sin ella se genera uno al azar y se guarda en
 * backend/.secreto-sesion, para que las sesiones sobrevivan a los reinicios en desarrollo.
 */
export function obtenerSecreto(): string {
  // si la clave viene en la configuración, usa esa
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  // ubica el archivo donde se guarda la clave
  const archivo = path.resolve('.secreto-sesion');
  // si el archivo ya existe, lee la clave de ahí
  if (existsSync(archivo)) return readFileSync(archivo, 'utf8').trim();
  // si no, inventa una clave nueva al azar
  const secreto = randomBytes(32).toString('hex');
  // guarda la clave nueva en el archivo
  writeFileSync(archivo, secreto);
  // devuelve la clave
  return secreto;
}

/**
 * Clave de una cuenta en "correos": el mismo correo en minúsculas, con "." cambiado por ","
 * porque Firebase no acepta puntos en las claves. Ej: "jaimito@correo.cl" -> "jaimito@correo,cl".
 * Los otros caracteres que Firebase no acepta (y "," y "%", para no confundirlos) van como %XX.
 */
export const claveDeCorreo = (correo: string) =>
  // parte del correo que escribió el usuario
  correo
    // quita los espacios del principio y del final
    .trim()
    // pasa todo a minúsculas
    .toLowerCase()
    // cambia los signos que Firebase no acepta por un código
    .replace(/[%,$#[\]/]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    // cambia los puntos por comas
    .replace(/\./g, ',');
