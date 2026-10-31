/* ============================================================
   Pasa los datos del archivo local a Firebase:  npm run migrar

   Copia todo lo que hay en datos-local.json (correos y usuarios, con sus tarjetas,
   compras, suscripciones y tarjetas compartidas) a la Firebase Realtime Database
   configurada en .env. Sirve una sola vez, al pasar de desarrollo local a Firebase.

   Solo escribe las ramas "correos" y "usuarios": si en Firebase ya había otras cosas,
   no se tocan. Si un usuario ya existe en Firebase, se reemplaza por el del archivo.
   ============================================================ */

// trae las funciones para ver si existe un archivo y para leerlo
import { existsSync, readFileSync } from 'node:fs';
// trae la herramienta para armar rutas de carpetas y archivos
import path from 'node:path';
// trae la función que conecta con la base de datos
import { crearBaseDeDatos } from './db';

// intenta leer la configuración
try {
  // lee el archivo .env con la configuración
  process.loadEnvFile();
} catch {
  // Sin .env no hay Firebase configurado: se avisa abajo
}

// si falta la dirección o la clave de Firebase, no se puede seguir
if (!process.env.FIREBASE_DATABASE_URL || !process.env.FIREBASE_CREDENCIALES) {
  // avisa qué falta configurar
  console.error('Falta configurar Firebase en backend/.env (FIREBASE_DATABASE_URL y FIREBASE_CREDENCIALES).');
  // cierra el programa con error
  process.exit(1);
}

// ubica el archivo con los datos locales
const archivo = path.resolve(process.env.ARCHIVO_LOCAL ?? 'datos-local.json');
// si el archivo no existe, no hay nada que pasar
if (!existsSync(archivo)) {
  // avisa que no encontró el archivo
  console.error(`No existe ${archivo}: no hay datos locales que pasar.`);
  // cierra el programa con error
  process.exit(1);
}

// lee el archivo y lo convierte en datos que se pueden usar
const datos = JSON.parse(readFileSync(archivo, 'utf8')) as {
  // la lista de correos registrados
  correos?: Record<string, unknown>;
  // la lista de usuarios con sus tarjetas y compras
  usuarios?: Record<string, unknown>;
};
// se conecta a Firebase
const bd = await crearBaseDeDatos();

// Una escritura por correo y por usuario: reemplaza solo esos nodos, no toda la base
const cambios: Record<string, unknown> = {};
// agrega cada correo a la lista de cambios
for (const [clave, uid] of Object.entries(datos.correos ?? {})) cambios[`correos/${clave}`] = uid;
// agrega cada usuario a la lista de cambios
for (const [uid, usuario] of Object.entries(datos.usuarios ?? {})) cambios[`usuarios/${uid}`] = usuario;
// guarda todos los cambios en Firebase de una vez
await bd.actualizar(cambios);

// avisa a qué base se pasaron los datos
console.log(`Datos pasados a ${bd.descripcion}:`);
// avisa cuántos correos y usuarios se pasaron
console.log(`  ${Object.keys(datos.correos ?? {}).length} correos y ${Object.keys(datos.usuarios ?? {}).length} usuarios.`);
// cierra el programa sin errores
process.exit(0);
