// trae los iconos (X, check y flecha)
import { Ionicons } from '@expo/vector-icons';
// trae React y el tipo para recibir piezas de pantalla adentro
import React, { ReactNode } from 'react';
// trae las piezas para la ventana, zona deslizable, textos, botones y cajas
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

// datos que recibe la ventana para elegir una opción
interface ModalProps {
  // si la ventana se ve o no
  visible: boolean;
  // título de arriba de la ventana
  titulo: string;
  // qué hacer al tocar la X
  onCerrar: () => void;
  // qué tan alta puede ser la ventana
  alturaMax?: 'max-h-[70%]' | 'max-h-[80%]'; // Clases literales para que NativeWind las detecte
  // algo extra que se pone sobre la lista (opcional)
  encabezadoExtra?: ReactNode;               // Ej: buscador sobre la lista
  // las opciones que se muestran en la lista
  children: ReactNode;                       // Las opciones (FilaOpcion)
}

/** Bottom sheet reutilizable para elegir una opción de una lista. */
// ventana que sube desde abajo con una lista de opciones
export default function ModalSeleccion({
  // si la ventana se ve
  visible,
  // título de la ventana
  titulo,
  // qué hacer al cerrar
  onCerrar,
  // por defecto ocupa como máximo el 70% de la pantalla
  alturaMax = 'max-h-[70%]',
  // algo extra sobre la lista
  encabezadoExtra,
  // las opciones de la lista
  children,
}: ModalProps) {
  // devuelve lo que se ve en pantalla
  return (
    // ventana que aparece deslizándose desde abajo
    <Modal visible={visible} animationType="slide" transparent>
      {/* fondo oscuro semitransparente que empuja el panel hacia abajo */}
      <View className="flex-1 bg-black/50 justify-end">
        {/* panel claro con esquinas de arriba redondeadas y altura máxima */}
        <View className={`bg-slate-50 rounded-t-3xl p-6 ${alturaMax}`}>
          {/* fila del título con la X, con una línea gris abajo */}
          <View className="flex-row items-center justify-between pb-4 border-b border-slate-200">
            {/* muestra el título en negrita */}
            <Text className="text-slate-800 text-lg font-inter-bold">{titulo}</Text>
            {/* botón para cerrar la ventana */}
            <TouchableOpacity onPress={onCerrar}>
              {/* icono de la X */}
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {/* muestra lo extra, por ejemplo un buscador */}
          {encabezadoExtra}

          {/* zona deslizable con las opciones */}
          <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
            {/* muestra las opciones de la lista */}
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// datos que recibe cada opción de la lista
interface FilaProps {
  // si esta opción es la elegida
  seleccionada: boolean;
  // qué hacer al tocar la opción
  onPress: () => void;
  // lo que se ve dentro de la opción
  children: ReactNode;
}

/** Una opción de la lista: contenido a la izquierda, check (si está elegida) o flecha a la derecha. */
// una opción tocable de la lista
export function FilaOpcion({ seleccionada, onPress, children }: FilaProps) {
  // devuelve lo que se ve en pantalla
  return (
    // fila blanca tocable
    <TouchableOpacity
      // al tocarla, elige esta opción
      onPress={onPress}
      // fila blanca redondeada con borde suave y sombra
      className="h-16 px-4 mb-2 bg-white rounded-2xl border border-slate-100 flex-row items-center justify-between shadow-sm"
    >
      {/* muestra el contenido de la opción */}
      {children}
      {/* si está elegida muestra un check verde, si no una flechita gris */}
      {seleccionada ? (
        <Ionicons name="checkmark-circle" size={22} color="#10B981" />
      ) : (
        <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
      )}
    </TouchableOpacity>
  );
}
