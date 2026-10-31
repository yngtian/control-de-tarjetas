// trae los iconos (la flecha para volver)
import { Ionicons } from '@expo/vector-icons';
// trae React para poder armar la pantalla
import React from 'react';
// trae las piezas para textos, botones y cajas
import { Text, TouchableOpacity, View } from 'react-native';

// datos que recibe el encabezado
interface Props {
  // título que va al centro
  titulo: string;
  // qué hacer al tocar la flecha de volver
  onVolver: () => void;
  // 'pagina': pantallas de listado (Tarjetas, Suscripciones) | 'formulario': formularios y detalle
  variante?: 'pagina' | 'formulario';
}

/** Encabezado con botón de retorno y título centrado. */
// barra de arriba con la flecha de volver y el título
export default function EncabezadoPantalla({ titulo, onVolver, variante = 'pagina' }: Props) {
  // indica si es una pantalla de lista (y no un formulario)
  const esPagina = variante === 'pagina';

  // devuelve lo que se ve en pantalla
  return (
    // fila de arriba con la flecha, el título y un espacio
    <View
      // en listas va con más espacio; en formularios lleva una línea gris abajo
      className={
        esPagina
          ? 'px-6 pt-6 pb-4 flex-row items-center justify-between'
          : 'px-6 pt-4 pb-3 flex-row items-center justify-between border-b border-slate-100'
      }
    >
      {/* botón para volver a la pantalla anterior */}
      <TouchableOpacity onPress={onVolver} className="w-8">
        {/* icono de flecha hacia la izquierda */}
        <Ionicons name="chevron-back" size={24} color={esPagina ? '#1E293B' : '#0F172A'} />
      </TouchableOpacity>
      {/* título en negrita, más grande en listas y más chico en formularios */}
      <Text className={esPagina ? 'text-slate-800 text-lg font-inter-bold' : 'text-slate-600 text-base font-inter-bold'}>
        {/* muestra el título de la pantalla */}
        {titulo}
      </Text>
      {/* Espaciador para que el título quede centrado */}
      <View className="w-8" />
    </View>
  );
}
