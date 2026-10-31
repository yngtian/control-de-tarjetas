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

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Rutas del árbol y su nuevo valor (null = borrar). */
export type Cambios = Record<string, unknown>;

export interface BaseDeDatos {
  descripcion: string; // Se muestra en consola al arrancar
  leer(ruta: string): Promise<unknown>;
  actualizar(cambios: Cambios): Promise<void>;
}

/** Firebase Realtime Database usando el SDK de administración (cuenta de servicio). */
async function crearFirebase(databaseURL: string, rutaCredenciales: string): Promise<BaseDeDatos> {
  // Se importa solo si se usa Firebase, así el modo local arranca más rápido
  const { cert, initializeApp } = await import('firebase-admin/app');
  const { getDatabase } = await import('firebase-admin/database');

  const credenciales = JSON.parse(readFileSync(rutaCredenciales, 'utf8'));
  const app = initializeApp({ credential: cert(credenciales), databaseURL });
  const db = getDatabase(app);

  return {
    descripcion: `Firebase Realtime Database (${databaseURL})`,
    async leer(ruta) {
      const snapshot = await db.ref(ruta).get();
      return snapshot.val();
    },
    async actualizar(cambios) {
      await db.ref().update(cambios);
    },
  };
}

/** Pone (o borra, si es null) un valor en una ruta del objeto. Los nodos vacíos se borran, como en Firebase. */
function aplicarCambio(nodo: Record<string, unknown>, partes: string[], valor: unknown) {
  const [clave, ...resto] = partes;
  if (resto.length === 0) {
    if (valor === null) delete nodo[clave];
    else nodo[clave] = valor;
    return;
  }
  if (typeof nodo[clave] !== 'object' || nodo[clave] === null) {
    if (valor === null) return; // Borrar algo que no existe: nada que hacer
    nodo[clave] = {};
  }
  const hijo = nodo[clave] as Record<string, unknown>;
  aplicarCambio(hijo, resto, valor);
  if (Object.keys(hijo).length === 0) delete nodo[clave];
}

/** Archivo JSON local con la misma estructura que Firebase (solo para desarrollo). */
function crearArchivoLocal(archivo: string): BaseDeDatos {
  const leerArchivo = (): Record<string, unknown> =>
    existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8')) : {};

  return {
    descripcion: `archivo local ${archivo} (sin Firebase configurado)`,
    async leer(ruta) {
      let nodo: unknown = leerArchivo();
      for (const parte of ruta.split('/').filter(Boolean)) {
        if (typeof nodo !== 'object' || nodo === null) return null;
        nodo = (nodo as Record<string, unknown>)[parte];
      }
      return nodo ?? null;
    },
    async actualizar(cambios) {
      const datos = leerArchivo();
      for (const [ruta, valor] of Object.entries(cambios)) {
        aplicarCambio(datos, ruta.split('/').filter(Boolean), valor);
      }
      writeFileSync(archivo, JSON.stringify(datos, null, 2));
    },
  };
}

/**
 * Elige la base de datos según las variables de entorno (ver .env.example):
 * con FIREBASE_DATABASE_URL y FIREBASE_CREDENCIALES usa Firebase; si falta alguna, el archivo local.
 */
export async function crearBaseDeDatos(): Promise<BaseDeDatos> {
  const { FIREBASE_DATABASE_URL, FIREBASE_CREDENCIALES } = process.env;
  if (FIREBASE_DATABASE_URL && FIREBASE_CREDENCIALES) {
    return crearFirebase(FIREBASE_DATABASE_URL, path.resolve(FIREBASE_CREDENCIALES));
  }
  return crearArchivoLocal(path.resolve(process.env.ARCHIVO_LOCAL ?? 'datos-local.json'));
}
