/* ============================================================
   Cálculo del estado que ve la app (función pura: no toca la base de datos)

   Parte de lo guardado en Firebase y calcula todo lo demás: monto del mes,
   cupo disponible, textos de vencimiento y próximos cobros.

   Meses sin pagar: lo que se debe se cuenta desde el primer mes que la tarjeta
   no pagó hasta el mes actual. Si pasaron dos meses sin registrar el pago, el
   total incluye las cuotas y suscripciones de esos dos meses más las de este.

   Tarjetas compartidas: `datos` trae las tarjetas del usuario y también las que
   otros compartieron con él (con sus compras y suscripciones). El `contexto` dice
   de quién es cada una y los nombres de las personas, para mostrar "Registrada por…".
   ============================================================ */

// trae la forma de los datos guardados y de lo que ve la app
import type {
  // todos los datos guardados en la base de datos
  DatosBD,
  // todo lo que se le envía a la app
  Estado,
  // suscripción tal como se guarda
  SuscripcionBase,
  // suscripción con los datos calculados para la app
  SuscripcionItem,
  // tarjeta tal como se guarda
  TarjetaBase,
  // tarjeta con los datos calculados para la app
  TarjetaItem,
  // compra tal como se guarda
  TransaccionBase,
  // compra con los datos calculados para la app
  TransaccionItem,
} from '../modelos';
// trae las funciones que calculan cuotas y lo que falta pagar
import { montoDeCuota, saldoPendienteTx } from './cuotas';
// trae las funciones de fechas
import {
  // arma el texto de vencimiento de la tarjeta
  calcularEstadoVencimiento,
  // calcula cuándo se cobra una suscripción
  calcularProximoCobro,
  // arma la clave del mes, ej: "2026-10"
  claveMes,
  // ajusta el día de vencimiento a los meses cortos
  diaEfectivo,
  // nombres de los meses
  MESES,
  // cuenta los meses entre dos fechas
  mesesEntre,
  // avanza una cantidad de meses
  sumarMeses,
} from './fechas';
// trae la función que escribe montos como "$10.000"
import { formatearCLP } from './formato';

/** Quién mira el estado y de quién es cada tarjeta (para las compartidas). */
export interface ContextoUsuario {
  // identificador del usuario que está usando la app
  uid: string;                     // El usuario con sesión
  // dice quién es el dueño de cada tarjeta
  duenoDe: Map<string, string>;    // tarjetaId -> uid del dueño (sin entrada = del usuario)
  // nombre de cada persona
  nombres: Map<string, string>;    // uid -> nombre, de todas las personas involucradas
}

// datos vacíos para cuando no se sabe quién mira
const contextoVacio: ContextoUsuario = { uid: '', duenoDe: new Map(), nombres: new Map() };

/** Pasa una colección de Firebase ({ id: item }) a lista, de la más nueva a la más antigua. */
function aLista<T extends { id: string }>(coleccion?: Record<string, T>): T[] {
  // Los id empiezan con la fecha de creación, por eso ordenarlos es ordenar por fecha
  return Object.values(coleccion ?? {}).sort((a, b) => b.id.localeCompare(a.id));
}

/** La más tardía de dos claves de mes ("2026-11" > "2026-10" también como texto). */
const elMasTardio = (a: string, b: string | null) => (b && b > a ? b : a);

/** Lo que se debe de una compra o suscripción hasta el mes actual. */
interface PorPagar {
  // mes desde el que se debe
  desde: string;     // Mes del primer cobro pendiente
  // cuántos meses se deben
  meses: number;     // Meses que ya debían pagarse (0 si el primero es futuro)
  // cuánto se debe en total
  monto: number;
  // cuánto de eso es de meses pasados
  atrasado: number;  // Parte de `monto` que corresponde a meses anteriores al actual
}

// calcula todo lo que ve la app a partir de lo guardado
export function calcularEstado(
  // datos guardados en la base de datos
  datos: DatosBD,
  // fecha de hoy
  hoy: Date = new Date(),
  // quién mira y de quién es cada tarjeta
  contexto: ContextoUsuario = contextoVacio
): Estado {
  // clave del mes actual, ej: "2026-10"
  const mesActual = claveMes(hoy);
  // lista de tarjetas guardadas
  const tarjetasBase = aLista(datos.tarjetas);
  // lista de compras guardadas
  const transaccionesBase = aLista(datos.transacciones);
  // lista de suscripciones guardadas
  const suscripcionesBase = aLista(datos.suscripciones);
  // permite buscar rápido una tarjeta por su identificador
  const tarjetaBasePorId = new Map(tarjetasBase.map((t) => [t.id, t]));

  /* ---------- Quién es quién (tarjetas compartidas) ---------- */

  // dice quién es el dueño de una tarjeta
  const duenoDe = (tarjetaId: string) => contexto.duenoDe.get(tarjetaId) ?? contexto.uid;
  // busca el nombre de una persona
  const nombreDe = (uid: string) => contexto.nombres.get(uid) ?? 'Otra persona';
  // Quién registró algo: si no se guardó (datos antiguos), el dueño de la tarjeta
  const autorDe = (x: { autorUid?: string; tarjetaId: string }) => x.autorUid ?? duenoDe(x.tarjetaId);
  // Se puede editar o eliminar si lo registró el usuario o si es dueño de la tarjeta
  const esEditable = (x: { autorUid?: string; tarjetaId: string }) =>
    // lo registró el usuario o la tarjeta es suya
    autorDe(x) === contexto.uid || duenoDe(x.tarjetaId) === contexto.uid;
  // nombre de quién registró algo, para mostrar "Registrada por…"
  const autorVisible = (x: { autorUid?: string; tarjetaId: string }) => {
    // busca quién lo registró
    const autor = autorDe(x);
    // si fue el mismo usuario no muestra nombre; si no, muestra el nombre
    return autor === contexto.uid ? null : nombreDe(autor);
  };

  /* ---------- Lo que se debe hasta hoy ---------- */

  // Primer mes que la tarjeta no ha pagado (null si nunca ha pagado)
  const despuesDelUltimoPago = (t: TarjetaBase) => (t.ultimoMesPagado ? sumarMeses(t.ultimoMesPagado, 1) : null);
  // Meses ya vencidos (incluido el actual) desde `desde`
  const mesesHastaHoy = (desde: string) => (desde <= mesActual ? mesesEntre(desde, mesActual) + 1 : 0);

  /**
   * Cuotas de una compra que ya debían pagarse. La cuota actual se cobra en su mesInicio,
   * o en el mes siguiente al último pago de la tarjeta si es más tarde; cada mes que pasó
   * desde entonces suma la cuota que seguía (sin pasar de la última).
   */
  const porPagarCompra = (tx: TransaccionBase): PorPagar & { cuotas: number; cuotasAtrasadas: number } => {
    // busca la tarjeta de la compra
    const tarjeta = tarjetaBasePorId.get(tx.tarjetaId);
    // mes desde el que se debe esta compra
    const desde = elMasTardio(tx.mesInicio, tarjeta ? despuesDelUltimoPago(tarjeta) : null);
    // cuántos meses se deben hasta hoy
    const meses = mesesHastaHoy(desde);
    // cuotas que se deben, sin pasar de las que quedan
    const cuotas = Math.min(meses, tx.totalCuotas - tx.cuotaActual + 1);
    // Las cuotas de meses anteriores al actual son las atrasadas
    const cuotasAtrasadas = Math.min(cuotas, Math.max(meses - 1, 0));
    // total que se debe, parte en cero
    let monto = 0;
    // total atrasado, parte en cero
    let atrasado = 0;
    // recorre cada cuota que se debe
    for (let i = 0; i < cuotas; i++) {
      // cuánto vale esta cuota
      const valor = montoDeCuota(tx, tx.cuotaActual + i);
      // la suma al total que se debe
      monto += valor;
      // si es de un mes pasado, la suma a lo atrasado
      if (i < cuotasAtrasadas) atrasado += valor;
    }
    // devuelve todo lo calculado de la compra
    return { desde, meses, monto, atrasado, cuotas, cuotasAtrasadas };
  };

  /**
   * Meses de una suscripción que ya debían pagarse: desde su primer mes (o el siguiente
   * a su último pago) hasta el actual. Las antiguas sin mesInicio cuentan desde este mes.
   */
  const porPagarSuscripcion = (s: SuscripcionBase): PorPagar => {
    // mes siguiente al último pago, si alguna vez se pagó
    const despuesDelPago = s.ultimoMesPagado ? sumarMeses(s.ultimoMesPagado, 1) : null;
    // mes desde el que se debe esta suscripción
    const desde = elMasTardio(s.mesInicio ?? despuesDelPago ?? mesActual, despuesDelPago);
    // cuántos meses se deben hasta hoy
    const meses = mesesHastaHoy(desde);
    // devuelve lo que se debe y la parte atrasada
    return { desde, meses, monto: s.monto * meses, atrasado: s.monto * Math.max(meses - 1, 0) };
  };

  // calcula lo que se debe de cada compra
  const compras = new Map(transaccionesBase.map((tx) => [tx.id, porPagarCompra(tx)]));
  // calcula lo que se debe de cada suscripción
  const subs = new Map(suscripcionesBase.map((s) => [s.id, porPagarSuscripcion(s)]));

  /* ---------- Tarjetas ---------- */

  // arma los datos de cada tarjeta para la app
  const tarjetas: TarjetaItem[] = tarjetasBase.map((base) => {
    // compras hechas con esta tarjeta
    const susCompras = transaccionesBase.filter((tx) => tx.tarjetaId === base.id);
    // suscripciones cobradas en esta tarjeta
    const susSubs = suscripcionesBase.filter((s) => s.tarjetaId === base.id);
    // junta todo lo que tiene algo por pagar
    const pendientes = [
      // lo que se debe de cada compra
      ...susCompras.map((tx) => compras.get(tx.id)!),
      // lo que se debe de cada suscripción
      ...susSubs.map((s) => subs.get(s.id)!),
      // deja solo lo que de verdad se debe
    ].filter((p) => p.meses > 0);

    // dice si la tarjeta ya se pagó este mes
    const pagadaEsteMes = base.ultimoMesPagado === mesActual;
    // suma todo lo que se debe pagar
    const montoMes = pendientes.reduce((acc, p) => acc + p.monto, 0);
    // suma lo que viene de meses pasados
    const montoAtrasado = pendientes.reduce((acc, p) => acc + p.atrasado, 0);
    // Saldo pendiente: lo que todavía falta pagar de las compras (incluye las cuotas
    // atrasadas y las que vienen). Es lo que "ocupa" el cupo, junto a las suscripciones.
    // Cada suscripción ocupa lo que debe o, si no debe nada todavía (su primer cobro es el mes
    // siguiente, o ya se pagó este mes), su próximo cobro: igual que una compra, ocupa el cupo
    // desde que se registra.
    const cupoOcupado =
      // lo que falta pagar de las compras
      susCompras.reduce((acc, tx) => acc + saldoPendienteTx(tx), 0) +
      // más lo que ocupan las suscripciones
      susSubs.reduce((acc, s) => acc + s.monto * Math.max(subs.get(s.id)!.meses, 1), 0);
    // Primer mes con algo pendiente (para contar los meses atrasados)
    const primerPendiente = pendientes.reduce<string | null>((min, p) => (!min || p.desde < min ? p.desde : min), null);
    // cuántos meses lleva sin pagar la tarjeta
    const mesesAtrasados = montoAtrasado > 0 && primerPendiente ? mesesEntre(primerPendiente, mesActual) : 0;

    // texto con la fecha de vencimiento
    let texto: string;
    // texto con el estado del pago
    let subtexto: string;
    // si hay meses sin pagar
    if (mesesAtrasados > 0) {
      // Meses anteriores sin pagar: se dice desde cuándo y cuántos son
      const [anio, mes] = primerPendiente!.split('-').map(Number);
      // día en que venció ese primer mes sin pagar
      const dia = diaEfectivo(base.diaVencimiento, anio, mes - 1);
      // texto "Vencida desde el ..."
      texto = `Vencida desde el ${dia} de ${MESES.at(mes - 1)}`;
      // texto con cuántos meses van sin pagar
      subtexto = `${mesesAtrasados} ${mesesAtrasados === 1 ? 'mes' : 'meses'} sin pagar`;
      // si no hay meses atrasados
    } else {
      // "Atrasada" solo si le queda algo por pagar este mes
      ({ texto, subtexto } = calcularEstadoVencimiento(
        // día de vencimiento de la tarjeta
        base.diaVencimiento,
        // si ya se pagó y si hay algo por pagar
        { pagada: pagadaEsteMes, hayPagos: montoMes > 0 },
        // fecha de hoy
        hoy
      ));
    }

    // Quiénes la ven: el dueño y los miembros; cada uno ve a los demás
    const dueno = duenoDe(base.id);
    // dice si la tarjeta es del usuario
    const propia = dueno === contexto.uid;
    // lista de personas con las que se compartió la tarjeta
    const miembros = Object.keys(base.miembros ?? {});
    // nombres de las otras personas que ven la tarjeta
    const compartidaCon = [dueno, ...miembros].filter((uid) => uid !== contexto.uid).map(nombreDe);

    // quita datos internos que la app no necesita
    const { ultimoMesPagado: _pagado, miembros: _miembros, ...datosGuardados } = base;
    // devuelve la tarjeta con todo lo calculado
    return {
      // datos guardados de la tarjeta
      ...datosGuardados,
      // si la tarjeta es del usuario
      propia,
      // nombre del dueño si es de otra persona
      duenoNombre: propia ? null : nombreDe(dueno),
      // nombres de las personas con quien se comparte
      compartidaCon,
      // si es suya, lista de miembros con su nombre
      miembros: propia ? miembros.map((uid) => ({ uid, nombre: nombreDe(uid) })) : [],
      // si ya se pagó este mes
      pagadaEsteMes,
      // monto del mes como número
      montoNumerico: montoMes,
      // monto del mes escrito como "$10.000"
      monto: formatearCLP(montoMes),
      // cuántos meses lleva sin pagar
      mesesAtrasados,
      // cuánto se debe de meses pasados
      montoAtrasado,
      // texto completo del vencimiento
      vencimiento: `${texto} (${subtexto})`,
      // texto corto del estado del pago
      estadoVencimiento: subtexto,
      // cupo que queda libre, nunca menor a cero
      cupoDisponible: Math.max(base.cupoTotal - cupoOcupado, 0),
    };
  });

  /* ---------- Compras y suscripciones ---------- */

  // arma los datos de cada compra para la app
  const transacciones: TransaccionItem[] = transaccionesBase.map((tx) => {
    // lo que se debe de esta compra
    const p = compras.get(tx.id)!;
    // devuelve la compra con todo lo calculado
    return {
      // datos guardados de la compra
      ...tx,
      // cuánto vale la cuota actual
      montoCuotaActual: montoDeCuota(tx, tx.cuotaActual),
      // mes en que se cobra la cuota
      mesCobro: p.desde,
      // cuántas cuotas se deben
      cuotasPorPagar: p.cuotas,
      // cuántas cuotas están atrasadas
      cuotasAtrasadas: p.cuotasAtrasadas,
      // cuánto se debe pagar de esta compra
      montoPorPagar: p.monto,
      // nombre de quién la registró, si fue otra persona
      autor: autorVisible(tx),
      // si el usuario puede editarla o borrarla
      editable: esEditable(tx),
    };
  });

  // Suscripciones con próximo cobro calculado, las que cobran antes van primero
  const suscripciones: SuscripcionItem[] = suscripcionesBase
    // arma los datos de cada suscripción, sin el último mes pagado
    .map(({ ultimoMesPagado: _pagado, ...s }) => {
      // busca la tarjeta de la suscripción
      const t = tarjetas.find((x) => x.id === s.tarjetaId);
      // lo que se debe de esta suscripción
      const p = subs.get(s.id)!;
      // Se cobra el mismo día en que vence la tarjeta asociada
      const diaCobro = t?.diaVencimiento ?? 1;
      // Sin nada pendiente hasta este mes, el próximo cobro es el del mes siguiente (o su primer mes)
      const pagadaEsteMes = p.meses === 0;
      // calcula la fecha del próximo cobro
      const c = calcularProximoCobro(diaCobro, pagadaEsteMes, hoy);
      // devuelve la suscripción con todo lo calculado
      return {
        // datos guardados de la suscripción
        ...s,
        // día del mes en que se cobra
        diaCobro,
        // si ya se pagó este mes
        pagadaEsteMes,
        // cuántos meses se deben
        mesesPorPagar: p.meses,
        // cuánto se debe pagar
        montoPorPagar: p.monto,
        // banco de la tarjeta, o un aviso si no existe
        tarjetaBanco: t?.banco ?? 'Tarjeta no disponible',
        // color de la tarjeta, o gris si no existe
        tarjetaColor: t?.colorHex ?? '#94A3B8',
        // fecha del próximo cobro en texto
        proximoCobro: c.texto,
        // días que faltan para el cobro
        diasRestantes: c.dias,
        // texto como "Hoy", "Mañana" o "En 5 días"
        textoRestante: c.subtexto,
        // nombre de quién la registró, si fue otra persona
        autor: autorVisible(s),
        // si el usuario puede editarla o borrarla
        editable: esEditable(s),
      };
    })
    // ordena: las que se cobran antes van primero
    .sort((a, b) => a.diasRestantes - b.diasRestantes);

  // devuelve todo lo que la app necesita mostrar
  return {
    // mes actual
    mesActual,
    // lista de tarjetas
    tarjetas,
    // lista de compras
    transacciones,
    // lista de suscripciones
    suscripciones,
    // suma de lo que hay que pagar en todas las tarjetas
    totalConsolidado: tarjetas.reduce((acc, t) => acc + t.montoNumerico, 0),
    // suma del precio de todas las suscripciones
    totalSuscripciones: suscripciones.reduce((acc, s) => acc + s.monto, 0),
  };
}
