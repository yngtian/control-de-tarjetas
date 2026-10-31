/* ============================================================
   Cliente HTTP de la API (backend/)

   Dirección del backend:
   - EXPO_PUBLIC_API_URL si está definida (ver frontend/.env.example).
   - Si no, el mismo computador que sirve la app (Metro) en el puerto 3000.
     Así funciona tanto en el navegador como en Expo Go en un celular de la misma red.

   Sesión: con una sesión iniciada, cada llamada lleva el encabezado
   "Authorization: Bearer <token>". Si el backend responde que la sesión no
   vale (vencida o inválida), se avisa a SesionContext para volver a ingresar.
   ============================================================ */

import Constants from 'expo-constants';
import type { CambiosTarjeta, CambiosTransaccion, Estado, NuevaSuscripcion, NuevaTarjeta, Proyeccion, RespuestaSesion, Resultado, Usuario } from './tipos';

function urlPorDefecto(): string {
  // hostUri es "192.168.1.5:8081" cuando la app viene del servidor de desarrollo
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:3000`;
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? urlPorDefecto();

/* ---------- Sesión ---------- */

let token: string | null = null;
let alNoAutorizado: (() => void) | null = null;

/** La llama SesionContext al ingresar (token + qué hacer si vence) y al salir (null). */
export function configurarSesion(nuevoToken: string | null, siVence: (() => void) | null = null) {
  token = nuevoToken;
  alNoAutorizado = siVence;
}

const encabezados = (conCuerpo: boolean): Record<string, string> => ({
  ...(conCuerpo ? { 'Content-Type': 'application/json' } : {}),
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

/** Error de un GET: `status` 401 = sesión vencida. */
export class ErrorApi extends Error {
  constructor(public status: number, ruta: string) {
    super(`GET ${ruta} respondió ${status}`);
  }
}

/* ---------- Llamadas ---------- */

/** Respuesta de una acción: si salió bien trae el estado actualizado; si no, puede traer un mensaje. */
export interface RespuestaAccion {
  resultado: Resultado;
  estado?: Estado;
  mensaje?: string;
}

/** GET que devuelve JSON. Lanza un error si falla (lo maneja quien llama). */
async function obtener<T>(ruta: string): Promise<T> {
  const respuesta = await fetch(`${API_URL}${ruta}`, { headers: encabezados(false) });
  if (respuesta.status === 401) alNoAutorizado?.();
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, ruta);
  return respuesta.json();
}

/** POST / PATCH / DELETE. Nunca lanza: un fallo de red se devuelve como 'sin_conexion'. */
async function accion<T extends { resultado: Resultado }>(
  metodo: 'POST' | 'PATCH' | 'DELETE',
  ruta: string,
  cuerpo?: object
): Promise<T> {
  try {
    const respuesta = await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers: encabezados(cuerpo !== undefined),
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const json: T = await respuesta.json();
    if (json.resultado === 'no_autorizado') alNoAutorizado?.();
    return json;
  } catch {
    return { resultado: 'sin_conexion' } as T;
  }
}

export const api = {
  // Cuentas
  registrarse: (nombre: string, email: string, password: string) =>
    accion<RespuestaSesion>('POST', '/api/auth/registro', { nombre, email, password }),
  ingresar: (email: string, password: string) =>
    accion<RespuestaSesion>('POST', '/api/auth/login', { email, password }),
  yo: () => obtener<{ usuario: Usuario }>('/api/auth/yo'),

  // Datos del usuario (exigen sesión)
  estado: () => obtener<Estado>('/api/estado'),
  proyecciones: (meses: number) => obtener<Proyeccion>(`/api/proyecciones?meses=${meses}`),

  agregarTarjeta: (tarjeta: NuevaTarjeta) => accion<RespuestaAccion>('POST', '/api/tarjetas', tarjeta),
  compartirTarjeta: (id: string, email: string) =>
    accion<RespuestaAccion>('POST', `/api/tarjetas/${id}/compartir`, { email }),
  dejarDeCompartir: (id: string, miembroUid: string) =>
    accion<RespuestaAccion>('DELETE', `/api/tarjetas/${id}/miembros/${miembroUid}`),
  editarTarjeta: (id: string, cambios: CambiosTarjeta) => accion<RespuestaAccion>('PATCH', `/api/tarjetas/${id}`, cambios),
  eliminarTarjeta: (id: string) => accion<RespuestaAccion>('DELETE', `/api/tarjetas/${id}`),
  pagarMesTarjeta: (tarjetaId: string) => accion<RespuestaAccion>('POST', `/api/tarjetas/${tarjetaId}/pagar`),
  registrarTransaccion: (tarjetaId: string, motivo: string, monto: number, cuotas: number) =>
    accion<RespuestaAccion>('POST', '/api/transacciones', { tarjetaId, motivo, monto, cuotas }),
  editarTransaccion: (id: string, cambios: CambiosTransaccion) =>
    accion<RespuestaAccion>('PATCH', `/api/transacciones/${id}`, cambios),
  eliminarTransaccion: (id: string) => accion<RespuestaAccion>('DELETE', `/api/transacciones/${id}`),
  agregarSuscripcion: (suscripcion: NuevaSuscripcion) =>
    accion<RespuestaAccion>('POST', '/api/suscripciones', suscripcion),
  eliminarSuscripcion: (id: string) => accion<RespuestaAccion>('DELETE', `/api/suscripciones/${id}`),
};
