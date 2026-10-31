// trae los iconos (tarjeta y personas)
import { Ionicons } from '@expo/vector-icons';
// trae la herramienta para cambiar de pantalla
import { useRouter } from 'expo-router';
// trae React para poder armar la pantalla
import React from 'react';
// trae las piezas para deslizar, textos, botones y cajas
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
// trae el color gris oscuro para tarjetas sin color
import { COLOR_TARJETA_DEFAULT } from '../constants/banks';
// trae las direcciones de cada pantalla
import { RUTAS } from '../constants/rutas';
// trae los datos guardados de la app (las tarjetas)
import { useApp } from '../context/AppContext';

// fila de tarjetas que se desliza de lado en el inicio
export default function HomeCardsCarousel() {
  // trae la herramienta para cambiar de pantalla
  const router = useRouter();
  // trae la lista de tarjetas del usuario
  const { tarjetas } = useApp();

  // devuelve lo que se ve en pantalla
  return (
    // caja de todo el ancho con espacio abajo
    <View className="w-full pb-8">
      {/* Encabezado: Título y enlace 'Ver todas' */}
      <View className="px-6 flex-row justify-between items-center mb-4">
        {/* título "Mis Tarjetas" en negrita */}
        <Text className="text-slate-800 text-base font-inter-bold tracking-tight">
          {/* texto del título */}
          Mis Tarjetas
        </Text>
        {/* botón "Ver todas" */}
        <TouchableOpacity
          // al tocarlo, va a la pantalla de Tarjetas
          onPress={() => router.push(RUTAS.tarjetas)}
          // se aclara un poco al tocarlo
          activeOpacity={0.7}
        >
          {/* texto gris chico del botón */}
          <Text className="text-slate-500 text-xs font-inter-medium">
            {/* palabras "Ver todas" */}
            Ver todas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Estado vacío si no hay tarjetas */}
      {/* si no hay tarjetas muestra un aviso, si hay muestra la fila deslizable */}
      {tarjetas.length === 0 ? (
        <View className="mx-6 p-4 rounded-2xl border border-dashed border-slate-300 items-center justify-center">
          {/* texto gris del aviso */}
          <Text className="text-slate-400 text-xs font-inter-medium">
            {/* mensaje que invita a agregar una tarjeta */}
            No tienes tarjetas registradas. Pulsa &quot;+&quot; para agregar una.
          </Text>
        </View>
      ) : (
        /* Carrusel horizontal */
        <ScrollView
          // se desliza de lado
          horizontal
          // oculta la barrita de desplazamiento
          showsHorizontalScrollIndicator={false}
          // margen a los lados y espacio entre tarjetas
          contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }}
        >
          {/* arma una tarjeta tocable por cada tarjeta del usuario */}
          {tarjetas.map((tarjeta) => (
            <TouchableOpacity
              // nombre único de cada tarjeta
              key={tarjeta.id}
              // se aclara un poco al tocarla
              activeOpacity={0.85}
              // al tocarla, abre el detalle de esa tarjeta
              onPress={() => router.push(RUTAS.detalleTarjeta(tarjeta.id))}
              // tarjeta chica redondeada con sombra
              className="h-24 w-40 p-4 rounded-2xl justify-between overflow-hidden shadow-sm"
              // aquí se pinta la tarjeta con el color del banco
              style={{ backgroundColor: tarjeta.colorHex || COLOR_TARJETA_DEFAULT }}
            >
              {/* Círculo decorativo Figma */}
              <View className="w-16 h-16 -left-4 -top-4 absolute bg-white/10 rounded-full" />

              {/* Ícono superior; las que comparten cupo llevan además el ícono de personas */}
              <View className="flex-row justify-between items-start">
                {/* icono blanco de tarjeta */}
                <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                {/* si se comparte, muestra el icono de personas */}
                {tarjeta.compartidaCon.length > 0 && <Ionicons name="people" size={16} color="#FFFFFF" />}
              </View>

              {/* Nombre para mostrar (en las adicionales incluye su alias) */}
              <View>
                {/* texto blanco con el nombre del banco */}
                <Text
                  // solo una línea, si es largo se corta
                  numberOfLines={1}
                  // letra blanca chica
                  className="text-white text-xs font-inter-medium tracking-tight"
                >
                  {/* muestra el nombre del banco */}
                  {tarjeta.banco}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
