/* ============================================================
   Rutas de cuentas (no piden sesión, salvo /yo)

   POST /api/auth/registro   { nombre, email, password } → { resultado, token, usuario }
   POST /api/auth/login      { email, password }         → { resultado, token, usuario }
   GET  /api/auth/yo         (con token)                 → { resultado, usuario }

   El resto de la API exige el encabezado  Authorization: Bearer <token>
   (ver requiereSesion). Sin él, con un token vencido o si la cuenta ya no existe, responde 401.
   ============================================================ */

// trae las herramientas de Express para armar direcciones y responder
import { Router, type RequestHandler, type Response } from 'express';
// trae las funciones para cifrar contraseñas y manejar sesiones
import { claveDeCorreo, cifrarContrasena, crearToken, leerToken, verificarContrasena } from './auth';
// trae el tipo de la base de datos
import type { BaseDeDatos } from './db';
// trae los topes de largo de los datos
import { LIMITES } from './limites';
// trae la función que inventa códigos únicos
import { generarId } from './logica/id';
// trae las funciones que revisan los datos que llegan
import { primerError, validarTexto, type Validacion } from './validacion';

/** Lo que la app sabe del usuario con sesión iniciada. */
interface Perfil {
  // código único del usuario
  uid: string;
  // nombre del usuario
  nombre: string;
  // correo del usuario
  email: string;
}

/**
 * Nombre y correo de un usuario (en Firebase: usuarios/<uid>/nombre y /correo).
 * null si el usuario ya no existe.
 */
async function leerPerfil(bd: BaseDeDatos, uid: string): Promise<Perfil | null> {
  // trae el nombre y el correo del usuario al mismo tiempo
  const [nombre, email] = await Promise.all([bd.leer(`usuarios/${uid}/nombre`), bd.leer(`usuarios/${uid}/correo`)]);
  // si los dos existen, devuelve el perfil; si no, nada
  return typeof nombre === 'string' && typeof email === 'string' ? { uid, nombre, email } : null;
}

// revisa que el correo esté bien escrito
function validarCorreo(valor: unknown): Validacion {
  // revisa que venga escrito y no sea muy largo
  const error = validarTexto(valor, 'El correo', LIMITES.emailMax);
  // si hay un problema, lo avisa
  if (error) return error;
  // revisa que tenga forma de correo (algo@algo.algo)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((valor as string).trim()) ? null : 'El correo no es válido.';
}

// revisa que la contraseña cumpla con el largo pedido
function validarContrasena(valor: unknown): Validacion {
  // si no viene la contraseña, avisa que falta
  if (typeof valor !== 'string') return 'La contraseña es obligatoria.';
  // si es muy corta, avisa el mínimo
  if (valor.length < LIMITES.contrasenaMin) return `La contraseña debe tener al menos ${LIMITES.contrasenaMin} caracteres.`;
  // si es muy larga, avisa el máximo
  if (valor.length > LIMITES.contrasenaMax) return `La contraseña admite máximo ${LIMITES.contrasenaMax} caracteres.`;
  // la contraseña está bien
  return null;
}

/**
 * Exige un token válido de una cuenta que todavía existe, y deja el id del usuario en res.locals.uid.
 * Revisar que exista importa: un token sigue siendo auténtico aunque la cuenta se haya borrado, y sin
 * esta revisión la app seguiría entrando con esa cuenta (sin datos) y podría volver a crearle datos.
 */
export function requiereSesion(secreto: string, bd: BaseDeDatos): RequestHandler {
  // devuelve el control que se ejecuta antes de cada dirección
  return async (req, res, next) => {
    // lee el pase de sesión que manda la app
    const encabezado = req.headers.authorization ?? '';
    // revisa el pase y saca de quién es (o nada si no sirve)
    const uid = encabezado.startsWith('Bearer ') ? leerToken(encabezado.slice(7), secreto) : null;
    // si no hay pase válido o la cuenta ya no existe, no deja pasar
    if (!uid || !(await bd.leer(`usuarios/${uid}/correo`))) {
      // responde que no tiene permiso
      res.status(401).json({ resultado: 'no_autorizado' });
      // termina aquí
      return;
    }
    // recuerda quién es el usuario para las siguientes direcciones
    res.locals.uid = uid;
    // deja pasar al siguiente paso
    next();
  };
}

// arma las direcciones para crear cuenta, ingresar y ver el perfil
export function crearRutasAuth(bd: BaseDeDatos, secreto: string) {
  // crea el grupo de direcciones
  const rutas = Router();

  // responde con el pase de sesión y los datos del usuario
  const iniciarSesion = (res: Response, perfil: Perfil, status = 200) => {
    // manda el pase de sesión y el perfil a la app
    res.status(status).json({ resultado: 'ok', token: crearToken(perfil.uid, secreto), usuario: perfil });
  };
  // responde que los datos enviados no son válidos
  const rechazar = (res: Response, mensaje: string) => {
    // manda el aviso de error a la app
    res.status(400).json({ resultado: 'datos_invalidos', mensaje });
  };

  // dirección para crear una cuenta nueva
  rutas.post('/registro', async (req, res) => {
    // saca el nombre, correo y contraseña que mandó la app
    const { nombre, email, password } = req.body ?? {};
    // busca el primer error en los datos
    const error = primerError(
      // revisa el nombre
      validarTexto(nombre, 'El nombre', LIMITES.nombreMax),
      // revisa el correo
      validarCorreo(email),
      // revisa la contraseña
      validarContrasena(password)
    );
    // si hay un error, lo avisa y no sigue
    if (error) return rechazar(res, error);

    // arma la clave del correo para buscarlo en Firebase
    const clave = claveDeCorreo(email);
    // si ese correo ya tiene cuenta
    if (await bd.leer(`correos/${clave}`)) {
      // avisa que el correo ya está en uso
      res.status(409).json({ resultado: 'email_en_uso' });
      // termina aquí
      return;
    }

    // El id se arma con el nombre (ej: "jaimito-k3f9") para que se entienda en Firebase
    const perfil: Perfil = { uid: generarId(nombre.trim()), nombre: nombre.trim(), email: email.trim().toLowerCase() };
    // guarda la cuenta nueva en la base de datos
    await bd.actualizar({
      // anota el correo apuntando al usuario
      [`correos/${clave}`]: perfil.uid,
      // guarda el nombre del usuario
      [`usuarios/${perfil.uid}/nombre`]: perfil.nombre,
      // guarda el correo del usuario
      [`usuarios/${perfil.uid}/correo`]: perfil.email,
      // Para ingresar se usa la versión cifrada (ver auth.ts). La contraseña tal cual se guarda
      // solo para que se pueda ver en Firebase: si se deja de querer, basta con borrar "contrasena"
      [`usuarios/${perfil.uid}/contrasena`]: password,
      // guarda la contraseña cifrada
      [`usuarios/${perfil.uid}/contrasenaCifrada`]: await cifrarContrasena(password),
    });
    // deja al usuario con la sesión iniciada
    iniciarSesion(res, perfil, 201);
  });

  // dirección para ingresar con correo y contraseña
  rutas.post('/login', async (req, res) => {
    // saca el correo y la contraseña que mandó la app
    const { email, password } = req.body ?? {};
    // si falta el correo o la contraseña
    if (typeof email !== 'string' || typeof password !== 'string') {
      // avisa que debe escribir ambos
      return rechazar(res, 'Ingresa tu correo y tu contraseña.');
    }

    // Se avisa por separado si no hay cuenta con ese correo o si la contraseña está mal, para que
    // la app pueda ofrecer crear la cuenta. (Revela qué correos tienen cuenta, igual que /registro
    // al responder 'email_en_uso'.)
    const uid = (await bd.leer(`correos/${claveDeCorreo(email)}`)) as string | null;
    // si encontró el usuario, trae su nombre y correo
    const perfil = uid ? await leerPerfil(bd, uid) : null;
    // si no hay cuenta con ese correo
    if (!uid || !perfil) {
      // avisa que no existe la cuenta
      res.status(404).json({ resultado: 'sin_cuenta' });
      // termina aquí
      return;
    }
    // Las cuentas creadas antes de guardar la contraseña visible tienen el hash en "contrasena"
    const hash = ((await bd.leer(`usuarios/${uid}/contrasenaCifrada`)) ??
      // si no está la cifrada, usa la del campo antiguo
      (await bd.leer(`usuarios/${uid}/contrasena`))) as string | null;
    // si la contraseña escrita no coincide con la guardada
    if (!hash || !(await verificarContrasena(password, hash))) {
      // avisa que el correo o la contraseña están mal
      res.status(401).json({ resultado: 'credenciales_invalidas' });
      // termina aquí
      return;
    }
    // Deja las cuentas antiguas con la contraseña visible y la cifrada en su campo
    if ((await bd.leer(`usuarios/${uid}/contrasena`)) !== password) {
      // guarda ambas contraseñas en su lugar
      await bd.actualizar({
        // guarda la contraseña tal cual
        [`usuarios/${uid}/contrasena`]: password,
        // guarda la contraseña cifrada
        [`usuarios/${uid}/contrasenaCifrada`]: hash,
      });
    }
    // deja al usuario con la sesión iniciada
    iniciarSesion(res, perfil);
  });

  // dirección para saber quién es el usuario que ingresó
  rutas.get('/yo', requiereSesion(secreto, bd), async (_req, res) => {
    // trae el nombre y correo del usuario
    const perfil = await leerPerfil(bd, res.locals.uid);
    // si la cuenta ya no existe
    if (!perfil) {
      // responde que no tiene permiso
      res.status(401).json({ resultado: 'no_autorizado' });
      // termina aquí
      return;
    }
    // manda los datos del usuario a la app
    res.json({ resultado: 'ok', usuario: perfil });
  });

  // entrega el grupo de direcciones listo
  return rutas;
}
