/* ============================================================
   Rutas de cuentas (no piden sesión, salvo /yo)

   POST /api/auth/registro   { nombre, email, password } → { resultado, token, usuario }
   POST /api/auth/login      { email, password }         → { resultado, token, usuario }
   GET  /api/auth/yo         (con token)                 → { resultado, usuario }

   El resto de la API exige el encabezado  Authorization: Bearer <token>
   (ver requiereSesion). Sin él, o con un token vencido, responde 401.
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

/** Lo que se guarda para poder ingresar: nunca la contraseña, solo su hash. */
interface Cuenta {
  uid: string;
  hash: string;
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

/** Exige un token válido y deja el id del usuario en res.locals.uid. */
export function requiereSesion(secreto: string): RequestHandler {
  return (req, res, next) => {
    const encabezado = req.headers.authorization ?? '';
    const uid = encabezado.startsWith('Bearer ') ? leerToken(encabezado.slice(7), secreto) : null;
    if (!uid) {
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
    if (await bd.leer(`cuentas/${clave}`)) {
      res.status(409).json({ resultado: 'email_en_uso' });
      return;
    }

    const perfil: Perfil = { uid: generarId(), nombre: nombre.trim(), email: email.trim().toLowerCase() };
    const cuenta: Cuenta = { uid: perfil.uid, hash: await cifrarContrasena(password) };
    await bd.actualizar({ [`cuentas/${clave}`]: cuenta, [`usuarios/${perfil.uid}/perfil`]: perfil });
    iniciarSesion(res, perfil, 201);
  });

  rutas.post('/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return rechazar(res, 'Ingresa tu correo y tu contraseña.');
    }

    const cuenta = (await bd.leer(`cuentas/${claveDeCorreo(email)}`)) as Cuenta | null;
    // Correo inexistente o contraseña incorrecta dan la MISMA respuesta: así no se puede
    // averiguar qué correos tienen cuenta. Sin cuenta igual se calcula un hash para que
    // el tiempo de respuesta tampoco lo delate.
    const valida = cuenta
      ? await verificarContrasena(password, cuenta.hash)
      : (await cifrarContrasena(password), false);
    const perfil = valida ? ((await bd.leer(`usuarios/${cuenta!.uid}/perfil`)) as Perfil | null) : null;
    if (!perfil) {
      res.status(401).json({ resultado: 'credenciales_invalidas' });
      return;
    }
    iniciarSesion(res, perfil);
  });

  rutas.get('/yo', requiereSesion(secreto), async (_req, res) => {
    const perfil = (await bd.leer(`usuarios/${res.locals.uid}/perfil`)) as Perfil | null;
    if (!perfil) {
      res.status(401).json({ resultado: 'no_autorizado' });
      return;
    }
    res.json({ resultado: 'ok', usuario: perfil });
  });

  return rutas;
}
