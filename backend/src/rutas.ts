/* ============================================================
   Rutas de la API

   GET    /api/estado                  estado completo para dibujar la app
   GET    /api/proyecciones?meses=6    pagos proyectados (1 a 24 meses)
   POST   /api/tarjetas                nueva tarjeta
   POST   /api/tarjetas/:id/compartir  compartir la tarjeta con otro usuario (por su correo)
   DELETE /api/tarjetas/:id/miembros/:uid  dejar de compartirla (el dueño, o el propio miembro)
   PATCH  /api/tarjetas/:id            editar alias, cupo o día de vencimiento
   DELETE /api/tarjetas/:id            eliminar tarjeta (con sus compras y suscripciones)
   POST   /api/tarjetas/:id/pagar      registrar el pago del mes
   POST   /api/transacciones           nueva compra en cuotas
   PATCH  /api/transacciones/:id       editar motivo, monto o cuotas
   DELETE /api/transacciones/:id       eliminar compra
   POST   /api/suscripciones           nueva suscripción
   DELETE /api/suscripciones/:id       eliminar suscripción

   Todas exigen sesión (Authorization: Bearer <token>, ver rutasAuth.ts) y
   trabajan solo con los datos de ese usuario.

   Las acciones responden { resultado, estado }: si salió bien, la app
   reemplaza su estado por el nuevo sin tener que volver a pedirlo.
   Si los datos no son válidos responden 400 con { resultado, mensaje },
   donde el mensaje explica qué campo falló (la app lo muestra tal cual).
   ============================================================ */

// trae las herramientas de Express para armar direcciones y responder
import { Router, type Response } from 'express';
// trae la lista de bancos válidos y los topes de los datos
import { EMISORES, EMISORES_CON_ALIAS, LIMITES } from './limites';
// trae el tipo de los resultados posibles de una acción
import type { Resultado } from './modelos';
// trae el tipo de la base de datos
import type { BaseDeDatos } from './db';
// trae las acciones sobre tarjetas, compras y suscripciones
import { crearServicio } from './servicio';
// trae las funciones que revisan los datos que llegan
import { primerError, textoLimpio, validarEntero, validarTexto } from './validacion';

// el número de respuesta que se manda para cada resultado
const CODIGO_HTTP: Record<Resultado, number> = {
  // todo salió bien
  ok: 200,
  // los datos enviados están mal
  datos_invalidos: 400,
  // no se encontró la tarjeta
  sin_tarjeta: 404,
  // no se encontró lo que se buscaba
  no_existe: 404,
  // la tarjeta no tiene cupo suficiente
  sin_cupo: 409,
  // la tarjeta ya se pagó este mes
  ya_pagada: 409,
  // el usuario no tiene permiso para hacer eso
  sin_permiso: 403,
  // la compra ya tiene cuotas pagadas y no se puede cambiar
  cuotas_pagadas: 409,
};

// arma todas las direcciones de tarjetas, compras y suscripciones
export function crearRutas(bd: BaseDeDatos) {
  // crea el grupo de direcciones
  const rutas = Router();

  /** Las acciones del usuario con sesión iniciada (requiereSesion dejó su id): solo ve y cambia sus datos. */
  const servicio = (res: Response) => crearServicio(bd, res.locals.uid);

  /** Responde el resultado de una acción; si salió bien, incluye el estado actualizado. */
  const responder = async (res: Response, resultado: Resultado) => {
    // si algo salió mal
    if (resultado !== 'ok') {
      // responde con el error correspondiente
      res.status(CODIGO_HTTP[resultado]).json({ resultado });
      // termina aquí
      return;
    }
    // si salió bien, manda todos los datos actualizados a la app
    res.json({ resultado, estado: await servicio(res).estado() });
  };

  /** Responde 400 explicando qué dato no es válido. */
  const rechazar = (res: Response, mensaje: string) => {
    // manda el aviso de error a la app
    res.status(CODIGO_HTTP.datos_invalidos).json({ resultado: 'datos_invalidos', mensaje });
  };

  // dirección que entrega todos los datos para dibujar la app
  rutas.get('/estado', async (_req, res) => {
    // manda tarjetas, compras y suscripciones del usuario
    res.json(await servicio(res).estado());
  });

  // dirección que calcula cuánto se pagará en los próximos meses
  rutas.get('/proyecciones', async (req, res) => {
    // cuántos meses pidió ver la app (6 si no dice)
    const meses = Number(req.query.meses ?? 6);
    // revisa que la cantidad de meses esté permitida
    const error = validarEntero(meses, 'La cantidad de meses', 1, LIMITES.mesesProyeccionMax);
    // si hay un error, lo avisa y no sigue
    if (error) return rechazar(res, error);
    // manda los pagos calculados mes a mes
    res.json(await servicio(res).proyeccion(meses));
  });

  // dirección para agregar una tarjeta nueva
  rutas.post('/tarjetas', async (req, res) => {
    // saca los datos de la tarjeta que mandó la app
    const { emisor, nombre, alias, banco, diaVencimiento, colorHex, cupoTotal } = req.body ?? {};
    // busca el primer error en los datos
    const error = primerError(
      // revisa que el banco elegido esté en la lista
      typeof emisor === 'string' && EMISORES.includes(emisor) ? null : 'El emisor de la tarjeta no es válido.',
      // revisa el nombre de la tarjeta
      validarTexto(nombre, 'El nombre', LIMITES.nombreMax),
      // revisa el nombre del banco
      validarTexto(banco, 'El banco', LIMITES.nombreMax),
      // revisa el apodo (puede no venir)
      validarTexto(alias, 'El alias', LIMITES.aliasMax, true),
      // Visa y MasterCard son genéricas: el alias es lo único que las distingue
      EMISORES_CON_ALIAS.includes(emisor) && textoLimpio(alias) === ''
        // si falta el apodo, avisa que es necesario
        ? 'Las tarjetas Visa y MasterCard necesitan un alias.'
        // si no, no hay error
        : null,
      // revisa que el color de la tarjeta sea válido
      typeof colorHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(colorHex) ? null : 'El color no es válido.',
      // revisa que el día de vencimiento esté entre 1 y 31
      validarEntero(diaVencimiento, 'El día de vencimiento', 1, 31),
      // revisa que el cupo sea un monto válido
      validarEntero(cupoTotal, 'El cupo', 1, LIMITES.montoMax)
    );
    // si hay un error, lo avisa y no sigue
    if (error) return rechazar(res, error);

    // guarda la tarjeta y responde con el resultado
    await responder(
      // la respuesta que se mandará a la app
      res,
      // guarda la tarjeta nueva
      await servicio(res).agregarTarjeta({
        // banco elegido de la lista
        emisor,
        // título de la tarjeta sin espacios sobrantes
        nombre: nombre.trim(),
        // Sin alias (solo posible en bancos con nombre propio) se usa el nombre del banco
        alias: textoLimpio(alias) || banco.trim(),
        // nombre del banco sin espacios sobrantes
        banco: banco.trim(),
        // día en que vence la tarjeta
        diaVencimiento,
        // aquí se guarda el color de la tarjeta
        colorHex,
        // cuánto dinero permite gastar
        cupoTotal,
      })
    );
  });

  // dirección para compartir una tarjeta con otra persona
  rutas.post('/tarjetas/:id/compartir', async (req, res) => {
    // saca el correo de la otra persona
    const { email } = req.body ?? {};
    // revisa que el correo venga escrito y no sea muy largo
    const error = validarTexto(email, 'El correo', LIMITES.emailMax);
    // si hay un error, lo avisa y no sigue
    if (error) return rechazar(res, error);

    // intenta compartir la tarjeta con esa persona
    const resultado = await servicio(res).compartirTarjeta(req.params.id, email.trim());
    // si no hay cuenta con ese correo
    if (resultado === 'no_existe') {
      // avisa que la otra persona debe crear su cuenta primero
      res.status(404).json({ resultado, mensaje: 'No hay ninguna cuenta con ese correo. La otra persona tiene que crear su cuenta primero.' });
      // termina aquí
      return;
    }
    // si escribió su propio correo, avisa que use el de la otra persona
    if (resultado === 'datos_invalidos') return rechazar(res, 'Esa es tu propia cuenta: escribe el correo de la otra persona.');
    // responde con el resultado
    await responder(res, resultado);
  });

  // dirección para dejar de compartir una tarjeta con alguien
  rutas.delete('/tarjetas/:id/miembros/:uid', async (req, res) => {
    // quita a esa persona de la tarjeta y responde
    await responder(res, await servicio(res).dejarDeCompartir(req.params.id, req.params.uid));
  });

  // dirección para editar una tarjeta
  rutas.patch('/tarjetas/:id', async (req, res) => {
    // saca el apodo, el cupo y el día de vencimiento que mandó la app
    const { alias, cupoTotal, diaVencimiento } = req.body ?? {};
    // si no mandó ningún cambio
    if (alias === undefined && cupoTotal === undefined && diaVencimiento === undefined) {
      // avisa que no hay nada que cambiar
      return rechazar(res, 'No hay nada que cambiar.');
    }
    // busca el primer error en los datos
    const error = primerError(
      // revisa el apodo (puede no venir)
      validarTexto(alias, 'El alias', LIMITES.aliasMax, true),
      // revisa el cupo, solo si vino
      cupoTotal === undefined ? null : validarEntero(cupoTotal, 'El cupo', 1, LIMITES.montoMax),
      // revisa el día de vencimiento, solo si vino
      diaVencimiento === undefined ? null : validarEntero(diaVencimiento, 'El día de vencimiento', 1, 31)
    );
    // si hay un error, lo avisa y no sigue
    if (error) return rechazar(res, error);

    // guarda los cambios de la tarjeta
    const resultado = await servicio(res).editarTarjeta(req.params.id, {
      // el apodo nuevo sin espacios sobrantes (si vino)
      alias: alias === undefined ? undefined : textoLimpio(alias),
      // el cupo nuevo
      cupoTotal,
      // el día de vencimiento nuevo
      diaVencimiento,
    });
    // si quiso dejar sin apodo una Visa o MasterCard
    if (resultado === 'datos_invalidos') {
      // avisa que esas tarjetas necesitan apodo
      return rechazar(
        // la respuesta que se mandará a la app
        res,
        // el mensaje que verá el usuario
        'Las tarjetas Visa y MasterCard necesitan un alias.'
      );
    }
    // responde con el resultado
    await responder(res, resultado);
  });

  // dirección para eliminar una tarjeta
  rutas.delete('/tarjetas/:id', async (req, res) => {
    // borra la tarjeta con sus compras y suscripciones, y responde
    await responder(res, await servicio(res).eliminarTarjeta(req.params.id));
  });

  // dirección para marcar la tarjeta como pagada este mes
  rutas.post('/tarjetas/:id/pagar', async (req, res) => {
    // registra el pago del mes y responde
    await responder(res, await servicio(res).pagarMesTarjeta(req.params.id));
  });

  // dirección para registrar una compra nueva
  rutas.post('/transacciones', async (req, res) => {
    // saca la tarjeta, el motivo, el monto y las cuotas que mandó la app
    const { tarjetaId, motivo, monto, cuotas } = req.body ?? {};
    // busca el primer error en los datos
    const error = primerError(
      // revisa que venga la tarjeta
      validarTexto(tarjetaId, 'La tarjeta', 64),
      // revisa el motivo de la compra
      validarTexto(motivo, 'El motivo', LIMITES.motivoMax),
      // revisa que el monto sea válido
      validarEntero(monto, 'El monto', 1, LIMITES.montoMax),
      // revisa que la cantidad de cuotas sea válida
      validarEntero(cuotas, 'La cantidad de cuotas', 1, LIMITES.cuotasMax)
    );
    // si hay un error, lo avisa y no sigue
    if (error) return rechazar(res, error);

    // guarda la compra nueva y responde
    await responder(res, await servicio(res).registrarTransaccion({ tarjetaId, motivo: motivo.trim(), monto, cuotas }));
  });

  // dirección para editar una compra
  rutas.patch('/transacciones/:id', async (req, res) => {
    // saca el motivo, el monto y las cuotas que mandó la app
    const { motivo, monto, cuotas } = req.body ?? {};
    // si no mandó ningún cambio
    if (motivo === undefined && monto === undefined && cuotas === undefined) {
      // avisa que no hay nada que cambiar
      return rechazar(res, 'No hay nada que cambiar.');
    }
    // busca el primer error en los datos
    const error = primerError(
      // revisa el motivo, solo si vino
      motivo === undefined ? null : validarTexto(motivo, 'El motivo', LIMITES.motivoMax),
      // revisa el monto, solo si vino
      monto === undefined ? null : validarEntero(monto, 'El monto', 1, LIMITES.montoMax),
      // revisa las cuotas, solo si vinieron
      cuotas === undefined ? null : validarEntero(cuotas, 'La cantidad de cuotas', 1, LIMITES.cuotasMax)
    );
    // si hay un error, lo avisa y no sigue
    if (error) return rechazar(res, error);

    // guarda los cambios y responde con el resultado
    await responder(
      // la respuesta que se mandará a la app
      res,
      // guarda los cambios de la compra
      await servicio(res).editarTransaccion(req.params.id, {
        // el motivo nuevo sin espacios sobrantes (si vino)
        motivo: motivo === undefined ? undefined : motivo.trim(),
        // el monto nuevo
        monto,
        // la cantidad de cuotas nueva
        cuotas,
      })
    );
  });

  // dirección para eliminar una compra
  rutas.delete('/transacciones/:id', async (req, res) => {
    // borra la compra y responde
    await responder(res, await servicio(res).eliminarTransaccion(req.params.id));
  });

  // dirección para agregar una suscripción nueva
  rutas.post('/suscripciones', async (req, res) => {
    // saca el nombre, el plan, el monto y la tarjeta que mandó la app
    const { nombre, plan, monto, tarjetaId } = req.body ?? {};
    // busca el primer error en los datos
    const error = primerError(
      // revisa que venga la tarjeta
      validarTexto(tarjetaId, 'La tarjeta', 64),
      // revisa el nombre del servicio
      validarTexto(nombre, 'El nombre del servicio', LIMITES.nombreMax),
      // revisa el plan (puede no venir)
      validarTexto(plan, 'El plan', LIMITES.planMax, true),
      // revisa que el monto mensual sea válido
      validarEntero(monto, 'El monto mensual', 1, LIMITES.montoMax)
    );
    // si hay un error, lo avisa y no sigue
    if (error) return rechazar(res, error);

    // guarda la suscripción y responde con el resultado
    await responder(
      // la respuesta que se mandará a la app
      res,
      // guarda la suscripción nueva
      await servicio(res).agregarSuscripcion({ nombre: nombre.trim(), plan: textoLimpio(plan), monto, tarjetaId })
    );
  });

  // dirección para eliminar una suscripción
  rutas.delete('/suscripciones/:id', async (req, res) => {
    // borra la suscripción y responde
    await responder(res, await servicio(res).eliminarSuscripcion(req.params.id));
  });

  // entrega el grupo de direcciones listo
  return rutas;
}
