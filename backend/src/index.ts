import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { obtenerSecreto } from './auth';
import { crearBaseDeDatos } from './db';
import { crearRutas } from './rutas';
import { crearRutasAuth, requiereSesion } from './rutasAuth';

// Carga las variables de backend/.env si existe (ver .env.example)
try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usa el archivo local como base de datos
}

const PUERTO = Number(process.env.PORT ?? 3000);
const bd = await crearBaseDeDatos();
const secreto = obtenerSecreto();

const app = express();
// La app (web o celular) corre en otro origen, por eso se habilita CORS
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});
// Crear cuenta e ingresar no piden sesión; todo lo demás sí
app.use('/api/auth', crearRutasAuth(bd, secreto));
app.use('/api', requiereSesion(secreto), crearRutas(bd));

// Cualquier error no controlado (ej: Firebase sin conexión) responde 500 en vez de botar el servidor
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Errores del cliente al leer el body (JSON mal formado, body demasiado grande): no son fallas del servidor
  const status = (error as { status?: number } | null)?.status;
  if (status !== undefined && status >= 400 && status < 500) {
    res.status(status).json({ resultado: 'datos_invalidos', mensaje: 'La petición no es válida: el cuerpo debe ser JSON.' });
    return;
  }
  console.error(error);
  res.status(500).json({ resultado: 'error_servidor' });
});

app.listen(PUERTO, () => {
  console.log(`API escuchando en http://localhost:${PUERTO}`);
  console.log(`Base de datos: ${bd.descripcion}`);
});
