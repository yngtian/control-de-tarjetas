// createContext crea el contexto, useContext lo lee y useState guarda los datos
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { api, RespuestaAccion } from '../api/cliente';
import type {
  CambiosTarjeta,
  CambiosTransaccion,
  Estado,
  Miembro,
  NuevaSuscripcion,
  NuevaTarjeta,
  Resultado,
  ResultadoAccion,
  SuscripcionItem,
  TarjetaItem,
  TransaccionItem,
} from '../api/tipos';
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
interface AppContextType extends Estado {
  // Todas pueden devolver 'datos_invalidos' (con un mensaje para mostrar) o 'sin_conexion'
  agregarTarjeta: (tarjeta: NuevaTarjeta) => Promise<ResultadoAccion>;
  // Comparte una tarjeta propia con otra cuenta, por su correo. 'no_existe' si no hay cuenta con ese correo
  compartirTarjeta: (id: string, email: string) => Promise<ResultadoAccion>;
  // El dueño deja de compartirla con alguien, o un miembro deja de verla (miembroUid = el suyo)
  dejarDeCompartir: (id: string, miembroUid: string) => Promise<ResultadoAccion>;
  // 'sin_cupo' si el monto supera el cupo disponible
  registrarTransaccion: (tarjetaId: string, motivo: string, monto: number, cuotas: number) => Promise<ResultadoAccion>;
  // 'sin_tarjeta' si la tarjeta no existe, 'sin_cupo' si el monto supera su cupo
  agregarSuscripcion: (suscripcion: NuevaSuscripcion) => Promise<ResultadoAccion>;
  eliminarSuscripcion: (id: string) => Promise<ResultadoAccion>;
  // 'sin_cupo' si el cupo nuevo es menor a lo usado
  editarTarjeta: (id: string, cambios: CambiosTarjeta) => Promise<ResultadoAccion>;
  // Borra también sus compras y suscripciones. 'sin_permiso' si la tarjeta es de otra persona
  eliminarTarjeta: (id: string) => Promise<ResultadoAccion>;
  // 'cuotas_pagadas' si cambia monto o cuotas de una compra que ya pagó alguna; 'sin_cupo' si no cabe
  editarTransaccion: (id: string, cambios: CambiosTransaccion) => Promise<ResultadoAccion>;
  eliminarTransaccion: (id: string) => Promise<ResultadoAccion>;
  // Paga lo acumulado de la tarjeta (también una compartida). 'ya_pagada' si el mes ya estaba pagado
  pagarMesTarjeta: (tarjetaId: string) => Promise<ResultadoAccion>;
}

// crea el contexto vacio (undefined), useApp revisa mas abajo que exista el Provider
const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  // Última respuesta del backend (null mientras carga por primera vez)
  const [estado, setEstado] = useState<Estado | null>(null);
  const [errorConexion, setErrorConexion] = useState(false);

  const cargar = useCallback(async () => {
    setErrorConexion(false);
    try {
      setEstado(await api.estado());
    } catch {
      setErrorConexion(true);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Tarjetas compartidas: otra persona puede registrar gastos en cualquier momento. Para que se
  // vean sin recargar, se vuelve a pedir el estado cada 10 segundos y al volver a la app.
  useEffect(() => {
    const refrescar = () => {
      api.estado().then(setEstado).catch(() => {
        // Sin conexión por un momento: se mantiene lo último que llegó
      });
    };
    const intervalo = setInterval(refrescar, 10000);
    const suscripcion = AppState.addEventListener('change', (s) => {
      if (s === 'active') refrescar();
    });
    return () => {
      clearInterval(intervalo);
      suscripcion.remove();
    };
  }, []);

  // Sin datos todavía: pantalla de carga o de error con "Reintentar"
  if (!estado) {
    return <PantallaConexion error={errorConexion} onReintentar={cargar} />;
  }

  /** Ejecuta una acción y, si el backend devolvió el estado nuevo, lo reemplaza. */
  const ejecutar = async (peticion: Promise<RespuestaAccion>): Promise<ResultadoAccion> => {
    const { estado: nuevo, resultado, mensaje } = await peticion;
    if (nuevo) setEstado(nuevo);
    return { resultado, mensaje };
  };

  // entrega los datos y funciones a todo lo que este dentro del provider
  return (
    <AppContext.Provider
      value={{
        ...estado,
        agregarTarjeta: (t) => ejecutar(api.agregarTarjeta(t)),
        compartirTarjeta: (id, email) => ejecutar(api.compartirTarjeta(id, email)),
        dejarDeCompartir: (id, miembroUid) => ejecutar(api.dejarDeCompartir(id, miembroUid)),
        registrarTransaccion: (tarjetaId, motivo, monto, cuotas) =>
          ejecutar(api.registrarTransaccion(tarjetaId, motivo, monto, cuotas)),
        agregarSuscripcion: (s) => ejecutar(api.agregarSuscripcion(s)),
        eliminarSuscripcion: (id) => ejecutar(api.eliminarSuscripcion(id)),
        pagarMesTarjeta: (id) => ejecutar(api.pagarMesTarjeta(id)),
        editarTarjeta: (id, cambios) => ejecutar(api.editarTarjeta(id, cambios)),
        eliminarTarjeta: (id) => ejecutar(api.eliminarTarjeta(id)),
        editarTransaccion: (id, cambios) => ejecutar(api.editarTransaccion(id, cambios)),
        eliminarTransaccion: (id) => ejecutar(api.eliminarTransaccion(id)),
      }}
    >
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
  return context;
}
