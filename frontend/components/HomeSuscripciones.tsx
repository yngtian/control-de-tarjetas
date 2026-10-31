// trae la herramienta para cambiar de pantalla
import { useRouter } from 'expo-router';
// trae React para poder armar la pantalla
import React from 'react';
// trae las piezas para textos, botones y cajas
import { Text, TouchableOpacity, View } from 'react-native';
// trae la función que escribe montos en pesos chilenos
import { formatearCLP } from '../constants/formato';
// trae las direcciones de cada pantalla
import { RUTAS } from '../constants/rutas';
// trae los datos guardados de la app (las suscripciones)
import { useApp } from '../context/AppContext';
// trae la fila que muestra una suscripción
import SuscripcionFila from './SuscripcionFila';

// Cuántas suscripciones se muestran en el Home antes de "Ver todas"
const MAX_HOME = 3;

// sección de suscripciones de la pantalla de inicio
export default function HomeSuscripciones() {
  // trae la herramienta para cambiar de pantalla
  const router = useRouter();
  // trae la lista de suscripciones y el total que se paga al mes
  const { suscripciones, totalSuscripciones } = useApp();

  // devuelve lo que se ve en pantalla
  return (
    // caja de todo el ancho con margen a los lados y abajo
    <View className="w-full px-6 pb-8">
      {/* Encabezado: título + píldora con total mensual */}
      <View className="flex-row justify-between items-center mb-4">
        {/* título "Suscripciones" en negrita */}
        <Text className="text-slate-800 text-base font-inter-bold tracking-tight">Suscripciones</Text>
        {/* píldora blanca con el total al mes, tocable */}
        <TouchableOpacity
          // al tocarla, va a la pantalla de Suscripciones
          onPress={() => router.push(RUTAS.suscripciones)}
          // se aclara un poco al tocarla
          activeOpacity={0.7}
          // píldora blanca redondeada con borde suave
          className="flex-row items-baseline px-3 py-1.5 bg-white rounded-full border border-slate-100"
        >
          {/* total en negrita */}
          <Text className="text-slate-900 text-xs font-inter-bold">
            {/* muestra el total mensual en pesos */}
            {formatearCLP(totalSuscripciones)}
          </Text>
          {/* texto gris chico " /mes" */}
          <Text className="text-slate-400 text-[10px] font-inter-regular"> /mes</Text>
        </TouchableOpacity>
      </View>

      {/* si no hay suscripciones muestra un aviso tocable, si hay muestra la lista */}
      {suscripciones.length === 0 ? (
        <TouchableOpacity
          // al tocar el aviso, va a registrar una suscripción
          onPress={() => router.push(RUTAS.registrarSuscripcion)}
          // se aclara un poco al tocarlo
          activeOpacity={0.7}
          // caja con borde punteado gris
          className="p-4 rounded-2xl border border-dashed border-slate-300 items-center justify-center"
        >
          {/* texto gris del aviso */}
          <Text className="text-slate-400 text-xs font-inter-medium">
            {/* mensaje que invita a agregar una suscripción */}
            No tienes suscripciones. Toca aquí para agregar una.
          </Text>
        </TouchableOpacity>
      ) : (
        <>
          {/* muestra solo las primeras 3 suscripciones */}
          {suscripciones.slice(0, MAX_HOME).map((s) => (
            <SuscripcionFila key={s.id} item={s} />
          ))}
          {/* si hay más de 3, muestra el botón para ver todas */}
          {suscripciones.length > MAX_HOME && (
            <TouchableOpacity onPress={() => router.push(RUTAS.suscripciones)} activeOpacity={0.7}>
              {/* texto gris centrado del botón */}
              <Text className="text-slate-500 text-xs font-inter-medium text-center pt-1">
                {/* frase con la cantidad total de suscripciones */}
                Ver las {suscripciones.length} suscripciones
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}
