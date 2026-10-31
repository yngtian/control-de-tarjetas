/* ============================================================
   Proyección de pagos de los próximos meses (funciones puras: no dependen de la base de datos)

   Parte del estado de hoy y lo "adelanta" mes a mes:
   - Cada compra cobra su cuota actual en un mes y avanza una cuota por mes
     hasta llegar a la última.
   - Cada suscripción se cobra todos los meses en la tarjeta asociada.
   No se inventan compras nuevas: es lo que ya está comprometido.
   ============================================================ */

// trae la forma de los datos de la app y de una tarjeta
import type { Estado, TarjetaItem } from '../modelos';
// trae las funciones que calculan cuotas y lo que falta pagar
import { montoDeCuota, saldoPendienteTx } from './cuotas';
// trae las funciones para contar y sumar meses
import { mesesEntre, sumarMeses } from './fechas';

/** Un cobro concreto dentro de un mes proyectado. */
export interface CobroProyectado {
  // identificador de la compra o suscripción
  id: string;
  // dice si es una cuota o una suscripción
  tipo: 'cuota' | 'suscripcion';
  // nombre del cobro
  nombre: string;       // "Ropa Ripley" / "Netflix"
  // texto extra con el número de cuota o el plan
  detalle: string;      // "Cuota 3 de 6" / "Plan Premium"
  // cuánto se cobra
  monto: number;
  // dice si es la última cuota de la compra
  ultimaCuota: boolean; // true si con este pago la compra queda saldada
  // dice si trae pagos atrasados
  atrasado: boolean;    // Incluye cobros de meses anteriores sin pagar (solo en el mes actual)
}

/** Lo que se paga en una tarjeta en un mes proyectado. */
export interface TarjetaProyectada {
  // identificador de la tarjeta
  tarjetaId: string;
  // nombre del banco de la tarjeta
  banco: string;
  // color de la tarjeta
  colorHex: string;
  // total a pagar en esa tarjeta ese mes
  total: number;
  // lista de cobros de esa tarjeta
  cobros: CobroProyectado[];
}

// resumen de lo que se paga en un mes futuro
export interface MesProyectado {
  // mes al que corresponde, ej: "2026-11"
  clave: string;          // "2026-11"
  // total de cuotas del mes
  cuotas: number;         // Suma de las cuotas que se cobran ese mes
  // total de suscripciones del mes
  suscripciones: number;  // Suma de las suscripciones de ese mes
  // total a pagar ese mes
  total: number;          // cuotas + suscripciones
  // deuda en cuotas que queda después de ese mes
  deudaRestante: number;  // Lo que queda en cuotas después de pagar ese mes
  // detalle de lo que se paga en cada tarjeta
  tarjetas: TarjetaProyectada[]; // Ordenadas de mayor a menor total
}

// resultado completo de la proyección de pagos
export interface Proyeccion {
  // lista de los meses proyectados
  meses: MesProyectado[];
  // Mes en que se paga la última cuota de todas las compras (puede quedar fuera
  // del horizonte). null si no hay compras en cuotas.
  ultimoMesConCuotas: string | null;
}

/**
 * Proyecta los pagos de los próximos `cantidadMeses` meses, partiendo por el mes actual.
 * El mes actual incluye todo lo que falta pagar hasta hoy, también lo de meses atrasados
 * (una tarjeta ya pagada aporta $0).
 */
export function proyectarMeses(estado: Estado, cantidadMeses: number): Proyeccion {
  // toma el mes actual de los datos
  const { mesActual } = estado;
  // arma una lista para buscar rápido cada tarjeta por su identificador
  const tarjetaPorId = new Map(estado.tarjetas.map((t) => [t.id, t]));

  // Cada compra con su tarjeta y cuántos meses faltan para que se cobre su cuota actual
  const compras = estado.transacciones.flatMap((tx) => {
    // busca la tarjeta de la compra
    const tarjeta = tarjetaPorId.get(tx.tarjetaId);
    // si la tarjeta no existe, deja fuera la compra
    if (!tarjeta) return [];
    // guarda la compra, su tarjeta y cuántos meses faltan para su cobro
    return [{ tx, tarjeta, desfase: mesesEntre(mesActual, tx.mesCobro) }];
  });

  // Deuda en cuotas hoy; se va descontando lo que se paga cada mes
  let deuda = compras.reduce((acc, c) => acc + saldoPendienteTx(c.tx), 0);

  // lista donde se guardan los meses calculados
  const meses: MesProyectado[] = [];
  // repite el cálculo para cada mes pedido
  for (let k = 0; k < cantidadMeses; k++) {
    // agrupa los cobros del mes por tarjeta
    const porTarjeta = new Map<string, TarjetaProyectada>();
    // agrega un cobro al grupo de su tarjeta
    const agregar = (tarjeta: TarjetaItem, cobro: CobroProyectado) => {
      // busca si la tarjeta ya tiene grupo este mes
      let grupo = porTarjeta.get(tarjeta.id);
      // si no tiene grupo, se crea uno vacío
      if (!grupo) {
        // grupo nuevo con los datos de la tarjeta y total en cero
        grupo = { tarjetaId: tarjeta.id, banco: tarjeta.banco, colorHex: tarjeta.colorHex, total: 0, cobros: [] };
        // guarda el grupo nuevo
        porTarjeta.set(tarjeta.id, grupo);
      }
      // suma el cobro a la lista de la tarjeta
      grupo.cobros.push(cobro);
      // suma el monto al total de la tarjeta
      grupo.total += cobro.monto;
    };

    // total de cuotas del mes, parte en cero
    let cuotas = 0;
    // revisa cada compra
    for (const { tx, tarjeta, desfase } of compras) {
      // si es el mes actual
      if (k === 0) {
        // Mes actual: todas las cuotas que ya debían pagarse, atrasadas incluidas
        if (tx.cuotasPorPagar === 0) continue;
        // número de la última cuota que se paga este mes
        const ultima = tx.cuotaActual + tx.cuotasPorPagar - 1;
        // suma lo que falta pagar de esta compra
        cuotas += tx.montoPorPagar;
        // agrega el cobro de la compra a su tarjeta
        agregar(tarjeta, {
          // identificador de la compra
          id: tx.id,
          // es un cobro de cuota
          tipo: 'cuota',
          // nombre de la compra
          nombre: tx.motivo,
          // texto con el número de cuota
          detalle:
            // si se paga una sola cuota
            tx.cuotasPorPagar === 1
              // muestra "Cuota X de Y"
              ? `Cuota ${tx.cuotaActual} de ${tx.totalCuotas}`
              // si son varias, muestra "Cuotas X a Z de Y"
              : `Cuotas ${tx.cuotaActual} a ${ultima} de ${tx.totalCuotas}`,
          // cuánto se paga este mes
          monto: tx.montoPorPagar,
          // dice si con esto se termina de pagar
          ultimaCuota: ultima === tx.totalCuotas,
          // dice si hay cuotas atrasadas
          atrasado: tx.cuotasAtrasadas > 0,
        });
        // pasa a la siguiente compra
        continue;
      }
      // Meses siguientes: la primera cuota que queda después de hoy se cobra en el mes
      // max(desfase, 1) y desde ahí avanza una por mes
      const numero = tx.cuotaActual + tx.cuotasPorPagar + (k - Math.max(desfase, 1));
      // si esa cuota no toca este mes o ya no existe, se salta
      if (numero < tx.cuotaActual + tx.cuotasPorPagar || numero > tx.totalCuotas) continue;
      // La última cuota puede valer distinto: absorbe el redondeo
      const monto = montoDeCuota(tx, numero);
      // suma la cuota al total del mes
      cuotas += monto;
      // agrega la cuota a su tarjeta
      agregar(tarjeta, {
        // identificador de la compra
        id: tx.id,
        // es un cobro de cuota
        tipo: 'cuota',
        // nombre de la compra
        nombre: tx.motivo,
        // texto "Cuota X de Y"
        detalle: `Cuota ${numero} de ${tx.totalCuotas}`,
        // cuánto vale esta cuota
        monto,
        // dice si es la última cuota
        ultimaCuota: numero === tx.totalCuotas,
        // en meses futuros nunca hay atraso
        atrasado: false,
      });
    }

    // Suscripciones: en el mes actual lo que se debe (con meses atrasados); después, una vez por mes
    let totalSuscripciones = 0;
    // clave del mes que se está calculando
    const clave = sumarMeses(mesActual, k);
    // revisa cada suscripción
    for (const s of estado.suscripciones) {
      // busca la tarjeta de la suscripción
      const tarjeta = tarjetaPorId.get(s.tarjetaId);
      // si la tarjeta no existe, se salta
      if (!tarjeta) continue;
      // este mes cobra lo que se debe; los siguientes, el precio normal
      const monto = k === 0 ? s.montoPorPagar : s.monto;
      // Una suscripción nueva puede partir el mes siguiente
      if (monto === 0 || (k > 0 && (s.mesInicio ?? mesActual) > clave)) continue;
      // suma la suscripción al total del mes
      totalSuscripciones += monto;
      // agrega la suscripción a su tarjeta
      agregar(tarjeta, {
        // identificador de la suscripción
        id: s.id,
        // es un cobro de suscripción
        tipo: 'suscripcion',
        // nombre de la suscripción, ej: Netflix
        nombre: s.nombre,
        // texto con el plan y los meses que se deben
        detalle:
          // muestra el plan y, si debe varios meses, cuántos
          (s.plan || 'Suscripción mensual') + (k === 0 && s.mesesPorPagar > 1 ? ` (${s.mesesPorPagar} meses)` : ''),
        // cuánto se cobra
        monto,
        // las suscripciones no tienen última cuota
        ultimaCuota: false,
        // atrasada si este mes se deben varios meses
        atrasado: k === 0 && s.mesesPorPagar > 1,
      });
    }

    // descuenta de la deuda lo pagado en cuotas este mes
    deuda -= cuotas;
    // guarda el resumen del mes
    meses.push({
      // mes al que corresponde
      clave,
      // total de cuotas del mes
      cuotas,
      // total de suscripciones del mes
      suscripciones: totalSuscripciones,
      // total a pagar del mes
      total: cuotas + totalSuscripciones,
      // deuda que queda después del mes
      deudaRestante: deuda,
      // tarjetas ordenadas de la que más paga a la que menos
      tarjetas: [...porTarjeta.values()].sort((a, b) => b.total - a.total),
    });
  }

  // La última cuota de cada compra cae `totalCuotas - cuotaActual` meses después de la actual
  const ultimoDesfase = compras.reduce(
    // se queda con el mes más lejano de todas las compras
    (max, c) => Math.max(max, c.desfase + c.tx.totalCuotas - c.tx.cuotaActual),
    // parte en -1 por si no hay compras
    -1
  );

  // devuelve los meses calculados y el mes de la última cuota
  return {
    // lista de meses
    meses,
    // mes de la última cuota, o nada si no hay compras
    ultimoMesConCuotas: ultimoDesfase >= 0 ? sumarMeses(mesActual, ultimoDesfase) : null,
  };
}
