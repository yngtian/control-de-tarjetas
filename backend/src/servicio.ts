/* ============================================================
   Acciones de la app (reglas de negocio)

   Cada acción lee los datos del usuario, valida contra el estado calculado
   y escribe los cambios en un solo update (atómico).

   Cómo quedan los datos en Firebase: ver almacen.ts.

   Tarjetas compartidas: lo que el usuario ve son sus tarjetas más las que otros
   compartieron con él. Una tarjeta, sus compras y sus suscripciones se guardan
   siempre dentro de la tarjeta, en el usuario dueño, así que cada escritura va
   ahí aunque la haga otra persona.
   Permisos:
   - Cualquiera que vea la tarjeta: registrar compras y suscripciones, y pagar el mes.
   - Quien registró una compra o suscripción (o el dueño): editarla o eliminarla.
   - Solo el dueño: editar o eliminar la tarjeta y elegir con quién se comparte.
   ============================================================ */

import {
  agregarTarjetaGuardada,
  compraAGuardar,
  rutaCompra,
  rutaSuscripcion,
  rutaTarjeta,
  rutaUsuario,
  suscripcionAGuardar,
  tarjetaAGuardar,
  type TarjetaGuardada,
  type UsuarioGuardado,
} from './almacen';
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

export function crearServicio(bd: BaseDeDatos, uid: string) {
  /**
   * Junta lo que ve el usuario: sus tarjetas más las que otros compartieron con él
   * (con sus compras y suscripciones, que viven dentro de la tarjeta, en el dueño).
   */
  const leerEstado = async () => {
    const usuario = ((await bd.leer(rutaUsuario(uid))) ?? {}) as Partial<UsuarioGuardado>;
    const datos: Required<DatosBD> = { tarjetas: {}, transacciones: {}, suscripciones: {} };
    for (const [id, tarjeta] of Object.entries(usuario.tarjetas ?? {})) agregarTarjetaGuardada(datos, id, tarjeta);

    const duenoDe = new Map<string, string>();
    for (const [tarjetaId, dueno] of Object.entries(usuario.tarjetasDeOtros ?? {})) {
      const tarjeta = (await bd.leer(rutaTarjeta(dueno, tarjetaId))) as TarjetaGuardada | null;
      // Si el dueño la eliminó o dejó de compartirla, la referencia ya no vale
      if (!tarjeta?.compartidaCon?.[uid]) continue;
      agregarTarjetaGuardada(datos, tarjetaId, tarjeta);
      duenoDe.set(tarjetaId, dueno);
    }

    // Nombres de todas las personas que aparecen (dueños, miembros y autores)
    const personas = new Set<string>([uid, ...duenoDe.values()]);
    for (const t of Object.values(datos.tarjetas)) Object.keys(t.miembros ?? {}).forEach((m) => personas.add(m));
    for (const x of [...Object.values(datos.transacciones), ...Object.values(datos.suscripciones)]) {
      if (x.autorUid) personas.add(x.autorUid);
    }
    const nombres = new Map<string, string>();
    for (const persona of personas) {
      const nombre = (await bd.leer(`${rutaUsuario(persona)}/nombre`)) as string | null;
      if (nombre) nombres.set(persona, nombre);
    }

    const contexto: ContextoUsuario = { uid, duenoDe, nombres };
    // Dueño de una tarjeta: ahí se guarda todo lo que es de ella
    const duenoDeTarjeta = (tarjetaId: string) => duenoDe.get(tarjetaId) ?? uid;

    return { datos, estado: calcularEstado(datos, new Date(), contexto), duenoDeTarjeta };
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
      await bd.actualizar({ [rutaTarjeta(uid, generarId(nueva.banco))]: tarjetaAGuardar(nueva) });
      return 'ok';
    },

    /** Registra una compra. Se rechaza si la tarjeta no existe o el monto supera el cupo disponible. */
    async registrarTransaccion({ tarjetaId, motivo, monto, cuotas }: NuevaTransaccion): Promise<Resultado> {
      const { estado, duenoDeTarjeta } = await leerEstado();
      const tarjeta = estado.tarjetas.find((t) => t.id === tarjetaId);
      if (!tarjeta) return 'sin_tarjeta';
      if (monto > tarjeta.cupoDisponible) return 'sin_cupo';

      // ¿Desde qué mes se cobra? Si la compra se hace después del día de corte de la tarjeta
      // (o si el mes ya está pagado), la cuota 1 entra en el estado de cuenta del mes siguiente
      const mesInicio = pasoElCorte(tarjeta.diaVencimiento) || tarjeta.pagadaEsteMes
        ? claveMesSiguiente()
        : estado.mesActual;

      const transaccion: TransaccionBase = {
        id: generarId(motivo),
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
      await bd.actualizar({ [rutaCompra(duenoDeTarjeta(tarjetaId), tarjetaId, transaccion.id)]: compraAGuardar(transaccion) });
      return 'ok';
    },

    /**
     * Registra una suscripción. Igual que las compras: si se registra después del corte
     * (o con el mes ya pagado), el primer cobro es el mes siguiente.
     */
    async agregarSuscripcion(nueva: NuevaSuscripcion): Promise<Resultado> {
      const { estado, duenoDeTarjeta } = await leerEstado();
      const tarjeta = estado.tarjetas.find((t) => t.id === nueva.tarjetaId);
      if (!tarjeta) return 'sin_tarjeta';
      if (nueva.monto > tarjeta.cupoDisponible) return 'sin_cupo';

      const suscripcion: SuscripcionBase = {
        id: generarId(nueva.nombre),
        ...nueva,
        mesInicio: pasoElCorte(tarjeta.diaVencimiento) || tarjeta.pagadaEsteMes ? claveMesSiguiente() : estado.mesActual,
        autorUid: uid,
      };
      const dueno = duenoDeTarjeta(nueva.tarjetaId);
      await bd.actualizar({ [rutaSuscripcion(dueno, nueva.tarjetaId, suscripcion.id)]: suscripcionAGuardar(suscripcion) });
      return 'ok';
    },

    /** Elimina una suscripción (deja de contar en el total y libera su cupo). */
    async eliminarSuscripcion(id: string): Promise<Resultado> {
      const { estado, duenoDeTarjeta } = await leerEstado();
      const sub = estado.suscripciones.find((s) => s.id === id);
      if (!sub) return 'no_existe';
      if (!sub.editable) return 'sin_permiso';
      await bd.actualizar({ [rutaSuscripcion(duenoDeTarjeta(sub.tarjetaId), sub.tarjetaId, id)]: null });
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
      const { estado, duenoDeTarjeta } = await leerEstado();
      const tarjeta = estado.tarjetas.find((t) => t.id === tarjetaId);
      if (!tarjeta) return 'no_existe';
      if (tarjeta.pagadaEsteMes) return 'ya_pagada';

      const mes = estado.mesActual;
      const dueno = duenoDeTarjeta(tarjetaId);
      const cambios: Cambios = { [`${rutaTarjeta(dueno, tarjetaId)}/pagadoHasta`]: mes };

      for (const s of estado.suscripciones) {
        if (s.tarjetaId === tarjetaId) cambios[`${rutaSuscripcion(dueno, tarjetaId, s.id)}/pagadoHasta`] = mes;
      }
      for (const tx of estado.transacciones) {
        // Solo avanzan las compras de la tarjeta que ya tienen cuotas por pagar
        if (tx.tarjetaId !== tarjetaId || tx.cuotasPorPagar === 0) continue;
        const siguiente = tx.cuotaActual + tx.cuotasPorPagar;
        const ruta = rutaCompra(dueno, tarjetaId, tx.id);
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

      const ruta = rutaTarjeta(uid, id);
      const escritura: Cambios = {};
      if (cambios.alias !== undefined) {
        // Visa y MasterCard se muestran con su alias: el alias pasa a ser el título.
        // En los demás bancos el alias solo se guarda si es distinto del título.
        const generica = EMISORES_CON_ALIAS.includes(base.emisor);
        if (generica && !cambios.alias) return 'datos_invalidos';
        if (generica) {
          escritura[`${ruta}/banco`] = cambios.alias;
          escritura[`${ruta}/alias`] = null;
        } else {
          escritura[`${ruta}/alias`] = cambios.alias && cambios.alias !== base.banco ? cambios.alias : null;
        }
      }
      if (cambios.cupoTotal !== undefined) {
        // Lo usado no cambia al cambiar el cupo
        const usado = tarjeta.cupoTotal - tarjeta.cupoDisponible;
        if (cambios.cupoTotal < usado) return 'sin_cupo';
        escritura[`${ruta}/cupo`] = cambios.cupoTotal;
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
      const { estado } = await leerEstado();
      const tarjeta = estado.tarjetas.find((t) => t.id === id);
      if (!tarjeta) return 'no_existe';
      if (!tarjeta.propia) return 'sin_permiso';

      // Sus compras y suscripciones están dentro de la tarjeta: se van con ella
      const escritura: Cambios = { [rutaTarjeta(uid, id)]: null };
      for (const miembro of tarjeta.miembros) {
        escritura[`${rutaUsuario(miembro.uid)}/tarjetasDeOtros/${id}`] = null;
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
      const { estado, duenoDeTarjeta } = await leerEstado();
      const tx = estado.transacciones.find((t) => t.id === id);
      if (!tx) return 'no_existe';
      if (!tx.editable) return 'sin_permiso';

      const ruta = rutaCompra(duenoDeTarjeta(tx.tarjetaId), tx.tarjetaId, id);
      const escritura: Cambios = {};
      if (cambios.motivo !== undefined) escritura[`${ruta}/descripcion`] = cambios.motivo;

      const monto = cambios.monto ?? tx.montoTotal;
      const cuotas = cambios.cuotas ?? tx.totalCuotas;
      if (monto !== tx.montoTotal || cuotas !== tx.totalCuotas) {
        if (tx.cuotaActual > 1) return 'cuotas_pagadas';
        // El cupo libre más lo que ya ocupaba esta compra es lo que tiene para crecer
        const tarjeta = estado.tarjetas.find((t) => t.id === tx.tarjetaId);
        if (!tarjeta || monto > tarjeta.cupoDisponible + tx.montoTotal) return 'sin_cupo';
        escritura[`${ruta}/monto`] = monto;
        escritura[`${ruta}/cuotas`] = cuotas;
      }
      if (Object.keys(escritura).length > 0) await bd.actualizar(escritura);
      return 'ok';
    },

    /** Elimina una compra (quien la registró o el dueño): deja de cobrarse y libera el cupo. */
    async eliminarTransaccion(id: string): Promise<Resultado> {
      const { estado, duenoDeTarjeta } = await leerEstado();
      const tx = estado.transacciones.find((t) => t.id === id);
      if (!tx) return 'no_existe';
      if (!tx.editable) return 'sin_permiso';
      await bd.actualizar({ [rutaCompra(duenoDeTarjeta(tx.tarjetaId), tx.tarjetaId, id)]: null });
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

      const otro = (await bd.leer(`correos/${claveDeCorreo(correo)}`)) as string | null;
      if (!otro) return 'no_existe';
      if (otro === uid) return 'datos_invalidos';

      // En la tarjeta se anota también el nombre, para que se lea fácil en Firebase
      const nombre = ((await bd.leer(`${rutaUsuario(otro)}/nombre`)) as string | null) ?? otro;
      await bd.actualizar({
        [`${rutaTarjeta(uid, id)}/compartidaCon/${otro}`]: nombre,
        [`${rutaUsuario(otro)}/tarjetasDeOtros/${id}`]: uid,
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

      const dueno = esElDueno ? uid : ((await bd.leer(`${rutaUsuario(uid)}/tarjetasDeOtros/${id}`)) as string);
      await bd.actualizar({
        [`${rutaTarjeta(dueno, id)}/compartidaCon/${miembroUid}`]: null,
        [`${rutaUsuario(miembroUid)}/tarjetasDeOtros/${id}`]: null,
      });
      return 'ok';
    },
  };
}

export type Servicio = ReturnType<typeof crearServicio>;
