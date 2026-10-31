/* ============================================================
   Base de datos: Firebase Realtime Database (un árbol JSON)

   Todo el acceso pasa por dos operaciones:
   - leer(ruta): trae lo que hay en esa ruta del árbol (null si no hay nada).
   - actualizar(cambios): escribe varias rutas a la vez, igual que update() de Firebase.
     Ej: { "usuarios/jaimito-k3f9/tarjetas/banco-santander-a1b2/pagadoHasta": "2026-10",
           "usuarios/jaimito-k3f9/tarjetas/banco-santander-a1b2/compras/bicicleta-x9w2": null }
     Un valor null borra esa ruta. Es atómico: o se aplican todos o ninguno.

   Cómo queda el árbol: ver almacen.ts.

   Si no hay credenciales de Firebase configuradas se usa un archivo JSON local
   con la misma estructura, para poder desarrollar sin conexión.
   ============================================================ */

// trae las funciones para ver, leer y escribir archivos
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
// trae la herramienta para armar rutas de carpetas y archivos
import path from 'node:path';

/** Rutas del árbol y su nuevo valor (null = borrar). */
export type Cambios = Record<string, unknown>;

// lo que debe saber hacer cualquier base de datos que use el servidor
export interface BaseDeDatos {
  descripcion: string; // Se muestra en consola al arrancar
  // trae lo que hay guardado en una ruta
  leer(ruta: string): Promise<unknown>;
  // guarda varios cambios de una vez
  actualizar(cambios: Cambios): Promise<void>;
}

/** Firebase Realtime Database usando el SDK de administración (cuenta de servicio). */
async function crearFirebase(databaseURL: string, rutaCredenciales: string): Promise<BaseDeDatos> {
  // Se importa solo si se usa Firebase, así el modo local arranca más rápido
  const { cert, initializeApp } = await import('firebase-admin/app');
  // trae la función que abre la base de datos de Firebase
  const { getDatabase } = await import('firebase-admin/database');

  // lee el archivo con la clave de acceso a Firebase
  const credenciales = JSON.parse(readFileSync(rutaCredenciales, 'utf8'));
  // se conecta a Firebase con esa clave
  const app = initializeApp({ credential: cert(credenciales), databaseURL });
  // abre la base de datos
  const db = getDatabase(app);

  // devuelve las funciones para usar Firebase
  return {
    // texto que dice qué base de datos se usa
    descripcion: `Firebase Realtime Database (${databaseURL})`,
    // trae lo que hay en una ruta de Firebase
    async leer(ruta) {
      // pide a Firebase lo guardado en esa ruta
      const snapshot = await db.ref(ruta).get();
      // devuelve los datos encontrados
      return snapshot.val();
    },
    // guarda varios cambios en Firebase
    async actualizar(cambios) {
      // manda todos los cambios juntos
      await db.ref().update(cambios);
    },
  };
}

/** Pone (o borra, si es null) un valor en una ruta del objeto. Los nodos vacíos se borran, como en Firebase. */
function aplicarCambio(nodo: Record<string, unknown>, partes: string[], valor: unknown) {
  // separa el primer pedazo de la ruta del resto
  const [clave, ...resto] = partes;
  // si es el último pedazo de la ruta, aquí se guarda el valor
  if (resto.length === 0) {
    // si el valor está vacío, se borra
    if (valor === null) delete nodo[clave];
    // si no, se guarda
    else nodo[clave] = valor;
    // termina aquí
    return;
  }
  // si la carpeta de esa ruta todavía no existe
  if (typeof nodo[clave] !== 'object' || nodo[clave] === null) {
    if (valor === null) return; // Borrar algo que no existe: nada que hacer
    // crea la carpeta vacía
    nodo[clave] = {};
  }
  // entra a la carpeta siguiente
  const hijo = nodo[clave] as Record<string, unknown>;
  // sigue con el resto de la ruta
  aplicarCambio(hijo, resto, valor);
  // si la carpeta quedó vacía, se borra
  if (Object.keys(hijo).length === 0) delete nodo[clave];
}

/** Archivo JSON local con la misma estructura que Firebase (solo para desarrollo). */
function crearArchivoLocal(archivo: string): BaseDeDatos {
  // lee todo el archivo local (o nada si no existe)
  const leerArchivo = (): Record<string, unknown> =>
    // si el archivo existe lo lee; si no, empieza vacío
    existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8')) : {};

  // devuelve las funciones para usar el archivo local
  return {
    // texto que dice que se usa el archivo local
    descripcion: `archivo local ${archivo} (sin Firebase configurado)`,
    // trae lo que hay en una ruta del archivo
    async leer(ruta) {
      // empieza desde todo el contenido del archivo
      let nodo: unknown = leerArchivo();
      // recorre cada pedazo de la ruta
      for (const parte of ruta.split('/').filter(Boolean)) {
        // si ya no hay más carpetas, no hay nada en esa ruta
        if (typeof nodo !== 'object' || nodo === null) return null;
        // entra al siguiente pedazo de la ruta
        nodo = (nodo as Record<string, unknown>)[parte];
      }
      // devuelve lo encontrado (o nada)
      return nodo ?? null;
    },
    // guarda varios cambios en el archivo
    async actualizar(cambios) {
      // lee el contenido actual del archivo
      const datos = leerArchivo();
      // recorre cada cambio pedido
      for (const [ruta, valor] of Object.entries(cambios)) {
        // aplica ese cambio en los datos
        aplicarCambio(datos, ruta.split('/').filter(Boolean), valor);
      }
      // escribe todo de nuevo en el archivo
      writeFileSync(archivo, JSON.stringify(datos, null, 2));
    },
  };
}

/**
 * Elige la base de datos según las variables de entorno (ver .env.example):
 * con FIREBASE_DATABASE_URL y FIREBASE_CREDENCIALES usa Firebase; si falta alguna, el archivo local.
 */
export async function crearBaseDeDatos(): Promise<BaseDeDatos> {
  // lee la dirección y la clave de Firebase de la configuración
  const { FIREBASE_DATABASE_URL, FIREBASE_CREDENCIALES } = process.env;
  // si están las dos, usa Firebase
  if (FIREBASE_DATABASE_URL && FIREBASE_CREDENCIALES) {
    // se conecta a Firebase
    return crearFirebase(FIREBASE_DATABASE_URL, path.resolve(FIREBASE_CREDENCIALES));
  }
  // si no, usa el archivo local
  return crearArchivoLocal(path.resolve(process.env.ARCHIVO_LOCAL ?? 'datos-local.json'));
}
