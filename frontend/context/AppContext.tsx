// createContext crea el contexto, useContext lo lee y useState guarda los datos
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
// trae la herramienta que avisa si la app está abierta o en segundo plano
import { AppState } from 'react-native';
// trae las funciones que hablan con el servidor
import { api, RespuestaAccion } from '../api/cliente';
// trae la forma de los datos que usa la app
import type {
  // cambios que se pueden hacer a una tarjeta
  CambiosTarjeta,
  // cambios que se pueden hacer a una compra
  CambiosTransaccion,
  // todos los datos de la app juntos
  Estado,
  // una persona con quien se comparte una tarjeta
  Miembro,
  // datos para crear una suscripción nueva
  NuevaSuscripcion,
  // datos para crear una tarjeta nueva
  NuevaTarjeta,
  // código que dice cómo salió una acción
  Resultado,
  // código de resultado más su mensaje
  ResultadoAccion,
  // una suscripción ya guardada
  SuscripcionItem,
  // una tarjeta ya guardada
  TarjetaItem,
  // una compra ya guardada
  TransaccionItem,
} from '../api/tipos';
// trae la pantalla de "cargando" o "sin conexión"
import PantallaConexion from '../components/PantallaConexion';

// Las pantallas importan los tipos desde aquí, como antes de separar el backend
export type { Miembro, Resultado, ResultadoAccion, SuscripcionItem, TarjetaItem, TransaccionItem };

/**
 * Todo lo que el contexto expone a las pantallas.
 * Se accede con: const { tarjetas, agregarTarjeta } = useApp();
 *
 * Los datos y los cálculos viven en el backend: aquí solo se guarda la última
 * respuesta. Cada acción devuelve el estado actualizado y la app lo reemplaza.
 */
// lista de datos y acciones que reciben todas las pantallas
interface AppContextType extends Estado {
  // Todas pueden devolver 'datos_invalidos' (con un mensaje para mostrar) o 'sin_conexion'
  // acción para agregar una tarjeta nueva
  agregarTarjeta: (tarjeta: NuevaTarjeta) => Promise<ResultadoAccion>;
  // Comparte una tarjeta propia con otra cuenta, por su correo. 'no_existe' si no hay cuenta con ese correo
  compartirTarjeta: (id: string, email: string) => Promise<ResultadoAccion>;
  // El dueño deja de compartirla con alguien, o un miembro deja de verla (miembroUid = el suyo)
  dejarDeCompartir: (id: string, miembroUid: string) => Promise<ResultadoAccion>;
  // 'sin_cupo' si el monto supera el cupo disponible
  registrarTransaccion: (tarjetaId: string, motivo: string, monto: number, cuotas: number) => Promise<ResultadoAccion>;
  // 'sin_tarjeta' si la tarjeta no existe, 'sin_cupo' si el monto supera su cupo
  agregarSuscripcion: (suscripcion: NuevaSuscripcion) => Promise<ResultadoAccion>;
  // acción para borrar una suscripción
  eliminarSuscripcion: (id: string) => Promise<ResultadoAccion>;
  // 'sin_cupo' si el cupo nuevo es menor a lo usado
  editarTarjeta: (id: string, cambios: CambiosTarjeta) => Promise<ResultadoAccion>;
  // Borra también sus compras y suscripciones. 'sin_permiso' si la tarjeta es de otra persona
  eliminarTarjeta: (id: string) => Promise<ResultadoAccion>;
  // 'cuotas_pagadas' si cambia monto o cuotas de una compra que ya pagó alguna; 'sin_cupo' si no cabe
  editarTransaccion: (id: string, cambios: CambiosTransaccion) => Promise<ResultadoAccion>;
  // acción para borrar una compra
  eliminarTransaccion: (id: string) => Promise<ResultadoAccion>;
  // Paga lo acumulado de la tarjeta (también una compartida). 'ya_pagada' si el mes ya estaba pagado
  pagarMesTarjeta: (tarjetaId: string) => Promise<ResultadoAccion>;
}

// crea el contexto vacio (undefined), useApp revisa mas abajo que exista el Provider
const AppContext = createContext<AppContextType | undefined>(undefined);

// caja que guarda los datos de la app y los comparte con todas las pantallas
export function AppProvider({ children }: { children: ReactNode }) {
  // Última respuesta del backend (null mientras carga por primera vez)
  const [estado, setEstado] = useState<Estado | null>(null);
  // recuerda si falló la conexión con el servidor
  const [errorConexion, setErrorConexion] = useState(false);

  // función que pide todos los datos al servidor
  const cargar = useCallback(async () => {
    // borra el error anterior antes de intentar de nuevo
    setErrorConexion(false);
    // intenta traer los datos
    try {
      // guarda los datos que mandó el servidor
      setEstado(await api.estado());
    // si algo falla, entra aquí
    } catch {
      // marca que no hubo conexión
      setErrorConexion(true);
    }
  }, []);

  // al abrir la app, pide los datos una vez
  useEffect(() => {
    // llama a la función que trae los datos
    cargar();
  }, [cargar]);

  // Tarjetas compartidas: otra persona puede registrar gastos en cualquier momento. Para que se
  // vean sin recargar, se vuelve a pedir el estado cada 10 segundos y al volver a la app.
  useEffect(() => {
    // función que vuelve a pedir los datos sin mostrar carga
    const refrescar = () => {
      // pide los datos y, si llegan, los guarda
      api.estado().then(setEstado).catch(() => {
        // Sin conexión por un momento: se mantiene lo último que llegó
      });
    };
    // repite la actualización cada 10 segundos
    const intervalo = setInterval(refrescar, 10000);
    // escucha cuando el usuario vuelve a la app
    const suscripcion = AppState.addEventListener('change', (s) => {
      // si la app volvió a estar abierta, actualiza los datos
      if (s === 'active') refrescar();
    });
    // al salir, apaga las actualizaciones automáticas
    return () => {
      // detiene la repetición cada 10 segundos
      clearInterval(intervalo);
      // deja de escuchar si el usuario vuelve a la app
      suscripcion.remove();
    };
  }, []);

  // Sin datos todavía: pantalla de carga o de error con "Reintentar"
  if (!estado) {
    // muestra la pantalla de carga, con botón para reintentar si falló
    return <PantallaConexion error={errorConexion} onReintentar={cargar} />;
  }

  /** Ejecuta una acción y, si el backend devolvió el estado nuevo, lo reemplaza. */
  const ejecutar = async (peticion: Promise<RespuestaAccion>): Promise<ResultadoAccion> => {
    // espera la respuesta del servidor y separa sus partes
    const { estado: nuevo, resultado, mensaje } = await peticion;
    // si llegaron datos nuevos, actualiza la app con ellos
    if (nuevo) setEstado(nuevo);
    // devuelve a la pantalla cómo salió la acción
    return { resultado, mensaje };
  };

  // entrega los datos y funciones a todo lo que este dentro del provider
  return (
    <AppContext.Provider
      // lo que reciben todas las pantallas
      value={{
        // todos los datos: tarjetas, compras, suscripciones
        ...estado,
        // agrega una tarjeta en el servidor
        agregarTarjeta: (t) => ejecutar(api.agregarTarjeta(t)),
        // comparte una tarjeta con otra persona por su correo
        compartirTarjeta: (id, email) => ejecutar(api.compartirTarjeta(id, email)),
        // deja de compartir una tarjeta con alguien
        dejarDeCompartir: (id, miembroUid) => ejecutar(api.dejarDeCompartir(id, miembroUid)),
        // registra una compra nueva en una tarjeta
        registrarTransaccion: (tarjetaId, motivo, monto, cuotas) =>
          // manda la compra al servidor
          ejecutar(api.registrarTransaccion(tarjetaId, motivo, monto, cuotas)),
        // agrega una suscripción nueva
        agregarSuscripcion: (s) => ejecutar(api.agregarSuscripcion(s)),
        // borra una suscripción
        eliminarSuscripcion: (id) => ejecutar(api.eliminarSuscripcion(id)),
        // paga el mes de una tarjeta
        pagarMesTarjeta: (id) => ejecutar(api.pagarMesTarjeta(id)),
        // guarda los cambios de una tarjeta
        editarTarjeta: (id, cambios) => ejecutar(api.editarTarjeta(id, cambios)),
        // borra una tarjeta
        eliminarTarjeta: (id) => ejecutar(api.eliminarTarjeta(id)),
        // guarda los cambios de una compra
        editarTransaccion: (id, cambios) => ejecutar(api.editarTransaccion(id, cambios)),
        // borra una compra
        eliminarTransaccion: (id) => ejecutar(api.eliminarTransaccion(id)),
      }}
    >
      {/* aquí van todas las pantallas de la app */}
      {children}
    </AppContext.Provider>
  );
}

// atajo para usar el contexto en cualquier pantalla: const { tarjetas } = useApp();
export function useApp() {
  // lee el contexto
  const context = useContext(AppContext);
  // si se usa fuera del AppProvider tira un error, asi nos damos cuenta altiro
  if (!context) throw new Error('useApp debe usarse dentro de AppProvider');
  // entrega los datos y acciones a la pantalla
  return context;
}
