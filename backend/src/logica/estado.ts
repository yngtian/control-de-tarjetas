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

import type {
  DatosBD,
  Estado,
  SuscripcionBase,
  SuscripcionItem,
  TarjetaBase,
  TarjetaItem,
  TransaccionBase,
  TransaccionItem,
} from '../modelos';
import { montoDeCuota, saldoPendienteTx } from './cuotas';
import {
  calcularEstadoVencimiento,
  calcularProximoCobro,
  claveMes,
  diaEfectivo,
  MESES,
  mesesEntre,
  sumarMeses,
} from './fechas';
import { formatearCLP } from './formato';

/** Quién mira el estado y de quién es cada tarjeta (para las compartidas). */
export interface ContextoUsuario {
  uid: string;                     // El usuario con sesión
  duenoDe: Map<string, string>;    // tarjetaId -> uid del dueño (sin entrada = del usuario)
  nombres: Map<string, string>;    // uid -> nombre, de todas las personas involucradas
}

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
  desde: string;     // Mes del primer cobro pendiente
  meses: number;     // Meses que ya debían pagarse (0 si el primero es futuro)
  monto: number;
  atrasado: number;  // Parte de `monto` que corresponde a meses anteriores al actual
}

export function calcularEstado(
  datos: DatosBD,
  hoy: Date = new Date(),
  contexto: ContextoUsuario = contextoVacio
): Estado {
  const mesActual = claveMes(hoy);
  const tarjetasBase = aLista(datos.tarjetas);
  const transaccionesBase = aLista(datos.transacciones);
  const suscripcionesBase = aLista(datos.suscripciones);
  const tarjetaBasePorId = new Map(tarjetasBase.map((t) => [t.id, t]));

  /* ---------- Quién es quién (tarjetas compartidas) ---------- */

  const duenoDe = (tarjetaId: string) => contexto.duenoDe.get(tarjetaId) ?? contexto.uid;
  const nombreDe = (uid: string) => contexto.nombres.get(uid) ?? 'Otra persona';
  // Quién registró algo: si no se guardó (datos antiguos), el dueño de la tarjeta
  const autorDe = (x: { autorUid?: string; tarjetaId: string }) => x.autorUid ?? duenoDe(x.tarjetaId);
  // Se puede editar o eliminar si lo registró el usuario o si es dueño de la tarjeta
  const esEditable = (x: { autorUid?: string; tarjetaId: string }) =>
    autorDe(x) === contexto.uid || duenoDe(x.tarjetaId) === contexto.uid;
  const autorVisible = (x: { autorUid?: string; tarjetaId: string }) => {
    const autor = autorDe(x);
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
    const tarjeta = tarjetaBasePorId.get(tx.tarjetaId);
    const desde = elMasTardio(tx.mesInicio, tarjeta ? despuesDelUltimoPago(tarjeta) : null);
    const meses = mesesHastaHoy(desde);
    const cuotas = Math.min(meses, tx.totalCuotas - tx.cuotaActual + 1);
    // Las cuotas de meses anteriores al actual son las atrasadas
    const cuotasAtrasadas = Math.min(cuotas, Math.max(meses - 1, 0));
    let monto = 0;
    let atrasado = 0;
    for (let i = 0; i < cuotas; i++) {
      const valor = montoDeCuota(tx, tx.cuotaActual + i);
      monto += valor;
      if (i < cuotasAtrasadas) atrasado += valor;
    }
    return { desde, meses, monto, atrasado, cuotas, cuotasAtrasadas };
  };

  /**
   * Meses de una suscripción que ya debían pagarse: desde su primer mes (o el siguiente
   * a su último pago) hasta el actual. Las antiguas sin mesInicio cuentan desde este mes.
   */
  const porPagarSuscripcion = (s: SuscripcionBase): PorPagar => {
    const despuesDelPago = s.ultimoMesPagado ? sumarMeses(s.ultimoMesPagado, 1) : null;
    const desde = elMasTardio(s.mesInicio ?? despuesDelPago ?? mesActual, despuesDelPago);
    const meses = mesesHastaHoy(desde);
    return { desde, meses, monto: s.monto * meses, atrasado: s.monto * Math.max(meses - 1, 0) };
  };

  const compras = new Map(transaccionesBase.map((tx) => [tx.id, porPagarCompra(tx)]));
  const subs = new Map(suscripcionesBase.map((s) => [s.id, porPagarSuscripcion(s)]));

  /* ---------- Tarjetas ---------- */

  const tarjetas: TarjetaItem[] = tarjetasBase.map((base) => {
    const susCompras = transaccionesBase.filter((tx) => tx.tarjetaId === base.id);
    const susSubs = suscripcionesBase.filter((s) => s.tarjetaId === base.id);
    const pendientes = [
      ...susCompras.map((tx) => compras.get(tx.id)!),
      ...susSubs.map((s) => subs.get(s.id)!),
    ].filter((p) => p.meses > 0);

    const pagadaEsteMes = base.ultimoMesPagado === mesActual;
    const montoMes = pendientes.reduce((acc, p) => acc + p.monto, 0);
    const montoAtrasado = pendientes.reduce((acc, p) => acc + p.atrasado, 0);
    // Saldo pendiente: lo que todavía falta pagar de las compras (incluye las cuotas
    // atrasadas y las que vienen). Es lo que "ocupa" el cupo, junto a las suscripciones.
    // Cada suscripción ocupa lo que debe o, si no debe nada todavía (su primer cobro es el mes
    // siguiente, o ya se pagó este mes), su próximo cobro: igual que una compra, ocupa el cupo
    // desde que se registra.
    const cupoOcupado =
      susCompras.reduce((acc, tx) => acc + saldoPendienteTx(tx), 0) +
      susSubs.reduce((acc, s) => acc + s.monto * Math.max(subs.get(s.id)!.meses, 1), 0);
    // Primer mes con algo pendiente (para contar los meses atrasados)
    const primerPendiente = pendientes.reduce<string | null>((min, p) => (!min || p.desde < min ? p.desde : min), null);
    const mesesAtrasados = montoAtrasado > 0 && primerPendiente ? mesesEntre(primerPendiente, mesActual) : 0;

    let texto: string;
    let subtexto: string;
    if (mesesAtrasados > 0) {
      // Meses anteriores sin pagar: se dice desde cuándo y cuántos son
      const [anio, mes] = primerPendiente!.split('-').map(Number);
      const dia = diaEfectivo(base.diaVencimiento, anio, mes - 1);
      texto = `Vencida desde el ${dia} de ${MESES.at(mes - 1)}`;
      subtexto = `${mesesAtrasados} ${mesesAtrasados === 1 ? 'mes' : 'meses'} sin pagar`;
    } else {
      // "Atrasada" solo si le queda algo por pagar este mes
      ({ texto, subtexto } = calcularEstadoVencimiento(
        base.diaVencimiento,
        { pagada: pagadaEsteMes, hayPagos: montoMes > 0 },
        hoy
      ));
    }

    // Quiénes la ven: el dueño y los miembros; cada uno ve a los demás
    const dueno = duenoDe(base.id);
    const propia = dueno === contexto.uid;
    const miembros = Object.keys(base.miembros ?? {});
    const compartidaCon = [dueno, ...miembros].filter((uid) => uid !== contexto.uid).map(nombreDe);

    const { ultimoMesPagado: _pagado, miembros: _miembros, ...datosGuardados } = base;
    return {
      ...datosGuardados,
      propia,
      duenoNombre: propia ? null : nombreDe(dueno),
      compartidaCon,
      miembros: propia ? miembros.map((uid) => ({ uid, nombre: nombreDe(uid) })) : [],
      pagadaEsteMes,
      montoNumerico: montoMes,
      monto: formatearCLP(montoMes),
      mesesAtrasados,
      montoAtrasado,
      vencimiento: `${texto} (${subtexto})`,
      estadoVencimiento: subtexto,
      cupoDisponible: Math.max(base.cupoTotal - cupoOcupado, 0),
    };
  });

  /* ---------- Compras y suscripciones ---------- */

  const transacciones: TransaccionItem[] = transaccionesBase.map((tx) => {
    const p = compras.get(tx.id)!;
    return {
      ...tx,
      montoCuotaActual: montoDeCuota(tx, tx.cuotaActual),
      mesCobro: p.desde,
      cuotasPorPagar: p.cuotas,
      cuotasAtrasadas: p.cuotasAtrasadas,
      montoPorPagar: p.monto,
      autor: autorVisible(tx),
      editable: esEditable(tx),
    };
  });

  // Suscripciones con próximo cobro calculado, las que cobran antes van primero
  const suscripciones: SuscripcionItem[] = suscripcionesBase
    .map(({ ultimoMesPagado: _pagado, ...s }) => {
      const t = tarjetas.find((x) => x.id === s.tarjetaId);
      const p = subs.get(s.id)!;
      // Se cobra el mismo día en que vence la tarjeta asociada
      const diaCobro = t?.diaVencimiento ?? 1;
      // Sin nada pendiente hasta este mes, el próximo cobro es el del mes siguiente (o su primer mes)
      const pagadaEsteMes = p.meses === 0;
      const c = calcularProximoCobro(diaCobro, pagadaEsteMes, hoy);
      return {
        ...s,
        diaCobro,
        pagadaEsteMes,
        mesesPorPagar: p.meses,
        montoPorPagar: p.monto,
        tarjetaBanco: t?.banco ?? 'Tarjeta no disponible',
        tarjetaColor: t?.colorHex ?? '#94A3B8',
        proximoCobro: c.texto,
        diasRestantes: c.dias,
        textoRestante: c.subtexto,
        autor: autorVisible(s),
        editable: esEditable(s),
      };
    })
    .sort((a, b) => a.diasRestantes - b.diasRestantes);

  return {
    mesActual,
    tarjetas,
    transacciones,
    suscripciones,
    totalConsolidado: tarjetas.reduce((acc, t) => acc + t.montoNumerico, 0),
    totalSuscripciones: suscripciones.reduce((acc, s) => acc + s.monto, 0),
  };
}
