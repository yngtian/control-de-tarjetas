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

import { Router, type Response } from 'express';
import { EMISORES, EMISORES_CON_ALIAS, LIMITES } from './limites';
import type { Resultado } from './modelos';
import type { BaseDeDatos } from './db';
import { crearServicio } from './servicio';
import { primerError, textoLimpio, validarEntero, validarTexto } from './validacion';

const CODIGO_HTTP: Record<Resultado, number> = {
  ok: 200,
  datos_invalidos: 400,
  sin_tarjeta: 404,
  no_existe: 404,
  sin_cupo: 409,
  ya_pagada: 409,
  sin_permiso: 403,
  cuotas_pagadas: 409,
};

export function crearRutas(bd: BaseDeDatos) {
  const rutas = Router();

  /** Las acciones del usuario con sesión iniciada (requiereSesion dejó su id): solo ve y cambia sus datos. */
  const servicio = (res: Response) => crearServicio(bd, res.locals.uid);

  /** Responde el resultado de una acción; si salió bien, incluye el estado actualizado. */
  const responder = async (res: Response, resultado: Resultado) => {
    if (resultado !== 'ok') {
      res.status(CODIGO_HTTP[resultado]).json({ resultado });
      return;
    }
    res.json({ resultado, estado: await servicio(res).estado() });
  };

  /** Responde 400 explicando qué dato no es válido. */
  const rechazar = (res: Response, mensaje: string) => {
    res.status(CODIGO_HTTP.datos_invalidos).json({ resultado: 'datos_invalidos', mensaje });
  };

  rutas.get('/estado', async (_req, res) => {
    res.json(await servicio(res).estado());
  });

  rutas.get('/proyecciones', async (req, res) => {
    const meses = Number(req.query.meses ?? 6);
    const error = validarEntero(meses, 'La cantidad de meses', 1, LIMITES.mesesProyeccionMax);
    if (error) return rechazar(res, error);
    res.json(await servicio(res).proyeccion(meses));
  });

  rutas.post('/tarjetas', async (req, res) => {
    const { emisor, nombre, alias, banco, diaVencimiento, colorHex, cupoTotal } = req.body ?? {};
    const error = primerError(
      typeof emisor === 'string' && EMISORES.includes(emisor) ? null : 'El emisor de la tarjeta no es válido.',
      validarTexto(nombre, 'El nombre', LIMITES.nombreMax),
      validarTexto(banco, 'El banco', LIMITES.nombreMax),
      validarTexto(alias, 'El alias', LIMITES.aliasMax, true),
      // Visa y MasterCard son genéricas: el alias es lo único que las distingue
      EMISORES_CON_ALIAS.includes(emisor) && textoLimpio(alias) === ''
        ? 'Las tarjetas Visa y MasterCard necesitan un alias.'
        : null,
      typeof colorHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(colorHex) ? null : 'El color no es válido.',
      validarEntero(diaVencimiento, 'El día de vencimiento', 1, 31),
      validarEntero(cupoTotal, 'El cupo', 1, LIMITES.montoMax)
    );
    if (error) return rechazar(res, error);

    await responder(
      res,
      await servicio(res).agregarTarjeta({
        emisor,
        nombre: nombre.trim(),
        // Sin alias (solo posible en bancos con nombre propio) se usa el nombre del banco
        alias: textoLimpio(alias) || banco.trim(),
        banco: banco.trim(),
        diaVencimiento,
        colorHex,
        cupoTotal,
      })
    );
  });

  rutas.post('/tarjetas/:id/compartir', async (req, res) => {
    const { email } = req.body ?? {};
    const error = validarTexto(email, 'El correo', LIMITES.emailMax);
    if (error) return rechazar(res, error);

    const resultado = await servicio(res).compartirTarjeta(req.params.id, email.trim());
    if (resultado === 'no_existe') {
      res.status(404).json({ resultado, mensaje: 'No hay ninguna cuenta con ese correo. La otra persona tiene que crear su cuenta primero.' });
      return;
    }
    if (resultado === 'datos_invalidos') return rechazar(res, 'Esa es tu propia cuenta: escribe el correo de la otra persona.');
    await responder(res, resultado);
  });

  rutas.delete('/tarjetas/:id/miembros/:uid', async (req, res) => {
    await responder(res, await servicio(res).dejarDeCompartir(req.params.id, req.params.uid));
  });

  rutas.patch('/tarjetas/:id', async (req, res) => {
    const { alias, cupoTotal, diaVencimiento } = req.body ?? {};
    if (alias === undefined && cupoTotal === undefined && diaVencimiento === undefined) {
      return rechazar(res, 'No hay nada que cambiar.');
    }
    const error = primerError(
      validarTexto(alias, 'El alias', LIMITES.aliasMax, true),
      cupoTotal === undefined ? null : validarEntero(cupoTotal, 'El cupo', 1, LIMITES.montoMax),
      diaVencimiento === undefined ? null : validarEntero(diaVencimiento, 'El día de vencimiento', 1, 31)
    );
    if (error) return rechazar(res, error);

    const resultado = await servicio(res).editarTarjeta(req.params.id, {
      alias: alias === undefined ? undefined : textoLimpio(alias),
      cupoTotal,
      diaVencimiento,
    });
    if (resultado === 'datos_invalidos') {
      return rechazar(
        res,
        'Las tarjetas Visa y MasterCard necesitan un alias.'
      );
    }
    await responder(res, resultado);
  });

  rutas.delete('/tarjetas/:id', async (req, res) => {
    await responder(res, await servicio(res).eliminarTarjeta(req.params.id));
  });

  rutas.post('/tarjetas/:id/pagar', async (req, res) => {
    await responder(res, await servicio(res).pagarMesTarjeta(req.params.id));
  });

  rutas.post('/transacciones', async (req, res) => {
    const { tarjetaId, motivo, monto, cuotas } = req.body ?? {};
    const error = primerError(
      validarTexto(tarjetaId, 'La tarjeta', 64),
      validarTexto(motivo, 'El motivo', LIMITES.motivoMax),
      validarEntero(monto, 'El monto', 1, LIMITES.montoMax),
      validarEntero(cuotas, 'La cantidad de cuotas', 1, LIMITES.cuotasMax)
    );
    if (error) return rechazar(res, error);

    await responder(res, await servicio(res).registrarTransaccion({ tarjetaId, motivo: motivo.trim(), monto, cuotas }));
  });

  rutas.patch('/transacciones/:id', async (req, res) => {
    const { motivo, monto, cuotas } = req.body ?? {};
    if (motivo === undefined && monto === undefined && cuotas === undefined) {
      return rechazar(res, 'No hay nada que cambiar.');
    }
    const error = primerError(
      motivo === undefined ? null : validarTexto(motivo, 'El motivo', LIMITES.motivoMax),
      monto === undefined ? null : validarEntero(monto, 'El monto', 1, LIMITES.montoMax),
      cuotas === undefined ? null : validarEntero(cuotas, 'La cantidad de cuotas', 1, LIMITES.cuotasMax)
    );
    if (error) return rechazar(res, error);

    await responder(
      res,
      await servicio(res).editarTransaccion(req.params.id, {
        motivo: motivo === undefined ? undefined : motivo.trim(),
        monto,
        cuotas,
      })
    );
  });

  rutas.delete('/transacciones/:id', async (req, res) => {
    await responder(res, await servicio(res).eliminarTransaccion(req.params.id));
  });

  rutas.post('/suscripciones', async (req, res) => {
    const { nombre, plan, monto, tarjetaId } = req.body ?? {};
    const error = primerError(
      validarTexto(tarjetaId, 'La tarjeta', 64),
      validarTexto(nombre, 'El nombre del servicio', LIMITES.nombreMax),
      validarTexto(plan, 'El plan', LIMITES.planMax, true),
      validarEntero(monto, 'El monto mensual', 1, LIMITES.montoMax)
    );
    if (error) return rechazar(res, error);

    await responder(
      res,
      await servicio(res).agregarSuscripcion({ nombre: nombre.trim(), plan: textoLimpio(plan), monto, tarjetaId })
    );
  });

  rutas.delete('/suscripciones/:id', async (req, res) => {
    await responder(res, await servicio(res).eliminarSuscripcion(req.params.id));
  });

  return rutas;
}
