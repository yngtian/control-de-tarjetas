// trae React para poder armar la pantalla
import React from 'react';
// trae las piezas para textos y cajas
import { Text, View } from 'react-native';
// trae el color gris oscuro para tarjetas sin color
import { COLOR_TARJETA_DEFAULT } from '../constants/banks';
// el tipo de la tarjeta que recibe
import { TarjetaItem } from '../context/AppContext';

// recibe una tarjeta en item y la dibuja en grande (se usa en la vista previa y en el detalle)
export default function CardItem({ item }: { item: TarjetaItem }) {
  // devuelve lo que se ve en pantalla
  return (
    // la tarjeta: ancho completo, 160px de alto, puntas redondeadas y el color del banco de fondo
    <View
      // tarjeta grande redondeada con sombra fuerte
      className="w-full h-40 p-6 rounded-3xl justify-between overflow-hidden shadow-lg mb-4"
      // aquí se pinta la tarjeta con el color del banco
      style={{ backgroundColor: item.colorHex || COLOR_TARJETA_DEFAULT }}
    >
      {/* circulo blanco transparente arriba a la izquierda, es el brillo que venia en Figma */}
      <View className="w-28 h-28 -left-8 -top-8 absolute bg-white/10 rounded-full" />

      {/* fila de arriba con el nombre del banco */}
      <View className="flex-row justify-between items-start">
        {/* si no viene banco muestra "Nombre Banco" */}
        <Text className="text-white text-base font-inter-bold tracking-wide">
          {/* muestra el nombre del banco */}
          {item.banco || "Nombre Banco"}
        </Text>
      </View>

      {/* parte de abajo: monto del mes y vencimiento, con un poco de espacio entre lineas (gap-1) */}
      <View className="gap-1">
        {/* texto blanco suave y chico */}
        <Text className="text-white/80 text-xs font-inter-medium">
          {/* palabras "Total a Pagar:" */}
          Total a Pagar:
        </Text>
        {/* monto ya formateado, ej: $40.000. Si viene vacio muestra $0 */}
        <Text className="text-white text-3xl font-inter-medium tracking-tight">
          {/* muestra el monto a pagar */}
          {item.monto || "$0"}
        </Text>
        {/* texto del vencimiento, ej: Vence 15 de Octubre (Quedan 6 dias) */}
        <Text className="text-white/80 text-xs font-inter-regular pt-0.5">
          {/* muestra la fecha de vencimiento */}
          {item.vencimiento || "Fecha no definida"}
        </Text>
      </View>
    </View>
  );
}
