// trae React para poder armar la pantalla
import React from 'react';
// trae las piezas para textos y cajas
import { Text, View } from 'react-native';
// trae la función que escribe montos en pesos chilenos
import { formatearCLP } from '../constants/formato';
// trae los datos guardados de la app (total y tarjetas)
import { useApp } from '../context/AppContext';

// tarjeta oscura del inicio con el gasto total del mes
export default function HomeCard() {
  // trae el total del mes y la lista de tarjetas
  const { totalConsolidado, tarjetas } = useApp();
  // Alguna tarjeta con meses anteriores sin pagar
  const hayAtrasos = tarjetas.some((t) => t.mesesAtrasados > 0);

  // devuelve lo que se ve en pantalla
  return (
    // caja de todo el ancho con margen a los lados
    <View className="w-full px-6 pb-6">
      {/* recuadro oscuro redondeado con sombra fuerte */}
      <View className="w-full p-6 relative bg-color-menu rounded-3xl overflow-hidden shadow-lg">
        {/* Círculo decorativo Figma */}
        <View className="w-40 h-40 -right-10 -top-10 absolute bg-white/5 rounded-full" />

        {/* Sección de textos */}
        <View className="gap-1 z-10">
          {/* texto gris chico de título */}
          <Text className="text-color-inactive text-sm font-inter-regular tracking-tight">
            {/* frase "Gasto consolidado del mes" */}
            Gasto consolidado del mes
          </Text>
          {/* monto blanco muy grande en negrita */}
          <Text className="text-white text-4xl font-inter-bold tracking-tight">
            {/* muestra el total del mes en pesos */}
            {formatearCLP(totalConsolidado)}
          </Text>
        </View>

        {/* Píldora inferior */}
        <View className="self-start px-4 py-1.5 rounded-full border border-white/10 z-10 mt-3">
          {/* texto gris claro chico de la píldora */}
          <Text className="text-slate-300 text-xs font-inter-medium">
            {/* si hay deudas atrasadas lo avisa, si no dice que está al día */}
            {hayAtrasos ? 'Tienes pagos atrasados' : 'Presupuesto al día'}
          </Text>
        </View>
      </View>
    </View>
  );
}
