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

// trae los datos de configuración de la app de Expo
import Constants from 'expo-constants';
// trae la forma de los datos que viajan al servidor y vuelven
import type { CambiosTarjeta, CambiosTransaccion, Estado, NuevaSuscripcion, NuevaTarjeta, Proyeccion, RespuestaSesion, Resultado, Usuario } from './tipos';

// calcula la dirección del servidor si no se configuró una
function urlPorDefecto(): string {
  // hostUri es "192.168.1.5:8081" cuando la app viene del servidor de desarrollo
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  // arma la dirección usando el puerto 3000
  return `http://${host}:3000`;
}

// dirección del servidor que usa toda la app
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? urlPorDefecto();

/* ---------- Sesión ---------- */

// llave secreta del usuario que ingresó (vacía si nadie ingresó)
let token: string | null = null;
// qué hacer cuando el servidor dice que la sesión venció
let alNoAutorizado: (() => void) | null = null;

/** La llama SesionContext al ingresar (token + qué hacer si vence) y al salir (null). */
export function configurarSesion(nuevoToken: string | null, siVence: (() => void) | null = null) {
  // guarda la llave secreta nueva
  token = nuevoToken;
  // guarda qué hacer si la sesión vence
  alNoAutorizado = siVence;
}

// arma los datos extra que acompañan cada pedido al servidor
const encabezados = (conCuerpo: boolean): Record<string, string> => ({
  // si se mandan datos, avisa que van en formato JSON
  ...(conCuerpo ? { 'Content-Type': 'application/json' } : {}),
  // si hay sesión, agrega la llave secreta del usuario
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

/** Error de un GET: `status` 401 = sesión vencida. */
export class ErrorApi extends Error {
  // guarda el número de error y qué dirección falló
  constructor(public status: number, ruta: string) {
    // arma el mensaje del error
    super(`GET ${ruta} respondió ${status}`);
  }
}

/* ---------- Llamadas ---------- */

/** Respuesta de una acción: si salió bien trae el estado actualizado; si no, puede traer un mensaje. */
export interface RespuestaAccion {
  // código que dice cómo salió la acción
  resultado: Resultado;
  // datos actualizados de la app, si salió bien
  estado?: Estado;
  // mensaje para mostrar, si algo falló
  mensaje?: string;
}

/** GET que devuelve JSON. Lanza un error si falla (lo maneja quien llama). */
async function obtener<T>(ruta: string): Promise<T> {
  // pide los datos al servidor
  const respuesta = await fetch(`${API_URL}${ruta}`, { headers: encabezados(false) });
  // si la sesión venció, avisa para volver a ingresar
  if (respuesta.status === 401) alNoAutorizado?.();
  // si el servidor respondió con error, lanza un error
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, ruta);
  // devuelve los datos que mandó el servidor
  return respuesta.json();
}

/** POST / PATCH / DELETE. Nunca lanza: un fallo de red se devuelve como 'sin_conexion'. */
async function accion<T extends { resultado: Resultado }>(
  // tipo de acción: crear, cambiar o borrar
  metodo: 'POST' | 'PATCH' | 'DELETE',
  // dirección del servidor a la que se manda
  ruta: string,
  // datos opcionales que se mandan
  cuerpo?: object
): Promise<T> {
  // intenta hablar con el servidor
  try {
    // manda la acción al servidor
    const respuesta = await fetch(`${API_URL}${ruta}`, {
      // dice si es crear, cambiar o borrar
      method: metodo,
      // agrega los datos extra y la llave secreta
      headers: encabezados(cuerpo !== undefined),
      // convierte los datos a texto para mandarlos
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    // lee la respuesta del servidor
    const json: T = await respuesta.json();
    // si la sesión venció, avisa para volver a ingresar
    if (json.resultado === 'no_autorizado') alNoAutorizado?.();
    // devuelve la respuesta a quien la pidió
    return json;
  // si no hubo conexión, entra aquí
  } catch {
    // responde que no hay conexión
    return { resultado: 'sin_conexion' } as T;
  }
}

// todas las acciones que la app puede pedirle al servidor
export const api = {
  // Cuentas
  registrarse: (nombre: string, email: string, password: string) =>
    // manda los datos para crear una cuenta nueva
    accion<RespuestaSesion>('POST', '/api/auth/registro', { nombre, email, password }),
  // ingresa a una cuenta con correo y contraseña
  ingresar: (email: string, password: string) =>
    // manda el correo y la contraseña al servidor
    accion<RespuestaSesion>('POST', '/api/auth/login', { email, password }),
  // pide los datos del usuario que ingresó
  yo: () => obtener<{ usuario: Usuario }>('/api/auth/yo'),

  // Datos del usuario (exigen sesión)
  estado: () => obtener<Estado>('/api/estado'),
  // pide cuánto se pagará en los próximos meses
  proyecciones: (meses: number) => obtener<Proyeccion>(`/api/proyecciones?meses=${meses}`),

  // guarda una tarjeta nueva
  agregarTarjeta: (tarjeta: NuevaTarjeta) => accion<RespuestaAccion>('POST', '/api/tarjetas', tarjeta),
  // comparte una tarjeta con otra persona
  compartirTarjeta: (id: string, email: string) =>
    // manda el correo de la persona con quien se comparte
    accion<RespuestaAccion>('POST', `/api/tarjetas/${id}/compartir`, { email }),
  // deja de compartir una tarjeta con alguien
  dejarDeCompartir: (id: string, miembroUid: string) =>
    // pide borrar a esa persona de la tarjeta
    accion<RespuestaAccion>('DELETE', `/api/tarjetas/${id}/miembros/${miembroUid}`),
  // guarda los cambios de una tarjeta
  editarTarjeta: (id: string, cambios: CambiosTarjeta) => accion<RespuestaAccion>('PATCH', `/api/tarjetas/${id}`, cambios),
  // borra una tarjeta
  eliminarTarjeta: (id: string) => accion<RespuestaAccion>('DELETE', `/api/tarjetas/${id}`),
  // paga el mes de una tarjeta
  pagarMesTarjeta: (tarjetaId: string) => accion<RespuestaAccion>('POST', `/api/tarjetas/${tarjetaId}/pagar`),
  // registra una compra nueva
  registrarTransaccion: (tarjetaId: string, motivo: string, monto: number, cuotas: number) =>
    // manda la tarjeta, el motivo, el monto y las cuotas
    accion<RespuestaAccion>('POST', '/api/transacciones', { tarjetaId, motivo, monto, cuotas }),
  // guarda los cambios de una compra
  editarTransaccion: (id: string, cambios: CambiosTransaccion) =>
    // manda los cambios de la compra al servidor
    accion<RespuestaAccion>('PATCH', `/api/transacciones/${id}`, cambios),
  // borra una compra
  eliminarTransaccion: (id: string) => accion<RespuestaAccion>('DELETE', `/api/transacciones/${id}`),
  // guarda una suscripción nueva
  agregarSuscripcion: (suscripcion: NuevaSuscripcion) =>
    // manda los datos de la suscripción al servidor
    accion<RespuestaAccion>('POST', '/api/suscripciones', suscripcion),
  // borra una suscripción
  eliminarSuscripcion: (id: string) => accion<RespuestaAccion>('DELETE', `/api/suscripciones/${id}`),
};
