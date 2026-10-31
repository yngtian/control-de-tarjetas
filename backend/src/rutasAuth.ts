/* ============================================================
   Rutas de cuentas (no piden sesión, salvo /yo)

   POST /api/auth/registro   { nombre, email, password } → { resultado, token, usuario }
   POST /api/auth/login      { email, password }         → { resultado, token, usuario }
   GET  /api/auth/yo         (con token)                 → { resultado, usuario }

   El resto de la API exige el encabezado  Authorization: Bearer <token>
   (ver requiereSesion). Sin él, con un token vencido o si la cuenta ya no existe, responde 401.
   ============================================================ */

import { Router, type RequestHandler, type Response } from 'express';
import { claveDeCorreo, cifrarContrasena, crearToken, leerToken, verificarContrasena } from './auth';
import type { BaseDeDatos } from './db';
import { LIMITES } from './limites';
import { generarId } from './logica/id';
import { primerError, validarTexto, type Validacion } from './validacion';

/** Lo que la app sabe del usuario con sesión iniciada. */
interface Perfil {
  uid: string;
  nombre: string;
  email: string;
}

/**
 * Nombre y correo de un usuario (en Firebase: usuarios/<uid>/nombre y /correo).
 * null si el usuario ya no existe.
 */
async function leerPerfil(bd: BaseDeDatos, uid: string): Promise<Perfil | null> {
  const [nombre, email] = await Promise.all([bd.leer(`usuarios/${uid}/nombre`), bd.leer(`usuarios/${uid}/correo`)]);
  return typeof nombre === 'string' && typeof email === 'string' ? { uid, nombre, email } : null;
}

function validarCorreo(valor: unknown): Validacion {
  const error = validarTexto(valor, 'El correo', LIMITES.emailMax);
  if (error) return error;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((valor as string).trim()) ? null : 'El correo no es válido.';
}

function validarContrasena(valor: unknown): Validacion {
  if (typeof valor !== 'string') return 'La contraseña es obligatoria.';
  if (valor.length < LIMITES.contrasenaMin) return `La contraseña debe tener al menos ${LIMITES.contrasenaMin} caracteres.`;
  if (valor.length > LIMITES.contrasenaMax) return `La contraseña admite máximo ${LIMITES.contrasenaMax} caracteres.`;
  return null;
}

/**
 * Exige un token válido de una cuenta que todavía existe, y deja el id del usuario en res.locals.uid.
 * Revisar que exista importa: un token sigue siendo auténtico aunque la cuenta se haya borrado, y sin
 * esta revisión la app seguiría entrando con esa cuenta (sin datos) y podría volver a crearle datos.
 */
export function requiereSesion(secreto: string, bd: BaseDeDatos): RequestHandler {
  return async (req, res, next) => {
    const encabezado = req.headers.authorization ?? '';
    const uid = encabezado.startsWith('Bearer ') ? leerToken(encabezado.slice(7), secreto) : null;
    if (!uid || !(await bd.leer(`usuarios/${uid}/correo`))) {
      res.status(401).json({ resultado: 'no_autorizado' });
      return;
    }
    res.locals.uid = uid;
    next();
  };
}

export function crearRutasAuth(bd: BaseDeDatos, secreto: string) {
  const rutas = Router();

  const iniciarSesion = (res: Response, perfil: Perfil, status = 200) => {
    res.status(status).json({ resultado: 'ok', token: crearToken(perfil.uid, secreto), usuario: perfil });
  };
  const rechazar = (res: Response, mensaje: string) => {
    res.status(400).json({ resultado: 'datos_invalidos', mensaje });
  };

  rutas.post('/registro', async (req, res) => {
    const { nombre, email, password } = req.body ?? {};
    const error = primerError(
      validarTexto(nombre, 'El nombre', LIMITES.nombreMax),
      validarCorreo(email),
      validarContrasena(password)
    );
    if (error) return rechazar(res, error);

    const clave = claveDeCorreo(email);
    if (await bd.leer(`correos/${clave}`)) {
      res.status(409).json({ resultado: 'email_en_uso' });
      return;
    }

    // El id se arma con el nombre (ej: "jaimito-k3f9") para que se entienda en Firebase
    const perfil: Perfil = { uid: generarId(nombre.trim()), nombre: nombre.trim(), email: email.trim().toLowerCase() };
    await bd.actualizar({
      [`correos/${clave}`]: perfil.uid,
      [`usuarios/${perfil.uid}/nombre`]: perfil.nombre,
      [`usuarios/${perfil.uid}/correo`]: perfil.email,
      // Nunca la contraseña real: solo su hash (ver auth.ts)
      [`usuarios/${perfil.uid}/contrasena`]: await cifrarContrasena(password),
    });
    iniciarSesion(res, perfil, 201);
  });

  rutas.post('/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return rechazar(res, 'Ingresa tu correo y tu contraseña.');
    }

    const uid = (await bd.leer(`correos/${claveDeCorreo(email)}`)) as string | null;
    const hash = uid ? ((await bd.leer(`usuarios/${uid}/contrasena`)) as string | null) : null;
    // Correo inexistente o contraseña incorrecta dan la MISMA respuesta: así no se puede
    // averiguar qué correos tienen cuenta. Sin cuenta igual se calcula un hash para que
    // el tiempo de respuesta tampoco lo delate.
    const valida = hash
      ? await verificarContrasena(password, hash)
      : (await cifrarContrasena(password), false);
    const perfil = valida ? await leerPerfil(bd, uid!) : null;
    if (!perfil) {
      res.status(401).json({ resultado: 'credenciales_invalidas' });
      return;
    }
    iniciarSesion(res, perfil);
  });

  rutas.get('/yo', requiereSesion(secreto, bd), async (_req, res) => {
    const perfil = await leerPerfil(bd, res.locals.uid);
    if (!perfil) {
      res.status(401).json({ resultado: 'no_autorizado' });
      return;
    }
    res.json({ resultado: 'ok', usuario: perfil });
  });

  return rutas;
}
