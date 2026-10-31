/* ============================================================
   Cómo se guardan los datos en Firebase

   El árbol está pensado para leerse a simple vista en la consola de Firebase:
   cada usuario tiene sus tarjetas, y cada tarjeta tiene adentro sus compras y
   suscripciones. Los identificadores se arman con el nombre de cada cosa
   (ver logica/id.ts), así se entiende qué es cada nodo.

   {
     "correos": {
       "jaimito@correo,cl": "jaimito-k3f9"        ← para ingresar: correo → usuario
     },                                              (Firebase no acepta "." en las claves)
     "usuarios": {
       "jaimito-k3f9": {
         "nombre": "Jaimito",
         "correo": "jaimito@correo.cl",
         "contrasena": "<cifrada, nunca la contraseña real>",
         "tarjetas": {
           "banco-santander-a1b2": {
             "banco": "Banco Santander",            ← título de la tarjeta
             "emisor": "santander",                 ← banco elegido de la lista
             "alias": "Mi Santander",               ← solo si es distinto del título
             "color": "#DC2626",
             "cupo": 600000,
             "diaVencimiento": 15,
             "pagadoHasta": "2026-10",              ← último mes pagado
             "compartidaCon": { "camila-p4q8": "Camila" },
             "compras": {
               "bicicleta-oxford-x9w2": {
                 "descripcion": "Bicicleta Oxford",
                 "monto": 359990,
                 "cuotas": 6,
                 "cuotaActual": 3,
                 "primerMes": "2026-07",            ← mes en que se cobra la cuota 1
                 "registradaPor": "jaimito-k3f9"
               }
             },
             "suscripciones": {
               "netflix-7c3d": {
                 "nombre": "Netflix",
                 "plan": "Estándar",
                 "monto": 10990,
                 "desde": "2026-05",                ← primer mes que se cobra
                 "pagadoHasta": "2026-10",
                 "registradaPor": "jaimito-k3f9"
               }
             }
           }
         },
         "tarjetasDeOtros": {
           "visa-camila-m2n6": "camila-p4q8"       ← tarjeta que Camila compartió: id → dueño
         }
       }
     }
   }

   Una tarjeta compartida se guarda una sola vez, en el usuario dueño. Quien la recibe
   solo anota en "tarjetasDeOtros" de quién es, y todos leen y escriben la misma copia.

   La lógica de la app (logica/, servicio.ts) no trabaja con esta forma, sino con listas
   de tarjetas, compras y suscripciones (modelos.ts). Este archivo traduce entre las dos.
   ============================================================ */

import { calcularCuotaBase } from './logica/cuotas';
import type { DatosBD, SuscripcionBase, TarjetaBase, TransaccionBase } from './modelos';

/* ---------- Forma guardada ---------- */

export interface CompraGuardada {
  descripcion: string;
  monto: number;
  cuotas: number;
  cuotaActual: number;
  primerMes: string;
  registradaPor: string;
}

export interface SuscripcionGuardada {
  nombre: string;
  plan?: string;
  monto: number;
  desde: string;
  pagadoHasta?: string;
  registradaPor: string;
}

export interface TarjetaGuardada {
  banco: string;
  emisor: string;
  alias?: string;
  color: string;
  cupo: number;
  diaVencimiento: number;
  pagadoHasta?: string;
  compartidaCon?: Record<string, string>; // { idUsuario: nombre }
  compras?: Record<string, CompraGuardada>;
  suscripciones?: Record<string, SuscripcionGuardada>;
}

export interface UsuarioGuardado {
  nombre: string;
  correo: string;
  contrasena: string;
  tarjetas?: Record<string, TarjetaGuardada>;
  tarjetasDeOtros?: Record<string, string>; // { idTarjeta: idDueño }
}

/* ---------- Rutas ---------- */

export const rutaUsuario = (uid: string) => `usuarios/${uid}`;
export const rutaTarjeta = (dueno: string, tarjetaId: string) => `${rutaUsuario(dueno)}/tarjetas/${tarjetaId}`;
export const rutaCompra = (dueno: string, tarjetaId: string, id: string) =>
  `${rutaTarjeta(dueno, tarjetaId)}/compras/${id}`;
export const rutaSuscripcion = (dueno: string, tarjetaId: string, id: string) =>
  `${rutaTarjeta(dueno, tarjetaId)}/suscripciones/${id}`;

/* ---------- De Firebase a la lógica ---------- */

/** Agrega a `datos` una tarjeta guardada, con sus compras y suscripciones. */
export function agregarTarjetaGuardada(datos: Required<DatosBD>, id: string, t: TarjetaGuardada) {
  datos.tarjetas[id] = {
    id,
    emisor: t.emisor,
    nombre: t.banco,
    alias: t.alias ?? t.banco,
    banco: t.banco,
    diaVencimiento: t.diaVencimiento,
    colorHex: t.color,
    cupoTotal: t.cupo,
    ultimoMesPagado: t.pagadoHasta,
    miembros: Object.fromEntries(Object.keys(t.compartidaCon ?? {}).map((uid) => [uid, true as const])),
  };
  for (const [compraId, c] of Object.entries(t.compras ?? {})) {
    datos.transacciones[compraId] = {
      id: compraId,
      tarjetaId: id,
      motivo: c.descripcion,
      montoTotal: c.monto,
      cuotaMensual: calcularCuotaBase(c.monto, c.cuotas), // se calcula: no hace falta guardarla
      cuotaActual: c.cuotaActual,
      totalCuotas: c.cuotas,
      mesInicio: c.primerMes,
      autorUid: c.registradaPor,
    };
  }
  for (const [subId, s] of Object.entries(t.suscripciones ?? {})) {
    datos.suscripciones[subId] = {
      id: subId,
      tarjetaId: id,
      nombre: s.nombre,
      plan: s.plan ?? '',
      monto: s.monto,
      mesInicio: s.desde,
      ultimoMesPagado: s.pagadoHasta,
      autorUid: s.registradaPor,
    };
  }
}

/* ---------- De la lógica a Firebase ---------- */

/** Tarjeta nueva tal como se guarda (sin compras ni suscripciones todavía). */
export const tarjetaAGuardar = (t: Omit<TarjetaBase, 'id'>): TarjetaGuardada => ({
  banco: t.banco,
  emisor: t.emisor,
  ...(t.alias && t.alias !== t.banco ? { alias: t.alias } : {}),
  color: t.colorHex,
  cupo: t.cupoTotal,
  diaVencimiento: t.diaVencimiento,
});

export const compraAGuardar = (c: TransaccionBase): CompraGuardada => ({
  descripcion: c.motivo,
  monto: c.montoTotal,
  cuotas: c.totalCuotas,
  cuotaActual: c.cuotaActual,
  primerMes: c.mesInicio,
  registradaPor: c.autorUid!,
});

export const suscripcionAGuardar = (s: SuscripcionBase): SuscripcionGuardada => ({
  nombre: s.nombre,
  ...(s.plan ? { plan: s.plan } : {}),
  monto: s.monto,
  desde: s.mesInicio!,
  ...(s.ultimoMesPagado ? { pagadoHasta: s.ultimoMesPagado } : {}),
  registradaPor: s.autorUid!,
});
