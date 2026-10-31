/* ============================================================
   Acciones de la app (reglas de negocio)

   Cada acción lee los datos del usuario, valida contra el estado calculado
   y escribe los cambios en un solo update (atómico).

   Tarjetas compartidas: lo que el usuario ve son sus tarjetas más las que otros
   compartieron con él. Una tarjeta, sus compras y sus suscripciones se guardan
   siempre en la cuenta del dueño, así que cada escritura va a la rama del dueño
   de la tarjeta, aunque la haga otra persona.
   Permisos:
   - Cualquiera que vea la tarjeta: registrar compras y suscripciones, y pagar el mes.
   - Quien registró una compra o suscripción (o el dueño): editarla o eliminarla.
   - Solo el dueño: editar o eliminar la tarjeta y elegir con quién se comparte.
   ============================================================ */

import { claveDeCorreo } from './auth';
import type { BaseDeDatos, Cambios } from './db';
import { EMISORES_CON_ALIAS } from './limites';
import { calcularCuotaBase } from './logica/cuotas';
import { calcularEstado, type ContextoUsuario } from './logica/estado';
import { claveMesSiguiente, pasoElCorte } from './logica/fechas';
import { generarId } from './logica/id';
import { proyectarMeses } from './logica/proyecciones';
import type { DatosBD, Resultado, SuscripcionBase, TarjetaBase, TransaccionBase } from './modelos';

export type NuevaTarjeta = Omit<TarjetaBase, 'id' | 'ultimoMesPagado' | 'miembros'>;
export type NuevaSuscripcion = Omit<SuscripcionBase, 'id' | 'ultimoMesPagado' | 'mesInicio' | 'autorUid'>;

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

export interface NuevaTransaccion {
  tarjetaId: string;
  motivo: string;
  monto: number;
  cuotas: number;
}

/** Rama de un usuario en la base de datos. */
const rama = (uid: string) => `usuarios/${uid}`;

export function crearServicio(bd: BaseDeDatos, uid: string) {
  /**
   * Junta lo que ve el usuario: sus datos más las tarjetas compartidas con él
   * (con sus compras y suscripciones, que viven en la cuenta del dueño).
   */
  const leerEstado = async () => {
    const propios = ((await bd.leer(rama(uid))) ?? {}) as DatosBD;
    const datos: DatosBD = {
      tarjetas: { ...propios.tarjetas },
      transacciones: { ...propios.transacciones },
      suscripciones: { ...propios.suscripciones },
    };
    const duenoDe = new Map<string, string>();

    // Datos de cada dueño que compartió algo (se leen una vez por dueño)
    const ramasDeDuenos = new Map<string, DatosBD>();
    for (const [tarjetaId, { dueno }] of Object.entries(propios.compartidasConmigo ?? {})) {
      if (!ramasDeDuenos.has(dueno)) ramasDeDuenos.set(dueno, ((await bd.leer(rama(dueno))) ?? {}) as DatosBD);
      const datosDueno = ramasDeDuenos.get(dueno)!;
      const tarjeta = datosDueno.tarjetas?.[tarjetaId];
      // Si el dueño la eliminó o dejó de compartirla, la referencia ya no vale
      if (!tarjeta || !tarjeta.miembros?.[uid]) continue;

      datos.tarjetas![tarjetaId] = tarjeta;
      duenoDe.set(tarjetaId, dueno);
      for (const tx of Object.values(datosDueno.transacciones ?? {})) {
        if (tx.tarjetaId === tarjetaId) datos.transacciones![tx.id] = tx;
      }
      for (const s of Object.values(datosDueno.suscripciones ?? {})) {
        if (s.tarjetaId === tarjetaId) datos.suscripciones![s.id] = s;
      }
    }

    // Nombres de todas las personas que aparecen (dueños, miembros y autores)
    const personas = new Set<string>([uid, ...duenoDe.values()]);
    for (const t of Object.values(datos.tarjetas!)) Object.keys(t.miembros ?? {}).forEach((m) => personas.add(m));
    for (const x of [...Object.values(datos.transacciones!), ...Object.values(datos.suscripciones!)]) {
      if (x.autorUid) personas.add(x.autorUid);
    }
    const nombres = new Map<string, string>();
    for (const persona of personas) {
      const perfil = (await bd.leer(`${rama(persona)}/perfil`)) as { nombre?: string } | null;
      if (perfil?.nombre) nombres.set(persona, perfil.nombre);
    }

    const contexto: ContextoUsuario = { uid, duenoDe, nombres };
    // Ruta donde se guarda algo de una tarjeta: siempre en la rama de su dueño
    const rutaDe = (tarjetaId: string, coleccion: 'tarjetas' | 'transacciones' | 'suscripciones', id: string) =>
      `${rama(duenoDe.get(tarjetaId) ?? uid)}/${coleccion}/${id}`;

    return { datos, estado: calcularEstado(datos, new Date(), contexto), rutaDe };
  };

  return {
    /** Todo lo que la app necesita para dibujar sus pantallas. */
    async estado() {
      return (await leerEstado()).estado;
    },

    /** Pagos proyectados de los próximos `meses` meses. */
    async proyeccion(meses: number) {
      return proyectarMeses((await leerEstado()).estado, meses);
    },

    async agregarTarjeta(nueva: NuevaTarjeta): Promise<Resultado> {
      const tarjeta: TarjetaBase = { id: generarId(), ...nueva };
      await bd.actualizar({ [`${rama(uid)}/tarjetas/${tarjeta.id}`]: tarjeta });
      return 'ok';
    },

    /** Registra una compra. Se rechaza si la tarjeta no existe o el monto supera el cupo disponible. */
    async registrarTransaccion({ tarjetaId, motivo, monto, cuotas }: NuevaTransaccion): Promise<Resultado> {
      const { estado, rutaDe } = await leerEstado();
      const tarjeta = estado.tarjetas.find((t) => t.id === tarjetaId);
      if (!tarjeta) return 'sin_tarjeta';
      if (monto > tarjeta.cupoDisponible) return 'sin_cupo';

      // ¿Desde qué mes se cobra? Si la compra se hace después del día de corte de la tarjeta
      // (o si el mes ya está pagado), la cuota 1 entra en el estado de cuenta del mes siguiente
      const mesInicio = pasoElCorte(tarjeta.diaVencimiento) || tarjeta.pagadaEsteMes
        ? claveMesSiguiente()
        : estado.mesActual;

      const transaccion: TransaccionBase = {
        id: generarId(),
        tarjetaId,
        motivo,
        montoTotal: monto,
        // Cuotas sin decimales: la última absorbe la diferencia
        cuotaMensual: calcularCuotaBase(monto, cuotas),
        cuotaActual: 1, // toda compra parte en la cuota 1
        totalCuotas: cuotas,
        mesInicio,
        autorUid: uid,
      };
      await bd.actualizar({ [rutaDe(tarjetaId, 'transacciones', transaccion.id)]: transaccion });
      return 'ok';
    },

    /**
     * Registra una suscripción. Igual que las compras: si se registra después del corte
     * (o con el mes ya pagado), el primer cobro es el mes siguiente.
     */
    async agregarSuscripcion(nueva: NuevaSuscripcion): Promise<Resultado> {
      const { estado, rutaDe } = await leerEstado();
      const tarjeta = estado.tarjetas.find((t) => t.id === nueva.tarjetaId);
      if (!tarjeta) return 'sin_tarjeta';
      if (nueva.monto > tarjeta.cupoDisponible) return 'sin_cupo';

      const suscripcion: SuscripcionBase = {
        id: generarId(),
        ...nueva,
        mesInicio: pasoElCorte(tarjeta.diaVencimiento) || tarjeta.pagadaEsteMes ? claveMesSiguiente() : estado.mesActual,
        autorUid: uid,
      };
      await bd.actualizar({ [rutaDe(nueva.tarjetaId, 'suscripciones', suscripcion.id)]: suscripcion });
      return 'ok';
    },

    /** Elimina una suscripción (deja de contar en el total y libera su cupo). */
    async eliminarSuscripcion(id: string): Promise<Resultado> {
      const { estado, rutaDe } = await leerEstado();
      const sub = estado.suscripciones.find((s) => s.id === id);
      if (!sub) return 'no_existe';
      if (!sub.editable) return 'sin_permiso';
      await bd.actualizar({ [rutaDe(sub.tarjetaId, 'suscripciones', id)]: null });
      return 'ok';
    },

    /**
     * Registra el pago del mes de una tarjeta (cualquiera que la vea puede hacerlo):
     * - Cada compra avanza las cuotas que debía hasta hoy (una por mes, más las de meses
     *   atrasados); las que terminan se borran.
     * - Las suscripciones quedan pagadas hasta este mes (vuelven el mes siguiente).
     * - La tarjeta queda marcada como pagada este mes: no se puede pagar dos veces.
     */
    async pagarMesTarjeta(tarjetaId: string): Promise<Resultado> {
      const { estado, rutaDe } = await leerEstado();
      const tarjeta = estado.tarjetas.find((t) => t.id === tarjetaId);
      if (!tarjeta) return 'no_existe';
      if (tarjeta.pagadaEsteMes) return 'ya_pagada';

      const mes = estado.mesActual;
      const cambios: Cambios = { [`${rutaDe(tarjetaId, 'tarjetas', tarjetaId)}/ultimoMesPagado`]: mes };

      for (const s of estado.suscripciones) {
        if (s.tarjetaId === tarjetaId) cambios[`${rutaDe(tarjetaId, 'suscripciones', s.id)}/ultimoMesPagado`] = mes;
      }
      for (const tx of estado.transacciones) {
        // Solo avanzan las compras de la tarjeta que ya tienen cuotas por pagar
        if (tx.tarjetaId !== tarjetaId || tx.cuotasPorPagar === 0) continue;
        const siguiente = tx.cuotaActual + tx.cuotasPorPagar;
        const ruta = rutaDe(tarjetaId, 'transacciones', tx.id);
        if (siguiente > tx.totalCuotas) {
          cambios[ruta] = null; // Pagó su última cuota: se borra y libera cupo
        } else {
          cambios[`${ruta}/cuotaActual`] = siguiente;
        }
      }

      await bd.actualizar(cambios);
      return 'ok';
    },

    /**
     * Edita una tarjeta (solo el dueño). El cupo no puede quedar por debajo de lo que ya está usado.
     */
    async editarTarjeta(id: string, cambios: CambiosTarjeta): Promise<Resultado> {
      const { datos, estado } = await leerEstado();
      const base = datos.tarjetas?.[id];
      const tarjeta = estado.tarjetas.find((t) => t.id === id);
      if (!base || !tarjeta) return 'no_existe';
      if (!tarjeta.propia) return 'sin_permiso';

      const ruta = `${rama(uid)}/tarjetas/${id}`;
      const escritura: Cambios = {};
      if (cambios.alias !== undefined) {
        // Visa y MasterCard se muestran con su alias: cambia también el título
        const generica = EMISORES_CON_ALIAS.includes(base.emisor);
        if (generica && !cambios.alias) return 'datos_invalidos';
        const alias = cambios.alias || base.banco;
        escritura[`${ruta}/alias`] = alias;
        if (generica) {
          escritura[`${ruta}/nombre`] = alias;
          escritura[`${ruta}/banco`] = alias;
        }
      }
      if (cambios.cupoTotal !== undefined) {
        // Lo usado no cambia al cambiar el cupo
        const usado = tarjeta.cupoTotal - tarjeta.cupoDisponible;
        if (cambios.cupoTotal < usado) return 'sin_cupo';
        escritura[`${ruta}/cupoTotal`] = cambios.cupoTotal;
      }
      if (cambios.diaVencimiento !== undefined) {
        escritura[`${ruta}/diaVencimiento`] = cambios.diaVencimiento;
      }
      if (Object.keys(escritura).length > 0) await bd.actualizar(escritura);
      return 'ok';
    },

    /**
     * Elimina una tarjeta (solo el dueño) con sus compras y suscripciones, y deja de
     * mostrarse a las personas con quienes estaba compartida.
     */
    async eliminarTarjeta(id: string): Promise<Resultado> {
      const { datos, estado } = await leerEstado();
      const tarjeta = estado.tarjetas.find((t) => t.id === id);
      if (!tarjeta) return 'no_existe';
      if (!tarjeta.propia) return 'sin_permiso';

      const escritura: Cambios = { [`${rama(uid)}/tarjetas/${id}`]: null };
      for (const tx of Object.values(datos.transacciones ?? {})) {
        if (tx.tarjetaId === id) escritura[`${rama(uid)}/transacciones/${tx.id}`] = null;
      }
      for (const sub of Object.values(datos.suscripciones ?? {})) {
        if (sub.tarjetaId === id) escritura[`${rama(uid)}/suscripciones/${sub.id}`] = null;
      }
      for (const miembro of tarjeta.miembros) {
        escritura[`${rama(miembro.uid)}/compartidasConmigo/${id}`] = null;
      }
      await bd.actualizar(escritura);
      return 'ok';
    },

    /**
     * Edita una compra (quien la registró o el dueño de la tarjeta). El motivo siempre se
     * puede cambiar; el monto y las cuotas solo si todavía no se paga ninguna cuota.
     * El monto nuevo tiene que caber en el cupo.
     */
    async editarTransaccion(id: string, cambios: CambiosTransaccion): Promise<Resultado> {
      const { estado, rutaDe } = await leerEstado();
      const tx = estado.transacciones.find((t) => t.id === id);
      if (!tx) return 'no_existe';
      if (!tx.editable) return 'sin_permiso';

      const ruta = rutaDe(tx.tarjetaId, 'transacciones', id);
      const escritura: Cambios = {};
      if (cambios.motivo !== undefined) escritura[`${ruta}/motivo`] = cambios.motivo;

      const monto = cambios.monto ?? tx.montoTotal;
      const cuotas = cambios.cuotas ?? tx.totalCuotas;
      if (monto !== tx.montoTotal || cuotas !== tx.totalCuotas) {
        if (tx.cuotaActual > 1) return 'cuotas_pagadas';
        // El cupo libre más lo que ya ocupaba esta compra es lo que tiene para crecer
        const tarjeta = estado.tarjetas.find((t) => t.id === tx.tarjetaId);
        if (!tarjeta || monto > tarjeta.cupoDisponible + tx.montoTotal) return 'sin_cupo';
        escritura[`${ruta}/montoTotal`] = monto;
        escritura[`${ruta}/totalCuotas`] = cuotas;
        escritura[`${ruta}/cuotaMensual`] = calcularCuotaBase(monto, cuotas);
      }
      if (Object.keys(escritura).length > 0) await bd.actualizar(escritura);
      return 'ok';
    },

    /** Elimina una compra (quien la registró o el dueño): deja de cobrarse y libera el cupo. */
    async eliminarTransaccion(id: string): Promise<Resultado> {
      const { estado, rutaDe } = await leerEstado();
      const tx = estado.transacciones.find((t) => t.id === id);
      if (!tx) return 'no_existe';
      if (!tx.editable) return 'sin_permiso';
      await bd.actualizar({ [rutaDe(tx.tarjetaId, 'transacciones', id)]: null });
      return 'ok';
    },

    /**
     * Comparte una tarjeta propia con otro usuario, identificado por el correo con que entra
     * a la app. Desde ese momento la ve, con sus compras y suscripciones, y puede registrar gastos.
     * 'no_existe' si no hay una cuenta con ese correo; 'datos_invalidos' si es el mismo usuario.
     */
    async compartirTarjeta(id: string, correo: string): Promise<Resultado> {
      const { estado } = await leerEstado();
      const tarjeta = estado.tarjetas.find((t) => t.id === id);
      if (!tarjeta) return 'sin_tarjeta';
      if (!tarjeta.propia) return 'sin_permiso';

      const cuenta = (await bd.leer(`cuentas/${claveDeCorreo(correo)}`)) as { uid: string } | null;
      if (!cuenta) return 'no_existe';
      if (cuenta.uid === uid) return 'datos_invalidos';

      await bd.actualizar({
        [`${rama(uid)}/tarjetas/${id}/miembros/${cuenta.uid}`]: true,
        [`${rama(cuenta.uid)}/compartidasConmigo/${id}`]: { dueno: uid },
      });
      return 'ok';
    },

    /**
     * Deja de compartir una tarjeta con alguien. Lo puede hacer el dueño con cualquier
     * miembro, o un miembro consigo mismo ("dejar de ver" la tarjeta). Lo que esa persona
     * registró en la tarjeta se queda: es parte del estado de cuenta.
     */
    async dejarDeCompartir(id: string, miembroUid: string): Promise<Resultado> {
      const { estado } = await leerEstado();
      const tarjeta = estado.tarjetas.find((t) => t.id === id);
      if (!tarjeta) return 'no_existe';
      const esElDueno = tarjeta.propia;
      if (!esElDueno && miembroUid !== uid) return 'sin_permiso';

      const dueno = esElDueno ? uid : (await bd.leer(`${rama(uid)}/compartidasConmigo/${id}/dueno`)) as string;
      await bd.actualizar({
        [`${rama(dueno)}/tarjetas/${id}/miembros/${miembroUid}`]: null,
        [`${rama(miembroUid)}/compartidasConmigo/${id}`]: null,
      });
      return 'ok';
    },
  };
}

export type Servicio = ReturnType<typeof crearServicio>;
