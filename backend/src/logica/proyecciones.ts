/* ============================================================
   Proyección de pagos de los próximos meses (funciones puras: no dependen de la base de datos)

   Parte del estado de hoy y lo "adelanta" mes a mes:
   - Cada compra cobra su cuota actual en un mes y avanza una cuota por mes
     hasta llegar a la última.
   - Cada suscripción se cobra todos los meses en la tarjeta asociada.
   No se inventan compras nuevas: es lo que ya está comprometido.
   ============================================================ */

import type { Estado, TarjetaItem } from '../modelos';
import { montoDeCuota, saldoPendienteTx } from './cuotas';
import { mesesEntre, sumarMeses } from './fechas';

/** Un cobro concreto dentro de un mes proyectado. */
export interface CobroProyectado {
  id: string;
  tipo: 'cuota' | 'suscripcion';
  nombre: string;       // "Ropa Ripley" / "Netflix"
  detalle: string;      // "Cuota 3 de 6" / "Plan Premium"
  monto: number;
  ultimaCuota: boolean; // true si con este pago la compra queda saldada
  atrasado: boolean;    // Incluye cobros de meses anteriores sin pagar (solo en el mes actual)
}

/** Lo que se paga en una tarjeta en un mes proyectado. */
export interface TarjetaProyectada {
  tarjetaId: string;
  banco: string;
  colorHex: string;
  total: number;
  cobros: CobroProyectado[];
}

export interface MesProyectado {
  clave: string;          // "2026-11"
  cuotas: number;         // Suma de las cuotas que se cobran ese mes
  suscripciones: number;  // Suma de las suscripciones de ese mes
  total: number;          // cuotas + suscripciones
  deudaRestante: number;  // Lo que queda en cuotas después de pagar ese mes
  tarjetas: TarjetaProyectada[]; // Ordenadas de mayor a menor total
}

export interface Proyeccion {
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
  const { mesActual } = estado;
  const tarjetaPorId = new Map(estado.tarjetas.map((t) => [t.id, t]));

  // Cada compra con su tarjeta y cuántos meses faltan para que se cobre su cuota actual
  const compras = estado.transacciones.flatMap((tx) => {
    const tarjeta = tarjetaPorId.get(tx.tarjetaId);
    if (!tarjeta) return [];
    return [{ tx, tarjeta, desfase: mesesEntre(mesActual, tx.mesCobro) }];
  });

  // Deuda en cuotas hoy; se va descontando lo que se paga cada mes
  let deuda = compras.reduce((acc, c) => acc + saldoPendienteTx(c.tx), 0);

  const meses: MesProyectado[] = [];
  for (let k = 0; k < cantidadMeses; k++) {
    const porTarjeta = new Map<string, TarjetaProyectada>();
    const agregar = (tarjeta: TarjetaItem, cobro: CobroProyectado) => {
      let grupo = porTarjeta.get(tarjeta.id);
      if (!grupo) {
        grupo = { tarjetaId: tarjeta.id, banco: tarjeta.banco, colorHex: tarjeta.colorHex, total: 0, cobros: [] };
        porTarjeta.set(tarjeta.id, grupo);
      }
      grupo.cobros.push(cobro);
      grupo.total += cobro.monto;
    };

    let cuotas = 0;
    for (const { tx, tarjeta, desfase } of compras) {
      if (k === 0) {
        // Mes actual: todas las cuotas que ya debían pagarse, atrasadas incluidas
        if (tx.cuotasPorPagar === 0) continue;
        const ultima = tx.cuotaActual + tx.cuotasPorPagar - 1;
        cuotas += tx.montoPorPagar;
        agregar(tarjeta, {
          id: tx.id,
          tipo: 'cuota',
          nombre: tx.motivo,
          detalle:
            tx.cuotasPorPagar === 1
              ? `Cuota ${tx.cuotaActual} de ${tx.totalCuotas}`
              : `Cuotas ${tx.cuotaActual} a ${ultima} de ${tx.totalCuotas}`,
          monto: tx.montoPorPagar,
          ultimaCuota: ultima === tx.totalCuotas,
          atrasado: tx.cuotasAtrasadas > 0,
        });
        continue;
      }
      // Meses siguientes: la primera cuota que queda después de hoy se cobra en el mes
      // max(desfase, 1) y desde ahí avanza una por mes
      const numero = tx.cuotaActual + tx.cuotasPorPagar + (k - Math.max(desfase, 1));
      if (numero < tx.cuotaActual + tx.cuotasPorPagar || numero > tx.totalCuotas) continue;
      // La última cuota puede valer distinto: absorbe el redondeo
      const monto = montoDeCuota(tx, numero);
      cuotas += monto;
      agregar(tarjeta, {
        id: tx.id,
        tipo: 'cuota',
        nombre: tx.motivo,
        detalle: `Cuota ${numero} de ${tx.totalCuotas}`,
        monto,
        ultimaCuota: numero === tx.totalCuotas,
        atrasado: false,
      });
    }

    // Suscripciones: en el mes actual lo que se debe (con meses atrasados); después, una vez por mes
    let totalSuscripciones = 0;
    const clave = sumarMeses(mesActual, k);
    for (const s of estado.suscripciones) {
      const tarjeta = tarjetaPorId.get(s.tarjetaId);
      if (!tarjeta) continue;
      const monto = k === 0 ? s.montoPorPagar : s.monto;
      // Una suscripción nueva puede partir el mes siguiente
      if (monto === 0 || (k > 0 && (s.mesInicio ?? mesActual) > clave)) continue;
      totalSuscripciones += monto;
      agregar(tarjeta, {
        id: s.id,
        tipo: 'suscripcion',
        nombre: s.nombre,
        detalle:
          (s.plan || 'Suscripción mensual') + (k === 0 && s.mesesPorPagar > 1 ? ` (${s.mesesPorPagar} meses)` : ''),
        monto,
        ultimaCuota: false,
        atrasado: k === 0 && s.mesesPorPagar > 1,
      });
    }

    deuda -= cuotas;
    meses.push({
      clave,
      cuotas,
      suscripciones: totalSuscripciones,
      total: cuotas + totalSuscripciones,
      deudaRestante: deuda,
      tarjetas: [...porTarjeta.values()].sort((a, b) => b.total - a.total),
    });
  }

  // La última cuota de cada compra cae `totalCuotas - cuotaActual` meses después de la actual
  const ultimoDesfase = compras.reduce(
    (max, c) => Math.max(max, c.desfase + c.tx.totalCuotas - c.tx.cuotaActual),
    -1
  );

  return {
    meses,
    ultimoMesConCuotas: ultimoDesfase >= 0 ? sumarMeses(mesActual, ultimoDesfase) : null,
  };
}
