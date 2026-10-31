/* ============================================================
   Modelos de datos

   Hay dos tipos de datos:
   - "Base": lo que se guarda en Firebase (lo que escribe el usuario).
   - "Item": lo que se entrega a la app (lo guardado + lo calculado).
   Los calculados nunca se guardan, así nunca quedan desactualizados.

   Tarjetas compartidas: una tarjeta (con sus compras y suscripciones) vive siempre
   en la cuenta de su dueño. Al compartirla, el dueño anota al otro usuario en
   `miembros` y el otro guarda una referencia en `compartidasConmigo`. Así hay una
   sola copia de los datos y lo que registra cualquiera lo ven todos.

   Ojo: la app (frontend/api/tipos.ts) tiene una copia de los tipos que
   recibe. Si cambias lo que devuelve la API, actualiza los dos lados.
   ============================================================ */

/* ---------- Lo que se guarda ---------- */

export interface TarjetaBase {
  id: string;
  emisor: string;           // id del emisor ("bancoestado", "visa"...), ver limites.ts
  nombre: string;           // título que se ve en la tarjeta
  alias: string;            // nombre interno (obligatorio en Visa y MasterCard)
  banco: string;
  diaVencimiento: number;   // Día del mes (1 a 31)
  colorHex: string;
  cupoTotal: number;
  ultimoMesPagado?: string; // Mes del último pago ("2026-10"): impide pagar dos veces el mismo mes
  miembros?: Record<string, true>; // Usuarios con quienes el dueño la compartió ({ uid: true })
}

export interface TransaccionBase {
  id: string;
  tarjetaId: string;     // A qué tarjeta pertenece
  motivo: string;        // Descripción de la compra (ej: "Ropa Ripley")
  montoTotal: number;    // Monto completo de la compra
  cuotaMensual: number;  // Valor de las cuotas 1 a N-1; la última absorbe el redondeo (ver logica/cuotas.ts)
  cuotaActual: number;   // Cuota que se está pagando ahora (empieza en 1)
  totalCuotas: number;
  mesInicio: string;     // Mes en que se cobra la cuota 1 ("2026-10"). Si la compra se hizo
                         // después del corte de la tarjeta, es el mes siguiente
  autorUid?: string;     // Quién la registró (en una tarjeta compartida puede no ser el dueño)
}

export interface SuscripcionBase {
  id: string;
  nombre: string;
  plan: string;
  monto: number;            // Cobro mensual
  tarjetaId: string;        // Toda suscripción pertenece a una tarjeta
  ultimoMesPagado?: string; // Mes del último pago. Al cambiar de mes vuelve a quedar pendiente
  mesInicio?: string;       // Primer mes que se cobra (las antiguas no lo tienen: se toma el mes actual)
  autorUid?: string;        // Quién la registró
}

/**
 * Los datos de un usuario en Firebase (rama `usuarios/<uid>`). Las compras y suscripciones
 * de sus tarjetas están aquí aunque las haya registrado otra persona con quien las comparte.
 * Firebase no guarda colecciones vacías, por eso todas son opcionales.
 */
export interface DatosBD {
  tarjetas?: Record<string, TarjetaBase>;
  transacciones?: Record<string, TransaccionBase>;
  suscripciones?: Record<string, SuscripcionBase>;
  // Tarjetas de otros usuarios que compartieron con este: { tarjetaId: { dueno: uid } }
  compartidasConmigo?: Record<string, { dueno: string }>;
}

/* ---------- Lo que se entrega a la app ---------- */

/** Alguien con acceso a una tarjeta compartida. */
export interface Miembro {
  uid: string;
  nombre: string;
}

export interface TarjetaItem extends Omit<TarjetaBase, 'ultimoMesPagado' | 'miembros'> {
  propia: boolean;            // true si el usuario es el dueño (puede editarla, eliminarla y compartirla)
  duenoNombre: string | null; // Nombre del dueño si es de otra persona
  compartidaCon: string[];    // Nombres de las demás personas que la ven (vacío si no está compartida)
  miembros: Miembro[];        // Solo para el dueño: con quiénes la compartió
  vencimiento: string;        // "Vence 15 de Octubre (Quedan 3 días)"
  estadoVencimiento: string;  // Solo el subtexto: "Quedan 3 días" / "Atrasada..."
  montoNumerico: number;      // Total a pagar este mes: cuotas + suscripciones pendientes
  monto: string;              // Mismo total formateado: "$10.000"
  cupoDisponible: number;
  pagadaEsteMes: boolean;
  // Meses anteriores que no se pagaron y lo que suman (ya incluido en montoNumerico).
  // Si pasa un mes sin registrar el pago, sus cuotas y suscripciones se acumulan.
  mesesAtrasados: number;
  montoAtrasado: number;
}

export interface TransaccionItem extends TransaccionBase {
  montoCuotaActual: number; // Lo que vale la cuota actual (la última puede valer distinto)
  mesCobro: string;         // Mes en que se cobra la cuota actual (anterior al actual si está atrasada)
  cuotasPorPagar: number;   // Cuotas que ya debían pagarse hasta este mes, incluida la de este mes
  cuotasAtrasadas: number;  // De ellas, las de meses anteriores
  montoPorPagar: number;    // Lo que suman esas cuotas
  autor: string | null;     // Nombre de quien la registró, si no fue el usuario
  editable: boolean;        // Puede editarla o eliminarla: la registró él o es dueño de la tarjeta
}

export interface SuscripcionItem extends Omit<SuscripcionBase, 'ultimoMesPagado'> {
  diaCobro: number;        // Día de vencimiento de la tarjeta asociada
  proximoCobro: string;    // "15 de Noviembre"
  diasRestantes: number;
  textoRestante: string;   // "Hoy" / "Mañana" / "En 5 días"
  pagadaEsteMes: boolean; // true si no queda nada por pagar hasta este mes
  mesesPorPagar: number;  // Meses que ya debían pagarse (más de 1 = hay meses atrasados)
  montoPorPagar: number;  // monto × mesesPorPagar
  tarjetaBanco: string;
  tarjetaColor: string;
  autor: string | null;   // Nombre de quien la registró, si no fue el usuario
  editable: boolean;      // Puede eliminarla: la registró él o es dueño de la tarjeta
}

/** Todo lo que la app necesita para dibujar sus pantallas. */
export interface Estado {
  mesActual: string;                // "2026-10"
  tarjetas: TarjetaItem[];
  transacciones: TransaccionItem[];
  suscripciones: SuscripcionItem[]; // Ordenadas por próximo cobro
  totalConsolidado: number;         // Suma a pagar este mes entre todas las tarjetas
  totalSuscripciones: number;       // Suma mensual de todas las suscripciones
}

/** Resultado de una acción. Cada uno se traduce a un código HTTP en rutas.ts. */
export type Resultado =
  | 'ok'
  | 'datos_invalidos'
  | 'sin_tarjeta'
  | 'sin_cupo'
  | 'ya_pagada'
  | 'no_existe'
  | 'sin_permiso'     // La tarjeta es de otra persona y la acción es solo del dueño (o del autor)
  | 'cuotas_pagadas'; // Cambiar monto o cuotas de una compra que ya pagó alguna cuota
