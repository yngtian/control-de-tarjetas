// trae la herramienta para cambiar de pantalla
import { useRouter } from 'expo-router';
// trae la forma de hacer algo apenas se abre la pantalla
import { useEffect } from 'react';
// trae la función que muestra una pregunta con dos botones
import { confirmar } from '../constants/alertas';
// trae las direcciones de cada pantalla
import { RUTAS } from '../constants/rutas';
// trae los datos guardados de la app (las tarjetas)
import { useApp } from '../context/AppContext';

/**
 * Regla de negocio: transacciones y suscripciones necesitan una tarjeta.
 * Si no hay ninguna registrada, ofrece crearla; si el usuario cancela, vuelve
 * a `rutaSiCancela`. Úsalo al inicio de las pantallas de registro.
 */
// revisa que el usuario tenga al menos una tarjeta antes de registrar algo
export function useRequerirTarjetas(accion: 'transacción' | 'suscripción', rutaSiCancela: string) {
  // trae la herramienta para cambiar de pantalla
  const router = useRouter();
  // trae la lista de tarjetas del usuario
  const { tarjetas } = useApp();

  // se ejecuta al abrir la pantalla y cada vez que cambia la cantidad de tarjetas
  useEffect(() => {
    // si ya tiene tarjetas, no hace nada
    if (tarjetas.length > 0) return;

    // si no tiene, pregunta si quiere crear una
    confirmar({
      // título de la pregunta
      titulo: 'Sin tarjetas',
      // explicación de la pregunta
      mensaje: `Debes registrar al menos una tarjeta antes de agregar una ${accion}.\n\n¿Deseas crear una tarjeta ahora?`,
      // texto del botón para aceptar
      textoConfirmar: 'Crear Tarjeta',
      // si acepta, lo lleva a crear una tarjeta
      onConfirmar: () => router.replace(RUTAS.registrarTarjeta),
      // si cancela, lo devuelve a la pantalla indicada
      onCancelar: () => router.replace(rutaSiCancela as any),
    });
  // vuelve a revisar solo cuando cambia la cantidad de tarjetas
  }, [tarjetas.length]);
}
