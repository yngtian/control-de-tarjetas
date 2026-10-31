// trae los iconos (el de personas)
import { Ionicons } from '@expo/vector-icons';
// trae React para poder armar la pantalla
import React from 'react';
// trae las piezas para textos y cajas
import { Text, View } from 'react-native';
// trae el color gris oscuro para tarjetas sin color
import { COLOR_TARJETA_DEFAULT } from '../constants/banks';
// pasa un numero a pesos chilenos con puntos de miles, ej: 300000 queda "$300.000"
import { formatearCLP, nombresCompartidos } from '../constants/formato';
// el tipo de la tarjeta que recibe este componente
import { TarjetaItem } from '../context/AppContext';

// recibe una tarjeta en item y la dibuja en chico para la lista
export default function TarjetaMini({ item }: { item: TarjetaItem }) {
  // cuanto cupo se ha usado: total menos disponible, nunca menos de 0
  const utilizado = Math.max(item.cupoTotal - item.cupoDisponible, 0);
  // el porcentaje usado, con tope en 100. Si el cupo es 0 devuelve 0 para no dividir por cero
  const porcentaje =
    item.cupoTotal > 0 ? Math.min((utilizado / item.cupoTotal) * 100, 100) : 0;

  // devuelve lo que se ve en pantalla
  return (
    // fila con la tarjeta a la izquierda y los numeros a la derecha
    <View className="flex-row items-center mb-5">
      {/* tarjeta chica, ocupa el 42% del ancho y toma el color del banco (o gris oscuro si no tiene) */}
      <View
        // tarjeta chica con esquinas redondeadas y sombra suave
        className="w-[42%] h-[104px] p-3 rounded-xl justify-between overflow-hidden shadow-sm"
        // aquí se pinta la tarjeta con el color del banco
        style={{ backgroundColor: item.colorHex || COLOR_TARJETA_DEFAULT }}>
        {/* circulo blanco transparente en la esquina, es solo adorno */}
        <View className="w-16 h-16 -left-5 -top-5 absolute bg-white/10 rounded-full" />
        {/* dia de vencimiento y, si comparte cupo, una marca de "compartida" */}
        <View className="flex-row items-center justify-between">
          {/* texto blanco chico con el día en que vence */}
          <Text className="text-white/80 text-[10px] font-inter-medium">
            {/* muestra "Día" y el número de vencimiento */}
            Día {item.diaVencimiento}
          </Text>
          {/* si la tarjeta se comparte, muestra la marca "Compartida" */}
          {item.compartidaCon.length > 0 && (
            <View className="flex-row items-center gap-1">
              {/* icono blanco de personas */}
              <Ionicons name="people" size={11} color="#FFFFFF" />
              {/* texto blanco chico */}
              <Text className="text-white text-[10px] font-inter-medium">
                {/* palabra "Compartida" */}
                Compartida
              </Text>
            </View>
          )}
        </View>
        {/* nombre del banco, maximo 2 lineas */}
        <Text className="text-white text-sm font-inter-bold" numberOfLines={2}>
          {/* muestra el nombre del banco */}
          {item.banco}
        </Text>
      </View>

      {/* lado derecho: disponible y utilizado, y debajo con quién se comparte */}
      <View className="flex-1 pl-4">
        {/* fila con las dos columnas de números */}
        <View className="flex-row justify-between">
          {/* columna del cupo disponible */}
          <View>
            {/* título gris chico */}
            <Text className="text-slate-400 text-[11px] font-inter-medium tracking-wide">
              {/* palabra "DISPONIBLE" */}
              DISPONIBLE
            </Text>
            {/* cupo que queda, en formato de pesos */}
            <Text className="text-slate-900 text-base font-inter-bold mt-1">
              {/* muestra el cupo disponible en pesos */}
              {formatearCLP(item.cupoDisponible)}
            </Text>
          </View>

          {/* items-end alinea esta columna a la derecha */}
          <View className="items-end">
            {/* título gris chico */}
            <Text className="text-slate-400 text-[11px] font-inter-medium tracking-wide">
              {/* palabra "UTILIZADO" */}
              UTILIZADO
            </Text>
            {/* porcentaje con un decimal, ej: 24.0% */}
            <Text className="text-slate-900 text-base font-inter-bold mt-1">
              {/* muestra el porcentaje usado */}
              {porcentaje.toFixed(1)}%
            </Text>
          </View>
        </View>

        {/* va fuera de las columnas: si el nombre es largo se corta, pero no empuja "utilizado" */}
        {item.compartidaCon.length > 0 && (
          <Text className="text-slate-400 text-[10px] font-inter-medium" numberOfLines={1}>
            {/* frase con los nombres de quienes comparten la tarjeta */}
            Cuenta compartida con {nombresCompartidos(item.compartidaCon)}
          </Text>
        )}
      </View>
    </View>
  );
}
