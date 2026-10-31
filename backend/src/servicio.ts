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

// trae las funciones para leer y guardar datos en Firebase
import {
  // agrega una tarjeta guardada (con sus compras y suscripciones) a los datos
  agregarTarjetaGuardada,
  // prepara una compra para guardarla
  compraAGuardar,
  // dice dónde se guarda una compra
  rutaCompra,
  // dice dónde se guarda una suscripción
  rutaSuscripcion,
  // dice dónde se guarda una tarjeta
  rutaTarjeta,
  // dice dónde se guardan los datos de un usuario
  rutaUsuario,
  // prepara una suscripción para guardarla
  suscripcionAGuardar,
  // prepara una tarjeta para guardarla
  tarjetaAGuardar,
  // forma de una tarjeta tal como está guardada
  type TarjetaGuardada,
  // forma de los datos de un usuario tal como están guardados
  type UsuarioGuardado,
} from './almacen';
// trae la función que convierte un correo en clave para buscarlo
import { claveDeCorreo } from './auth';
// trae la forma de la base de datos y de los cambios a guardar
import type { BaseDeDatos, Cambios } from './db';
// trae la lista de tarjetas que se muestran con su alias (Visa, MasterCard)
import { EMISORES_CON_ALIAS } from './limites';
// trae la función que calcula el valor de cada cuota
import { calcularCuotaBase } from './logica/cuotas';
// trae la función que calcula todo lo que ve la app
import { calcularEstado, type ContextoUsuario } from './logica/estado';
// trae funciones para saber el mes siguiente y si pasó el corte
import { claveMesSiguiente, pasoElCorte } from './logica/fechas';
// trae la función que crea identificadores
import { generarId } from './logica/id';
// trae la función que calcula los pagos de los próximos meses
import { proyectarMeses } from './logica/proyecciones';
// trae la forma de los datos de la app
import type { DatosBD, Resultado, SuscripcionBase, TarjetaBase, TransaccionBase } from './modelos';

// datos que se piden para crear una tarjeta nueva
export type NuevaTarjeta = Omit<TarjetaBase, 'id' | 'ultimoMesPagado' | 'miembros'>;
// datos que se piden para crear una suscripción nueva
export type NuevaSuscripcion = Omit<SuscripcionBase, 'id' | 'ultimoMesPagado' | 'mesInicio' | 'autorUid'>;

/** Lo que se puede cambiar de una tarjeta (solo los campos presentes). */
export interface CambiosTarjeta {
  // nombre corto de la tarjeta
  alias?: string;
  // cupo total de la tarjeta
  cupoTotal?: number;
  // día del mes en que vence la tarjeta
  diaVencimiento?: number;
}

/** Lo que se puede cambiar de una compra (solo los campos presentes). */
export interface CambiosTransaccion {
  // qué se compró
  motivo?: string;
  // cuánto costó
  monto?: number;
  // en cuántas cuotas se paga
  cuotas?: number;
}

// datos que se piden para registrar una compra
export interface NuevaTransaccion {
  // tarjeta con la que se hizo la compra
  tarjetaId: string;
  // qué se compró
  motivo: string;
  // cuánto costó
  monto: number;
  // en cuántas cuotas se paga
  cuotas: number;
}

// crea todas las acciones de la app para un usuario
export function crearServicio(bd: BaseDeDatos, uid: string) {
  /**
   * Junta lo que ve el usuario: sus tarjetas más las que otros compartieron con él
   * (con sus compras y suscripciones, que viven dentro de la tarjeta, en el dueño).
   */
  const leerEstado = async () => {
    // lee los datos guardados del usuario (o nada si es nuevo)
    const usuario = ((await bd.leer(rutaUsuario(uid))) ?? {}) as Partial<UsuarioGuardado>;
    // listas vacías donde se juntan tarjetas, compras y suscripciones
    const datos: Required<DatosBD> = { tarjetas: {}, transacciones: {}, suscripciones: {} };
    // agrega cada tarjeta propia del usuario
    for (const [id, tarjeta] of Object.entries(usuario.tarjetas ?? {})) agregarTarjetaGuardada(datos, id, tarjeta);

    // anota quién es el dueño de cada tarjeta compartida
    const duenoDe = new Map<string, string>();
    // revisa cada tarjeta que otros compartieron con el usuario
    for (const [tarjetaId, dueno] of Object.entries(usuario.tarjetasDeOtros ?? {})) {
      // lee la tarjeta desde los datos del dueño
      const tarjeta = (await bd.leer(rutaTarjeta(dueno, tarjetaId))) as TarjetaGuardada | null;
      // Si el dueño la eliminó o dejó de compartirla, la referencia ya no vale
      if (!tarjeta?.compartidaCon?.[uid]) continue;
      // agrega la tarjeta compartida a los datos
      agregarTarjetaGuardada(datos, tarjetaId, tarjeta);
      // anota quién es su dueño
      duenoDe.set(tarjetaId, dueno);
    }

    // Nombres de todas las personas que aparecen (dueños, miembros y autores)
    const personas = new Set<string>([uid, ...duenoDe.values()]);
    // suma a las personas con quienes se comparte cada tarjeta
    for (const t of Object.values(datos.tarjetas)) Object.keys(t.miembros ?? {}).forEach((m) => personas.add(m));
    // revisa cada compra y suscripción
    for (const x of [...Object.values(datos.transacciones), ...Object.values(datos.suscripciones)]) {
      // suma a la persona que la registró
      if (x.autorUid) personas.add(x.autorUid);
    }
    // aquí se guarda el nombre de cada persona
    const nombres = new Map<string, string>();
    // busca el nombre de cada persona
    for (const persona of personas) {
      // lee el nombre guardado de la persona
      const nombre = (await bd.leer(`${rutaUsuario(persona)}/nombre`)) as string | null;
      // si tiene nombre, lo guarda
      if (nombre) nombres.set(persona, nombre);
    }

    // junta quién mira, los dueños y los nombres
    const contexto: ContextoUsuario = { uid, duenoDe, nombres };
    // Dueño de una tarjeta: ahí se guarda todo lo que es de ella
    const duenoDeTarjeta = (tarjetaId: string) => duenoDe.get(tarjetaId) ?? uid;

    // devuelve los datos, lo que ve la app y cómo saber el dueño
    return { datos, estado: calcularEstado(datos, new Date(), contexto), duenoDeTarjeta };
  };

  // lista de acciones que puede usar la app
  return {
    /** Todo lo que la app necesita para dibujar sus pantallas. */
    async estado() {
      // calcula y devuelve lo que ve la app
      return (await leerEstado()).estado;
    },

    /** Pagos proyectados de los próximos `meses` meses. */
    async proyeccion(meses: number) {
      // calcula los pagos de los próximos meses
      return proyectarMeses((await leerEstado()).estado, meses);
    },

    // crea una tarjeta nueva
    async agregarTarjeta(nueva: NuevaTarjeta): Promise<Resultado> {
      // guarda la tarjeta nueva con un identificador según su banco
      await bd.actualizar({ [rutaTarjeta(uid, generarId(nueva.banco))]: tarjetaAGuardar(nueva) });
      // avisa que salió bien
      return 'ok';
    },

    /** Registra una compra. Se rechaza si la tarjeta no existe o el monto supera el cupo disponible. */
    async registrarTransaccion({ tarjetaId, motivo, monto, cuotas }: NuevaTransaccion): Promise<Resultado> {
      // lee los datos actuales del usuario
      const { estado, duenoDeTarjeta } = await leerEstado();
      // busca la tarjeta elegida
      const tarjeta = estado.tarjetas.find((t) => t.id === tarjetaId);
      // si la tarjeta no existe, avisa
      if (!tarjeta) return 'sin_tarjeta';
      // si la compra no cabe en el cupo, avisa
      if (monto > tarjeta.cupoDisponible) return 'sin_cupo';

      // ¿Desde qué mes se cobra? Si la compra se hace después del día de corte de la tarjeta
      // (o si el mes ya está pagado), la cuota 1 entra en el estado de cuenta del mes siguiente
      const mesInicio = pasoElCorte(tarjeta.diaVencimiento) || tarjeta.pagadaEsteMes
        // en ese caso se cobra desde el mes siguiente
        ? claveMesSiguiente()
        // si no, se cobra desde este mes
        : estado.mesActual;

      // arma los datos de la compra nueva
      const transaccion: TransaccionBase = {
        // identificador según lo que se compró
        id: generarId(motivo),
        // tarjeta con la que se compró
        tarjetaId,
        // qué se compró
        motivo,
        // cuánto costó en total
        montoTotal: monto,
        // Cuotas sin decimales: la última absorbe la diferencia
        cuotaMensual: calcularCuotaBase(monto, cuotas),
        // la compra empieza en la cuota 1
        cuotaActual: 1, // toda compra parte en la cuota 1
        // cuántas cuotas tiene en total
        totalCuotas: cuotas,
        // mes en que se cobra la primera cuota
        mesInicio,
        // quién registró la compra
        autorUid: uid,
      };
      // guarda la compra dentro de la tarjeta, en los datos del dueño
      await bd.actualizar({ [rutaCompra(duenoDeTarjeta(tarjetaId), tarjetaId, transaccion.id)]: compraAGuardar(transaccion) });
      // avisa que salió bien
      return 'ok';
    },

    /**
     * Registra una suscripción. Igual que las compras: si se registra después del corte
     * (o con el mes ya pagado), el primer cobro es el mes siguiente.
     */
    async agregarSuscripcion(nueva: NuevaSuscripcion): Promise<Resultado> {
      // lee los datos actuales del usuario
      const { estado, duenoDeTarjeta } = await leerEstado();
      // busca la tarjeta elegida
      const tarjeta = estado.tarjetas.find((t) => t.id === nueva.tarjetaId);
      // si la tarjeta no existe, avisa
      if (!tarjeta) return 'sin_tarjeta';
      // si la suscripción no cabe en el cupo, avisa
      if (nueva.monto > tarjeta.cupoDisponible) return 'sin_cupo';

      // arma los datos de la suscripción nueva
      const suscripcion: SuscripcionBase = {
        // identificador según el nombre, ej: "netflix-k3f9"
        id: generarId(nueva.nombre),
        // copia los datos que escribió el usuario
        ...nueva,
        // si ya pasó el corte o está pagada, parte el mes siguiente
        mesInicio: pasoElCorte(tarjeta.diaVencimiento) || tarjeta.pagadaEsteMes ? claveMesSiguiente() : estado.mesActual,
        // quién registró la suscripción
        autorUid: uid,
      };
      // dueño de la tarjeta, donde se guarda la suscripción
      const dueno = duenoDeTarjeta(nueva.tarjetaId);
      // guarda la suscripción dentro de la tarjeta
      await bd.actualizar({ [rutaSuscripcion(dueno, nueva.tarjetaId, suscripcion.id)]: suscripcionAGuardar(suscripcion) });
      // avisa que salió bien
      return 'ok';
    },

    /** Elimina una suscripción (deja de contar en el total y libera su cupo). */
    async eliminarSuscripcion(id: string): Promise<Resultado> {
      // lee los datos actuales del usuario
      const { estado, duenoDeTarjeta } = await leerEstado();
      // busca la suscripción a eliminar
      const sub = estado.suscripciones.find((s) => s.id === id);
      // si no existe, avisa
      if (!sub) return 'no_existe';
      // si el usuario no puede borrarla, avisa
      if (!sub.editable) return 'sin_permiso';
      // borra la suscripción de la base de datos
      await bd.actualizar({ [rutaSuscripcion(duenoDeTarjeta(sub.tarjetaId), sub.tarjetaId, id)]: null });
      // avisa que salió bien
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
      // lee los datos actuales del usuario
      const { estado, duenoDeTarjeta } = await leerEstado();
      // busca la tarjeta a pagar
      const tarjeta = estado.tarjetas.find((t) => t.id === tarjetaId);
      // si la tarjeta no existe, avisa
      if (!tarjeta) return 'no_existe';
      // si ya se pagó este mes, no deja pagar otra vez
      if (tarjeta.pagadaEsteMes) return 'ya_pagada';

      // mes que se está pagando
      const mes = estado.mesActual;
      // dueño de la tarjeta, donde están guardados sus datos
      const dueno = duenoDeTarjeta(tarjetaId);
      // marca la tarjeta como pagada hasta este mes
      const cambios: Cambios = { [`${rutaTarjeta(dueno, tarjetaId)}/pagadoHasta`]: mes };

      // revisa cada suscripción
      for (const s of estado.suscripciones) {
        // si es de esta tarjeta, la marca como pagada hasta este mes
        if (s.tarjetaId === tarjetaId) cambios[`${rutaSuscripcion(dueno, tarjetaId, s.id)}/pagadoHasta`] = mes;
      }
      // revisa cada compra
      for (const tx of estado.transacciones) {
        // Solo avanzan las compras de la tarjeta que ya tienen cuotas por pagar
        if (tx.tarjetaId !== tarjetaId || tx.cuotasPorPagar === 0) continue;
        // número de la próxima cuota después de pagar
        const siguiente = tx.cuotaActual + tx.cuotasPorPagar;
        // dónde está guardada la compra
        const ruta = rutaCompra(dueno, tarjetaId, tx.id);
        // si ya no quedan cuotas
        if (siguiente > tx.totalCuotas) {
          // borra la compra porque ya está pagada
          cambios[ruta] = null; // Pagó su última cuota: se borra y libera cupo
          // si todavía quedan cuotas
        } else {
          // avanza la compra a la próxima cuota
          cambios[`${ruta}/cuotaActual`] = siguiente;
        }
      }

      // guarda todos los cambios de una vez
      await bd.actualizar(cambios);
      // avisa que salió bien
      return 'ok';
    },

    /**
     * Edita una tarjeta (solo el dueño). El cupo no puede quedar por debajo de lo que ya está usado.
     */
    async editarTarjeta(id: string, cambios: CambiosTarjeta): Promise<Resultado> {
      // lee los datos guardados y lo que ve la app
      const { datos, estado } = await leerEstado();
      // tarjeta tal como está guardada
      const base = datos.tarjetas?.[id];
      // tarjeta con los datos calculados
      const tarjeta = estado.tarjetas.find((t) => t.id === id);
      // si la tarjeta no existe, avisa
      if (!base || !tarjeta) return 'no_existe';
      // si el usuario no es el dueño, no lo deja editar
      if (!tarjeta.propia) return 'sin_permiso';

      // dónde está guardada la tarjeta
      const ruta = rutaTarjeta(uid, id);
      // aquí se juntan los cambios a guardar
      const escritura: Cambios = {};
      // si se quiere cambiar el alias
      if (cambios.alias !== undefined) {
        // Visa y MasterCard se muestran con su alias: el alias pasa a ser el título.
        // En los demás bancos el alias solo se guarda si es distinto del título.
        const generica = EMISORES_CON_ALIAS.includes(base.emisor);
        // Visa o MasterCard no pueden quedar sin nombre
        if (generica && !cambios.alias) return 'datos_invalidos';
        // si es Visa o MasterCard
        if (generica) {
          // el alias pasa a ser el nombre de la tarjeta
          escritura[`${ruta}/banco`] = cambios.alias;
          // y se borra el alias aparte
          escritura[`${ruta}/alias`] = null;
          // si es otro banco
        } else {
          // guarda el alias solo si es distinto del nombre del banco
          escritura[`${ruta}/alias`] = cambios.alias && cambios.alias !== base.banco ? cambios.alias : null;
        }
      }
      // si se quiere cambiar el cupo
      if (cambios.cupoTotal !== undefined) {
        // Lo usado no cambia al cambiar el cupo
        const usado = tarjeta.cupoTotal - tarjeta.cupoDisponible;
        // el cupo nuevo no puede ser menor a lo ya usado
        if (cambios.cupoTotal < usado) return 'sin_cupo';
        // guarda el cupo nuevo
        escritura[`${ruta}/cupo`] = cambios.cupoTotal;
      }
      // si se quiere cambiar el día de vencimiento
      if (cambios.diaVencimiento !== undefined) {
        // guarda el día de vencimiento nuevo
        escritura[`${ruta}/diaVencimiento`] = cambios.diaVencimiento;
      }
      // si hay algo que cambiar, lo guarda
      if (Object.keys(escritura).length > 0) await bd.actualizar(escritura);
      // avisa que salió bien
      return 'ok';
    },

    /**
     * Elimina una tarjeta (solo el dueño) con sus compras y suscripciones, y deja de
     * mostrarse a las personas con quienes estaba compartida.
     */
    async eliminarTarjeta(id: string): Promise<Resultado> {
      // lee los datos actuales del usuario
      const { estado } = await leerEstado();
      // busca la tarjeta a eliminar
      const tarjeta = estado.tarjetas.find((t) => t.id === id);
      // si la tarjeta no existe, avisa
      if (!tarjeta) return 'no_existe';
      // si el usuario no es el dueño, no lo deja eliminar
      if (!tarjeta.propia) return 'sin_permiso';

      // Sus compras y suscripciones están dentro de la tarjeta: se van con ella
      const escritura: Cambios = { [rutaTarjeta(uid, id)]: null };
      // revisa cada persona con quien se compartía
      for (const miembro of tarjeta.miembros) {
        // quita la tarjeta de la lista de esa persona
        escritura[`${rutaUsuario(miembro.uid)}/tarjetasDeOtros/${id}`] = null;
      }
      // guarda los cambios (borra todo)
      await bd.actualizar(escritura);
      // avisa que salió bien
      return 'ok';
    },

    /**
     * Edita una compra (quien la registró o el dueño de la tarjeta). El motivo siempre se
     * puede cambiar; el monto y las cuotas solo si todavía no se paga ninguna cuota.
     * El monto nuevo tiene que caber en el cupo.
     */
    async editarTransaccion(id: string, cambios: CambiosTransaccion): Promise<Resultado> {
      // lee los datos actuales del usuario
      const { estado, duenoDeTarjeta } = await leerEstado();
      // busca la compra a editar
      const tx = estado.transacciones.find((t) => t.id === id);
      // si la compra no existe, avisa
      if (!tx) return 'no_existe';
      // si el usuario no puede editarla, avisa
      if (!tx.editable) return 'sin_permiso';

      // dónde está guardada la compra
      const ruta = rutaCompra(duenoDeTarjeta(tx.tarjetaId), tx.tarjetaId, id);
      // aquí se juntan los cambios a guardar
      const escritura: Cambios = {};
      // si cambió lo que se compró, lo guarda
      if (cambios.motivo !== undefined) escritura[`${ruta}/descripcion`] = cambios.motivo;

      // monto nuevo, o el de antes si no cambió
      const monto = cambios.monto ?? tx.montoTotal;
      // cuotas nuevas, o las de antes si no cambiaron
      const cuotas = cambios.cuotas ?? tx.totalCuotas;
      // si cambió el monto o las cuotas
      if (monto !== tx.montoTotal || cuotas !== tx.totalCuotas) {
        // si ya se pagó alguna cuota, no se puede cambiar
        if (tx.cuotaActual > 1) return 'cuotas_pagadas';
        // El cupo libre más lo que ya ocupaba esta compra es lo que tiene para crecer
        const tarjeta = estado.tarjetas.find((t) => t.id === tx.tarjetaId);
        // si el monto nuevo no cabe en el cupo, avisa
        if (!tarjeta || monto > tarjeta.cupoDisponible + tx.montoTotal) return 'sin_cupo';
        // guarda el monto nuevo
        escritura[`${ruta}/monto`] = monto;
        // guarda las cuotas nuevas
        escritura[`${ruta}/cuotas`] = cuotas;
      }
      // si hay algo que cambiar, lo guarda
      if (Object.keys(escritura).length > 0) await bd.actualizar(escritura);
      // avisa que salió bien
      return 'ok';
    },

    /** Elimina una compra (quien la registró o el dueño): deja de cobrarse y libera el cupo. */
    async eliminarTransaccion(id: string): Promise<Resultado> {
      // lee los datos actuales del usuario
      const { estado, duenoDeTarjeta } = await leerEstado();
      // busca la compra a eliminar
      const tx = estado.transacciones.find((t) => t.id === id);
      // si la compra no existe, avisa
      if (!tx) return 'no_existe';
      // si el usuario no puede borrarla, avisa
      if (!tx.editable) return 'sin_permiso';
      // borra la compra de la base de datos
      await bd.actualizar({ [rutaCompra(duenoDeTarjeta(tx.tarjetaId), tx.tarjetaId, id)]: null });
      // avisa que salió bien
      return 'ok';
    },

    /**
     * Comparte una tarjeta propia con otro usuario, identificado por el correo con que entra
     * a la app. Desde ese momento la ve, con sus compras y suscripciones, y puede registrar gastos.
     * 'no_existe' si no hay una cuenta con ese correo; 'datos_invalidos' si es el mismo usuario.
     */
    async compartirTarjeta(id: string, correo: string): Promise<Resultado> {
      // lee los datos actuales del usuario
      const { estado } = await leerEstado();
      // busca la tarjeta a compartir
      const tarjeta = estado.tarjetas.find((t) => t.id === id);
      // si la tarjeta no existe, avisa
      if (!tarjeta) return 'sin_tarjeta';
      // si el usuario no es el dueño, no la puede compartir
      if (!tarjeta.propia) return 'sin_permiso';

      // busca la cuenta de la otra persona por su correo
      const otro = (await bd.leer(`correos/${claveDeCorreo(correo)}`)) as string | null;
      // si no hay cuenta con ese correo, avisa
      if (!otro) return 'no_existe';
      // no se puede compartir con uno mismo
      if (otro === uid) return 'datos_invalidos';

      // En la tarjeta se anota también el nombre, para que se lea fácil en Firebase
      const nombre = ((await bd.leer(`${rutaUsuario(otro)}/nombre`)) as string | null) ?? otro;
      // guarda que la tarjeta queda compartida
      await bd.actualizar({
        // anota a la otra persona dentro de la tarjeta
        [`${rutaTarjeta(uid, id)}/compartidaCon/${otro}`]: nombre,
        // anota la tarjeta en la lista de la otra persona
        [`${rutaUsuario(otro)}/tarjetasDeOtros/${id}`]: uid,
      });
      // avisa que salió bien
      return 'ok';
    },

    /**
     * Deja de compartir una tarjeta con alguien. Lo puede hacer el dueño con cualquier
     * miembro, o un miembro consigo mismo ("dejar de ver" la tarjeta). Lo que esa persona
     * registró en la tarjeta se queda: es parte del estado de cuenta.
     */
    async dejarDeCompartir(id: string, miembroUid: string): Promise<Resultado> {
      // lee los datos actuales del usuario
      const { estado } = await leerEstado();
      // busca la tarjeta
      const tarjeta = estado.tarjetas.find((t) => t.id === id);
      // si la tarjeta no existe, avisa
      if (!tarjeta) return 'no_existe';
      // dice si el usuario es el dueño de la tarjeta
      const esElDueno = tarjeta.propia;
      // si no es el dueño, solo puede quitarse a sí mismo
      if (!esElDueno && miembroUid !== uid) return 'sin_permiso';

      // busca quién es el dueño de la tarjeta
      const dueno = esElDueno ? uid : ((await bd.leer(`${rutaUsuario(uid)}/tarjetasDeOtros/${id}`)) as string);
      // guarda que la tarjeta ya no se comparte con esa persona
      await bd.actualizar({
        // quita a la persona de la tarjeta
        [`${rutaTarjeta(dueno, id)}/compartidaCon/${miembroUid}`]: null,
        // quita la tarjeta de la lista de esa persona
        [`${rutaUsuario(miembroUid)}/tarjetasDeOtros/${id}`]: null,
      });
      // avisa que salió bien
      return 'ok';
    },
  };
}

// forma de la lista de acciones que crea crearServicio
export type Servicio = ReturnType<typeof crearServicio>;
