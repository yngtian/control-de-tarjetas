/* ============================================================
   Tipos de lo que devuelve la API (copia de backend/src/modelos.ts
   y backend/src/logica/proyecciones.ts). Si cambia la API, actualiza ambos lados.
   ============================================================ */

/** Alguien con acceso a una tarjeta compartida. */
export interface Miembro {
  // número único que identifica a la persona
  uid: string;
  // nombre de la persona
  nombre: string;
}

/**
 * Una tarjeta lista para mostrar: lo guardado + lo calculado por el backend.
 * Puede ser del usuario o de otra persona que la compartió con él: en ese caso la ve
 * con todas sus compras y suscripciones, y puede registrar gastos y pagar el mes.
 */
export interface TarjetaItem {
  // número único de la tarjeta
  id: string;
  // banco o marca de la tarjeta
  emisor: string;             // id del emisor ("bancoestado", "visa"...), ver constants/banks.ts
  // dice si la tarjeta es del usuario
  propia: boolean;            // true si el usuario es el dueño (puede editarla, eliminarla y compartirla)
  // nombre del dueño si la tarjeta es de otro
  duenoNombre: string | null; // Nombre del dueño si es de otra persona
  // nombres de las personas que también ven la tarjeta
  compartidaCon: string[];    // Nombres de las demás personas que la ven (vacío si no está compartida)
  // personas con quienes el dueño compartió la tarjeta
  miembros: Miembro[];        // Solo para el dueño: con quiénes la compartió
  // título que se muestra en la tarjeta
  nombre: string;             // título que se ve en la tarjeta
  // nombre corto que el usuario le puso
  alias: string;              // nombre interno (obligatorio en Visa y MasterCard)
  // nombre del banco
  banco: string;
  // día del mes en que vence la tarjeta
  diaVencimiento: number;     // Día del mes (1 a 31)
  // texto del vencimiento listo para mostrar
  vencimiento: string;        // "Vence 15 de Octubre (Quedan 3 días)"
  // color de la tarjeta
  colorHex: string;
  // total a pagar este mes, como número
  montoNumerico: number;      // Total a pagar este mes: cuotas + suscripciones pendientes
  // total a pagar este mes, como texto con signo $
  monto: string;              // Mismo total formateado: "$10.000"
  // texto corto de cuántos días quedan o si está atrasada
  estadoVencimiento: string;  // Solo el subtexto: "Quedan 3 días" / "Atrasada..."
  // cupo máximo de la tarjeta
  cupoTotal: number;
  // cupo que todavía se puede usar
  cupoDisponible: number;
  // dice si ya se pagó el mes
  pagadaEsteMes: boolean;
  // Meses anteriores que no se pagaron y lo que suman (ya incluido en montoNumerico)
  mesesAtrasados: number;
  // plata que se debe de meses anteriores
  montoAtrasado: number;
}

/** Una compra en cuotas. */
export interface TransaccionItem {
  // número único de la compra
  id: string;
  // tarjeta con la que se hizo la compra
  tarjetaId: string;
  // qué se compró
  motivo: string;            // "Ropa Ripley"
  // precio total de la compra
  montoTotal: number;
  // cuánto se paga cada mes
  cuotaMensual: number;
  // número de la cuota que toca pagar ahora
  cuotaActual: number;       // Cuota que se está pagando ahora (empieza en 1)
  // cantidad total de cuotas
  totalCuotas: number;
  // mes en que se cobra la primera cuota
  mesInicio: string;         // Mes en que se cobra la cuota 1 ("2026-10")
  // cuánto vale la cuota de ahora
  montoCuotaActual: number;  // Lo que vale la cuota actual (la última puede valer distinto)
  // mes en que se cobra la cuota de ahora
  mesCobro: string;          // Mes en que se cobra la cuota actual (anterior al actual si está atrasada)
  // cuotas que hay que pagar hasta este mes
  cuotasPorPagar: number;    // Cuotas que ya debían pagarse hasta este mes, incluida la de este mes
  // cuotas de meses pasados que no se pagaron
  cuotasAtrasadas: number;   // De ellas, las de meses anteriores
  // plata que suman las cuotas por pagar
  montoPorPagar: number;     // Lo que suman esas cuotas
  // quién registró la compra, si fue otra persona
  autor: string | null;      // Nombre de quien la registró, si no fue el usuario
  // dice si el usuario puede cambiar o borrar la compra
  editable: boolean;         // Puede editarla o eliminarla: la registró él o es dueño de la tarjeta
}

// forma de una suscripción (Netflix, Spotify...)
export interface SuscripcionItem {
  // número único de la suscripción
  id: string;
  // nombre del servicio
  nombre: string;          // "Netflix"
  // plan contratado
  plan: string;            // "Plan Premium"
  // cuánto se cobra cada mes
  monto: number;           // Cobro mensual
  // día del mes en que se cobra
  diaCobro: number;        // Día de vencimiento de la tarjeta asociada
  // fecha del próximo cobro como texto
  proximoCobro: string;    // "15 de Noviembre"
  // días que faltan para el próximo cobro
  diasRestantes: number;
  // texto de cuánto falta para el cobro
  textoRestante: string;   // "Hoy" / "Mañana" / "En 5 días"
  // dice si ya se pagó este mes
  pagadaEsteMes: boolean; // true si no queda nada por pagar hasta este mes
  // cuántos meses quedan por pagar
  mesesPorPagar: number;  // Meses que ya debían pagarse (más de 1 = hay meses atrasados)
  // plata total que falta pagar
  montoPorPagar: number;  // monto × mesesPorPagar
  // primer mes en que se cobra (opcional)
  mesInicio?: string;     // Primer mes que se cobra
  // tarjeta donde se cobra
  tarjetaId: string;
  // banco de esa tarjeta
  tarjetaBanco: string;
  // color de esa tarjeta
  tarjetaColor: string;
  // quién registró la suscripción, si fue otra persona
  autor: string | null;   // Nombre de quien la registró, si no fue el usuario
  // dice si el usuario puede borrarla
  editable: boolean;      // Puede eliminarla: la registró él o es dueño de la tarjeta
}

/** Todo lo que la app necesita para dibujar sus pantallas (GET /api/estado). */
export interface Estado {
  // mes en que estamos
  mesActual: string;                // "2026-10"
  // lista de tarjetas
  tarjetas: TarjetaItem[];
  // lista de compras
  transacciones: TransaccionItem[];
  // lista de suscripciones
  suscripciones: SuscripcionItem[]; // Ordenadas por próximo cobro
  // total a pagar sumando todas las tarjetas
  totalConsolidado: number;
  // total a pagar en suscripciones
  totalSuscripciones: number;
}

/* ---------- Proyecciones (GET /api/proyecciones) ---------- */

// un cobro que vendrá en un mes futuro
export interface CobroProyectado {
  // número único del cobro
  id: string;
  // si es la cuota de una compra o una suscripción
  tipo: 'cuota' | 'suscripcion';
  // nombre de la compra o del servicio
  nombre: string;
  // texto extra, como el número de cuota
  detalle: string;      // "Cuota 3 de 6" / "Plan Premium"
  // cuánto se cobrará
  monto: number;
  // dice si es la última cuota
  ultimaCuota: boolean;
  // dice si es un cobro atrasado
  atrasado: boolean;    // Incluye cobros de meses anteriores sin pagar (solo en el mes actual)
}

// lo que se cobrará en una tarjeta en un mes futuro
export interface TarjetaProyectada {
  // tarjeta a la que pertenecen los cobros
  tarjetaId: string;
  // banco de la tarjeta
  banco: string;
  // color de la tarjeta
  colorHex: string;
  // total que se cobrará en esa tarjeta
  total: number;
  // lista de cobros de esa tarjeta
  cobros: CobroProyectado[];
}

// resumen de lo que se pagará en un mes futuro
export interface MesProyectado {
  // mes al que corresponde
  clave: string;          // "2026-11"
  // total en cuotas de compras
  cuotas: number;
  // total en suscripciones
  suscripciones: number;
  // total del mes
  total: number;
  // deuda que quedará después de ese mes
  deudaRestante: number;  // Lo que queda en cuotas después de pagar ese mes
  // detalle por tarjeta
  tarjetas: TarjetaProyectada[];
}

// lo que se pagará en los próximos meses
export interface Proyeccion {
  // lista de meses futuros
  meses: MesProyectado[];
  // último mes en que todavía quedan cuotas
  ultimoMesConCuotas: string | null;
}

/* ---------- Cuentas (POST /api/auth/...) ---------- */

/** El usuario con sesión iniciada. */
export interface Usuario {
  // número único del usuario
  uid: string;
  // nombre del usuario
  nombre: string;
  // correo del usuario
  email: string;
}

/** Respuesta de registro e ingreso: si salió bien trae el token y el usuario. */
export interface RespuestaSesion {
  // código que dice si se pudo ingresar o registrar
  resultado: Resultado;
  // llave secreta de la sesión, si salió bien
  token?: string;
  // datos del usuario, si salió bien
  usuario?: Usuario;
  // mensaje para mostrar, si algo falló
  mensaje?: string;
}

/* ---------- Acciones ---------- */

/**
 * Resultado de una acción. Los primeros vienen del backend;
 * 'sin_conexion' significa que no se pudo hablar con él.
 */
export type Resultado =
  // salió todo bien
  | 'ok'
  // algún dato escrito está mal
  | 'datos_invalidos'
  // la tarjeta no existe
  | 'sin_tarjeta'
  // no alcanza el cupo de la tarjeta
  | 'sin_cupo'
  // el mes ya estaba pagado
  | 'ya_pagada'
  // lo que se buscó no existe
  | 'no_existe'
  // el correo ya tiene una cuenta
  | 'email_en_uso'           // Registro: ya hay una cuenta con ese correo
  // no hay cuenta con ese correo
  | 'sin_cuenta'             // Ingreso: no hay una cuenta con ese correo
  // la contraseña está mal
  | 'credenciales_invalidas' // Ingreso: la contraseña no es correcta
  // la sesión venció o no hay sesión
  | 'no_autorizado'          // Sin sesión o sesión vencida
  // el usuario no tiene permiso para esto
  | 'sin_permiso'            // La tarjeta es de otra persona: la acción es solo del dueño (o del autor)
  // la compra ya tiene cuotas pagadas
  | 'cuotas_pagadas'         // Cambiar monto o cuotas de una compra que ya pagó alguna cuota
  // no se pudo hablar con el servidor
  | 'sin_conexion';

/** Lo que devuelve una acción a la pantalla. */
export interface ResultadoAccion {
  // código que dice cómo salió la acción
  resultado: Resultado;
  // mensaje para mostrar, si algo falló
  mensaje?: string; // Con 'datos_invalidos': qué campo falló, listo para mostrar
}

// datos para crear una tarjeta nueva
export interface NuevaTarjeta {
  // banco o marca elegida
  emisor: string;  // id del banco elegido
  // título de la tarjeta
  nombre: string;
  // nombre corto que le pone el usuario
  alias: string;   // Puede ir vacío salvo en Visa y MasterCard: el backend usa el nombre del banco
  // nombre del banco
  banco: string;
  // día del mes en que vence
  diaVencimiento: number;
  // color de la tarjeta
  colorHex: string;
  // cupo máximo de la tarjeta
  cupoTotal: number;
}

/** Lo que se puede cambiar de una tarjeta (solo los campos presentes). */
export interface CambiosTarjeta {
  // nombre corto nuevo (opcional)
  alias?: string;
  // cupo nuevo (opcional)
  cupoTotal?: number;
  // día de vencimiento nuevo (opcional)
  diaVencimiento?: number;
}

/** Lo que se puede cambiar de una compra (solo los campos presentes). */
export interface CambiosTransaccion {
  // qué se compró, nuevo (opcional)
  motivo?: string;
  // precio nuevo (opcional)
  monto?: number;
  // cantidad de cuotas nueva (opcional)
  cuotas?: number;
}

// datos para crear una suscripción nueva
export interface NuevaSuscripcion {
  // nombre del servicio
  nombre: string;
  // plan contratado
  plan: string;
  // cuánto se cobra cada mes
  monto: number;
  // tarjeta donde se cobra
  tarjetaId: string;
}
