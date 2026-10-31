// trae la herramienta que deja a la app hablar con el servidor desde otra dirección
import cors from 'cors';
// trae Express, la herramienta que arma el servidor
import express, { type NextFunction, type Request, type Response } from 'express';
// trae la función que da la clave secreta para firmar sesiones
import { obtenerSecreto } from './auth';
// trae la función que conecta con la base de datos
import { crearBaseDeDatos } from './db';
// trae las direcciones de tarjetas y compras
import { crearRutas } from './rutas';
// trae las direcciones de crear cuenta e ingresar, y el control de sesión
import { crearRutasAuth, requiereSesion } from './rutasAuth';

// Carga las variables de backend/.env si existe (ver .env.example)
try {
  // lee el archivo .env con la configuración
  process.loadEnvFile();
} catch {
  // Sin .env: se usa el archivo local como base de datos
}

// número de puerto donde escucha el servidor (3000 si no se indica)
const PUERTO = Number(process.env.PORT ?? 3000);
// se conecta a la base de datos (Firebase o archivo local)
const bd = await crearBaseDeDatos();
// obtiene la clave secreta para firmar las sesiones
const secreto = obtenerSecreto();

// crea el servidor
const app = express();
// La app (web o celular) corre en otro origen, por eso se habilita CORS
app.use(cors());
// permite leer los datos que manda la app en formato JSON
app.use(express.json());

// dirección para revisar que el servidor está encendido
app.get('/health', (_req, res) => {
  // responde que todo está bien
  res.json({ ok: true });
});
// Crear cuenta e ingresar no piden sesión; todo lo demás sí
app.use('/api/auth', crearRutasAuth(bd, secreto));
// las demás direcciones solo funcionan si el usuario ingresó
app.use('/api', requiereSesion(secreto, bd), crearRutas(bd));

// Cualquier error no controlado (ej: Firebase sin conexión) responde 500 en vez de botar el servidor
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Errores del cliente al leer el body (JSON mal formado, body demasiado grande): no son fallas del servidor
  const status = (error as { status?: number } | null)?.status;
  // si el error es culpa de lo que mandó la app, se lo avisa
  if (status !== undefined && status >= 400 && status < 500) {
    // responde que los datos enviados no son válidos
    res.status(status).json({ resultado: 'datos_invalidos', mensaje: 'La petición no es válida: el cuerpo debe ser JSON.' });
    // termina aquí
    return;
  }
  // muestra el error en la consola del servidor
  console.error(error);
  // responde que hubo una falla en el servidor
  res.status(500).json({ resultado: 'error_servidor' });
});

// enciende el servidor y lo deja esperando pedidos
app.listen(PUERTO, () => {
  // muestra en la consola la dirección del servidor
  console.log(`API escuchando en http://localhost:${PUERTO}`);
  // muestra en la consola qué base de datos se está usando
  console.log(`Base de datos: ${bd.descripcion}`);
});
