/* ============================================================
   Tipos de lo que devuelve la API (copia de backend/src/modelos.ts
   y backend/src/logica/proyecciones.ts). Si cambia la API, actualiza ambos lados.
   ============================================================ */

/** Alguien con acceso a una tarjeta compartida. */
export interface Miembro {
  uid: string;
  nombre: string;
}

/**
 * Una tarjeta lista para mostrar: lo guardado + lo calculado por el backend.
 * Puede ser del usuario o de otra persona que la compartió con él: en ese caso la ve
 * con todas sus compras y suscripciones, y puede registrar gastos y pagar el mes.
 */
export interface TarjetaItem {
  id: string;
  emisor: string;             // id del emisor ("bancoestado", "visa"...), ver constants/banks.ts
  propia: boolean;            // true si el usuario es el dueño (puede editarla, eliminarla y compartirla)
  duenoNombre: string | null; // Nombre del dueño si es de otra persona
  compartidaCon: string[];    // Nombres de las demás personas que la ven (vacío si no está compartida)
  miembros: Miembro[];        // Solo para el dueño: con quiénes la compartió
  nombre: string;             // título que se ve en la tarjeta
  alias: string;              // nombre interno (obligatorio en Visa y MasterCard)
  banco: string;
  diaVencimiento: number;     // Día del mes (1 a 31)
  vencimiento: string;        // "Vence 15 de Octubre (Quedan 3 días)"
  colorHex: string;
  montoNumerico: number;      // Total a pagar este mes: cuotas + suscripciones pendientes
  monto: string;              // Mismo total formateado: "$10.000"
  estadoVencimiento: string;  // Solo el subtexto: "Quedan 3 días" / "Atrasada..."
  cupoTotal: number;
  cupoDisponible: number;
  pagadaEsteMes: boolean;
  // Meses anteriores que no se pagaron y lo que suman (ya incluido en montoNumerico)
  mesesAtrasados: number;
  montoAtrasado: number;
}

/** Una compra en cuotas. */
export interface TransaccionItem {
  id: string;
  tarjetaId: string;
  motivo: string;            // "Ropa Ripley"
  montoTotal: number;
  cuotaMensual: number;
  cuotaActual: number;       // Cuota que se está pagando ahora (empieza en 1)
  totalCuotas: number;
  mesInicio: string;         // Mes en que se cobra la cuota 1 ("2026-10")
  montoCuotaActual: number;  // Lo que vale la cuota actual (la última puede valer distinto)
  mesCobro: string;          // Mes en que se cobra la cuota actual (anterior al actual si está atrasada)
  cuotasPorPagar: number;    // Cuotas que ya debían pagarse hasta este mes, incluida la de este mes
  cuotasAtrasadas: number;   // De ellas, las de meses anteriores
  montoPorPagar: number;     // Lo que suman esas cuotas
  autor: string | null;      // Nombre de quien la registró, si no fue el usuario
  editable: boolean;         // Puede editarla o eliminarla: la registró él o es dueño de la tarjeta
}

export interface SuscripcionItem {
  id: string;
  nombre: string;          // "Netflix"
  plan: string;            // "Plan Premium"
  monto: number;           // Cobro mensual
  diaCobro: number;        // Día de vencimiento de la tarjeta asociada
  proximoCobro: string;    // "15 de Noviembre"
  diasRestantes: number;
  textoRestante: string;   // "Hoy" / "Mañana" / "En 5 días"
  pagadaEsteMes: boolean; // true si no queda nada por pagar hasta este mes
  mesesPorPagar: number;  // Meses que ya debían pagarse (más de 1 = hay meses atrasados)
  montoPorPagar: number;  // monto × mesesPorPagar
  mesInicio?: string;     // Primer mes que se cobra
  tarjetaId: string;
  tarjetaBanco: string;
  tarjetaColor: string;
  autor: string | null;   // Nombre de quien la registró, si no fue el usuario
  editable: boolean;      // Puede eliminarla: la registró él o es dueño de la tarjeta
}

/** Todo lo que la app necesita para dibujar sus pantallas (GET /api/estado). */
export interface Estado {
  mesActual: string;                // "2026-10"
  tarjetas: TarjetaItem[];
  transacciones: TransaccionItem[];
  suscripciones: SuscripcionItem[]; // Ordenadas por próximo cobro
  totalConsolidado: number;
  totalSuscripciones: number;
}

/* ---------- Proyecciones (GET /api/proyecciones) ---------- */

export interface CobroProyectado {
  id: string;
  tipo: 'cuota' | 'suscripcion';
  nombre: string;
  detalle: string;      // "Cuota 3 de 6" / "Plan Premium"
  monto: number;
  ultimaCuota: boolean;
  atrasado: boolean;    // Incluye cobros de meses anteriores sin pagar (solo en el mes actual)
}

export interface TarjetaProyectada {
  tarjetaId: string;
  banco: string;
  colorHex: string;
  total: number;
  cobros: CobroProyectado[];
}

export interface MesProyectado {
  clave: string;          // "2026-11"
  cuotas: number;
  suscripciones: number;
  total: number;
  deudaRestante: number;  // Lo que queda en cuotas después de pagar ese mes
  tarjetas: TarjetaProyectada[];
}

export interface Proyeccion {
  meses: MesProyectado[];
  ultimoMesConCuotas: string | null;
}

/* ---------- Cuentas (POST /api/auth/...) ---------- */

/** El usuario con sesión iniciada. */
export interface Usuario {
  uid: string;
  nombre: string;
  email: string;
}

/** Respuesta de registro e ingreso: si salió bien trae el token y el usuario. */
export interface RespuestaSesion {
  resultado: Resultado;
  token?: string;
  usuario?: Usuario;
  mensaje?: string;
}

/* ---------- Acciones ---------- */

/**
 * Resultado de una acción. Los primeros vienen del backend;
 * 'sin_conexion' significa que no se pudo hablar con él.
 */
export type Resultado =
  | 'ok'
  | 'datos_invalidos'
  | 'sin_tarjeta'
  | 'sin_cupo'
  | 'ya_pagada'
  | 'no_existe'
  | 'email_en_uso'           // Registro: ya hay una cuenta con ese correo
  | 'credenciales_invalidas' // Ingreso: correo o contraseña incorrectos
  | 'no_autorizado'          // Sin sesión o sesión vencida
  | 'sin_permiso'            // La tarjeta es de otra persona: la acción es solo del dueño (o del autor)
  | 'cuotas_pagadas'         // Cambiar monto o cuotas de una compra que ya pagó alguna cuota
  | 'sin_conexion';

/** Lo que devuelve una acción a la pantalla. */
export interface ResultadoAccion {
  resultado: Resultado;
  mensaje?: string; // Con 'datos_invalidos': qué campo falló, listo para mostrar
}

export interface NuevaTarjeta {
  emisor: string;  // id del banco elegido
  nombre: string;
  alias: string;   // Puede ir vacío salvo en Visa y MasterCard: el backend usa el nombre del banco
  banco: string;
  diaVencimiento: number;
  colorHex: string;
  cupoTotal: number;
}

/** Lo que se puede cambiar de una tarjeta (solo los campos presentes). */
export interface CambiosTarjeta {
  alias?: string;
  cupoTotal?: number;
  diaVencimiento?: number;
}

/** Lo que se puede cambiar de una compra (solo los campos presentes). */
export interface CambiosTransaccion {
  motivo?: string;
  monto?: number;
  cuotas?: number;
}

export interface NuevaSuscripcion {
  nombre: string;
  plan: string;
  monto: number;
  tarjetaId: string;
}
