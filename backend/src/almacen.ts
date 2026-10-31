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
         "contrasena": "jaimito123",                 ← tal cual, para poder verla (no se usa para ingresar)
         "contrasenaCifrada": "<sal:hash>",          ← la que se revisa al ingresar (ver auth.ts)
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

// trae la función que calcula el valor de cada cuota
import { calcularCuotaBase } from './logica/cuotas';
// trae los tipos de datos de tarjetas, compras y suscripciones
import type { DatosBD, SuscripcionBase, TarjetaBase, TransaccionBase } from './modelos';

/* ---------- Forma guardada ---------- */

// cómo se guarda una compra en Firebase
export interface CompraGuardada {
  // qué se compró
  descripcion: string;
  // cuánto costó la compra completa
  monto: number;
  // en cuántas cuotas se paga
  cuotas: number;
  // qué cuota se está pagando ahora
  cuotaActual: number;
  // mes en que se cobra la primera cuota
  primerMes: string;
  // quién registró la compra
  registradaPor: string;
}

// cómo se guarda una suscripción en Firebase
export interface SuscripcionGuardada {
  // nombre de la suscripción
  nombre: string;
  // plan contratado (puede no venir)
  plan?: string;
  // cuánto se cobra cada mes
  monto: number;
  // primer mes que se cobra
  desde: string;
  // último mes pagado (puede no venir)
  pagadoHasta?: string;
  // quién registró la suscripción
  registradaPor: string;
}

// cómo se guarda una tarjeta en Firebase
export interface TarjetaGuardada {
  // título de la tarjeta
  banco: string;
  // banco elegido de la lista
  emisor: string;
  // apodo de la tarjeta (puede no venir)
  alias?: string;
  // aquí se guarda el color de la tarjeta
  color: string;
  // cuánto dinero permite gastar la tarjeta
  cupo: number;
  // día del mes en que vence la tarjeta
  diaVencimiento: number;
  // último mes pagado (puede no venir)
  pagadoHasta?: string;
  compartidaCon?: Record<string, string>; // { idUsuario: nombre }
  // las compras hechas con esta tarjeta
  compras?: Record<string, CompraGuardada>;
  // las suscripciones que se cobran en esta tarjeta
  suscripciones?: Record<string, SuscripcionGuardada>;
}

// cómo se guarda un usuario en Firebase
export interface UsuarioGuardado {
  // nombre del usuario
  nombre: string;
  // correo del usuario
  correo: string;
  contrasena: string;        // tal cual la escribió el usuario
  contrasenaCifrada: string; // hash con que se revisa al ingresar
  // las tarjetas propias del usuario
  tarjetas?: Record<string, TarjetaGuardada>;
  tarjetasDeOtros?: Record<string, string>; // { idTarjeta: idDueño }
}

/* ---------- Rutas ---------- */

// arma la dirección donde se guarda un usuario
export const rutaUsuario = (uid: string) => `usuarios/${uid}`;
// arma la dirección donde se guarda una tarjeta
export const rutaTarjeta = (dueno: string, tarjetaId: string) => `${rutaUsuario(dueno)}/tarjetas/${tarjetaId}`;
// arma la dirección donde se guarda una compra
export const rutaCompra = (dueno: string, tarjetaId: string, id: string) =>
  // la compra queda dentro de su tarjeta
  `${rutaTarjeta(dueno, tarjetaId)}/compras/${id}`;
// arma la dirección donde se guarda una suscripción
export const rutaSuscripcion = (dueno: string, tarjetaId: string, id: string) =>
  // la suscripción queda dentro de su tarjeta
  `${rutaTarjeta(dueno, tarjetaId)}/suscripciones/${id}`;

/* ---------- De Firebase a la lógica ---------- */

/** Agrega a `datos` una tarjeta guardada, con sus compras y suscripciones. */
export function agregarTarjetaGuardada(datos: Required<DatosBD>, id: string, t: TarjetaGuardada) {
  // agrega la tarjeta a la lista, traduciendo cada dato
  datos.tarjetas[id] = {
    // código de la tarjeta
    id,
    // banco elegido de la lista
    emisor: t.emisor,
    // título de la tarjeta
    nombre: t.banco,
    // apodo de la tarjeta (si no tiene, usa el título)
    alias: t.alias ?? t.banco,
    // nombre del banco
    banco: t.banco,
    // día en que vence la tarjeta
    diaVencimiento: t.diaVencimiento,
    // aquí se pasa el color de la tarjeta
    colorHex: t.color,
    // cuánto dinero permite gastar
    cupoTotal: t.cupo,
    // último mes que se pagó
    ultimoMesPagado: t.pagadoHasta,
    // las personas con quienes se compartió la tarjeta
    miembros: Object.fromEntries(Object.keys(t.compartidaCon ?? {}).map((uid) => [uid, true as const])),
  };
  // recorre cada compra de la tarjeta
  for (const [compraId, c] of Object.entries(t.compras ?? {})) {
    // agrega la compra a la lista, traduciendo cada dato
    datos.transacciones[compraId] = {
      // código de la compra
      id: compraId,
      // a qué tarjeta pertenece
      tarjetaId: id,
      // qué se compró
      motivo: c.descripcion,
      // cuánto costó la compra completa
      montoTotal: c.monto,
      cuotaMensual: calcularCuotaBase(c.monto, c.cuotas), // se calcula: no hace falta guardarla
      // qué cuota se está pagando ahora
      cuotaActual: c.cuotaActual,
      // en cuántas cuotas se paga
      totalCuotas: c.cuotas,
      // mes de la primera cuota
      mesInicio: c.primerMes,
      // quién registró la compra
      autorUid: c.registradaPor,
    };
  }
  // recorre cada suscripción de la tarjeta
  for (const [subId, s] of Object.entries(t.suscripciones ?? {})) {
    // agrega la suscripción a la lista, traduciendo cada dato
    datos.suscripciones[subId] = {
      // código de la suscripción
      id: subId,
      // a qué tarjeta pertenece
      tarjetaId: id,
      // nombre de la suscripción
      nombre: s.nombre,
      // plan contratado (vacío si no tiene)
      plan: s.plan ?? '',
      // cuánto se cobra cada mes
      monto: s.monto,
      // primer mes que se cobra
      mesInicio: s.desde,
      // último mes que se pagó
      ultimoMesPagado: s.pagadoHasta,
      // quién registró la suscripción
      autorUid: s.registradaPor,
    };
  }
}

/* ---------- De la lógica a Firebase ---------- */

/** Tarjeta nueva tal como se guarda (sin compras ni suscripciones todavía). */
export const tarjetaAGuardar = (t: Omit<TarjetaBase, 'id'>): TarjetaGuardada => ({
  // título de la tarjeta
  banco: t.banco,
  // banco elegido de la lista
  emisor: t.emisor,
  // guarda el apodo solo si es distinto del título
  ...(t.alias && t.alias !== t.banco ? { alias: t.alias } : {}),
  // aquí se guarda el color de la tarjeta
  color: t.colorHex,
  // cuánto dinero permite gastar
  cupo: t.cupoTotal,
  // día en que vence la tarjeta
  diaVencimiento: t.diaVencimiento,
});

// arma una compra tal como se guarda en Firebase
export const compraAGuardar = (c: TransaccionBase): CompraGuardada => ({
  // qué se compró
  descripcion: c.motivo,
  // cuánto costó la compra completa
  monto: c.montoTotal,
  // en cuántas cuotas se paga
  cuotas: c.totalCuotas,
  // qué cuota se está pagando ahora
  cuotaActual: c.cuotaActual,
  // mes de la primera cuota
  primerMes: c.mesInicio,
  // quién registró la compra
  registradaPor: c.autorUid!,
});

// arma una suscripción tal como se guarda en Firebase
export const suscripcionAGuardar = (s: SuscripcionBase): SuscripcionGuardada => ({
  // nombre de la suscripción
  nombre: s.nombre,
  // guarda el plan solo si tiene uno
  ...(s.plan ? { plan: s.plan } : {}),
  // cuánto se cobra cada mes
  monto: s.monto,
  // primer mes que se cobra
  desde: s.mesInicio!,
  // guarda el último mes pagado solo si hay uno
  ...(s.ultimoMesPagado ? { pagadoHasta: s.ultimoMesPagado } : {}),
  // quién registró la suscripción
  registradaPor: s.autorUid!,
});
