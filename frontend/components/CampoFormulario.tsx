// trae los iconos (la flechita hacia abajo)
import { Ionicons } from '@expo/vector-icons';
// trae React y el tipo para recibir piezas de pantalla adentro
import React, { ReactNode } from 'react';
// trae las piezas para textos, botones y cajas
import { Text, TouchableOpacity, View } from 'react-native';

/**
 * Clases de un TextInput de formulario.
 * `conError` pinta el borde rojo (ej: alias obligatorio vacío).
 */
// estilo de las casillas: gris claro con borde, rojo si hay error
export const estiloInput = (conError: boolean = false) =>
  `w-full h-12 px-4 bg-slate-50 border ${
    conError ? 'border-red-300' : 'border-slate-300'
  } rounded-xl text-slate-800 font-inter-medium`;

// datos que recibe la caja con título
interface CampoProps {
  // el título que va arriba de la casilla
  etiqueta: string;
  // la casilla o lo que va debajo del título
  children: ReactNode;
  // espacio de abajo (opcional)
  className?: string; // Para cambiar el margen inferior (ej: último campo)
}

/** Etiqueta + control, con el espaciado estándar de los formularios. */
// caja con un título en negrita y la casilla debajo
export function CampoFormulario({ etiqueta, children, className = 'mb-5' }: CampoProps) {
  // devuelve lo que se ve en pantalla
  return (
    // caja con espacio abajo para separar de la siguiente
    <View className={className}>
      {/* título negro en negrita sobre la casilla */}
      <Text className="text-black text-base font-inter-bold mb-1.5">{etiqueta}</Text>
      {/* muestra la casilla que va debajo del título */}
      {children}
    </View>
  );
}

// datos que recibe la casilla desplegable
interface SelectorProps {
  // qué hacer al tocarla
  onPress: () => void;
  // lo que se ve dentro de la casilla
  children: ReactNode;
}

/** Campo desplegable: se ve como un input pero abre un selector (modal) al tocarlo. */
// casilla que al tocarla abre una lista para elegir
export function SelectorCampo({ onPress, children }: SelectorProps) {
  // devuelve lo que se ve en pantalla
  return (
    // casilla tocable
    <TouchableOpacity
      // al tocarla, abre la lista de opciones
      onPress={onPress}
      // se ve igual que una casilla: gris claro con borde redondeado
      className="w-full h-12 px-4 bg-slate-50 border border-slate-300 rounded-xl flex-row items-center justify-between"
    >
      {/* muestra lo elegido a la izquierda */}
      <View className="flex-row items-center flex-1">{children}</View>
      {/* flechita gris hacia abajo a la derecha */}
      <Ionicons name="chevron-down" size={18} color="#64748B" />
    </TouchableOpacity>
  );
}
