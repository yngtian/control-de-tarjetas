/* ============================================================
   Pasa los datos del archivo local a Firebase:  npm run migrar

   Copia todo lo que hay en datos-local.json (cuentas, usuarios, tarjetas, compras,
   suscripciones y tarjetas compartidas) a la Firebase Realtime Database configurada
   en .env. Sirve una sola vez, al pasar de desarrollo local a Firebase.

   Solo escribe las ramas "cuentas" y "usuarios": si en Firebase ya había otras cosas,
   no se tocan. Si una cuenta ya existe en Firebase, se reemplaza por la del archivo.
   ============================================================ */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { crearBaseDeDatos } from './db';

try {
  process.loadEnvFile();
} catch {
  // Sin .env no hay Firebase configurado: se avisa abajo
}

if (!process.env.FIREBASE_DATABASE_URL || !process.env.FIREBASE_CREDENCIALES) {
  console.error('Falta configurar Firebase en backend/.env (FIREBASE_DATABASE_URL y FIREBASE_CREDENCIALES).');
  process.exit(1);
}

const archivo = path.resolve(process.env.ARCHIVO_LOCAL ?? 'datos-local.json');
if (!existsSync(archivo)) {
  console.error(`No existe ${archivo}: no hay datos locales que pasar.`);
  process.exit(1);
}

const datos = JSON.parse(readFileSync(archivo, 'utf8')) as {
  cuentas?: Record<string, unknown>;
  usuarios?: Record<string, unknown>;
};
const bd = await crearBaseDeDatos();

// Una escritura por cuenta y por usuario: reemplaza solo esos nodos, no toda la base
const cambios: Record<string, unknown> = {};
for (const [clave, cuenta] of Object.entries(datos.cuentas ?? {})) cambios[`cuentas/${clave}`] = cuenta;
for (const [uid, usuario] of Object.entries(datos.usuarios ?? {})) cambios[`usuarios/${uid}`] = usuario;
await bd.actualizar(cambios);

console.log(`Datos pasados a ${bd.descripcion}:`);
console.log(`  ${Object.keys(datos.cuentas ?? {}).length} cuentas y ${Object.keys(datos.usuarios ?? {}).length} usuarios.`);
process.exit(0);
