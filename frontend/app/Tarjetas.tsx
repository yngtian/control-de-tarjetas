// trae los iconos que se usan en la pantalla
import { Ionicons } from '@expo/vector-icons';
// trae la funcion para moverse entre pantallas
import { useRouter } from 'expo-router';
// trae React para poder armar la pantalla
import React from 'react';
// componentes basicos de react native
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
// para respetar el espacio del notch
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// trae el menu de abajo para moverse entre pantallas
import BottomNavigation from '../components/MenuNavegacion';
// tarjeta chica que se muestra en la lista
import TarjetaMini from '../components/TarjetaMini';
// trae los datos guardados de la app (tarjetas, compras)
import { useApp } from '../context/AppContext';

// pantalla con la lista de todas las tarjetas
export default function TarjetasScreen() {
  // margenes seguros del celular
  const insets = useSafeAreaInsets();
  // sirve para ir a otras pantallas
  const router = useRouter();
  // sacamos la lista de tarjetas del contexto (ya viene con cupo disponible y monto calculados)
  const { tarjetas } = useApp();

  // lo que se ve en la pantalla
  return (
    // contenedor de la pantalla, bajado lo que mide el notch
    <View className="flex-1 bg-bg-color" style={{ paddingTop: insets.top }}>
      {/* Encabezado con retorno a Inicio */}
      {/* fila con espacio a los lados: flecha a la izquierda y titulo al centro */}
      <View className="px-6 pt-6 pb-4 flex-row items-center justify-between">
        {/* boton de flecha que vuelve al inicio */}
        <TouchableOpacity onPress={() => router.replace('/')} className="w-8">
          {/* icono de flecha hacia atras gris oscuro */}
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        {/* titulo "Tarjetas" en gris oscuro y negrita */}
        <Text className="text-slate-800 text-lg font-inter-bold">Tarjetas</Text>
        {/* caja vacia para que el titulo quede centrado */}
        <View className="w-8" />
      </View>

      {/* lista que se puede deslizar */}
      <ScrollView className="flex-1 px-6 pt-2" showsVerticalScrollIndicator={false}>
        {/* subtitulo chico en gris, negrita y con letras separadas */}
        <Text className="text-slate-500 text-sm font-inter-bold tracking-wider mb-5">
          TARJETAS DE CRÉDITO
        </Text>

        {/* si no hay tarjetas mostramos un aviso, si hay las recorremos con map */}
        {/* ojo: el lint marca error por las comillas de "+" en el texto del aviso, se arregla escribiendolas como {'"+"'} */}
        {tarjetas.length === 0 ? (
          <View className="p-6 rounded-2xl border border-dashed border-slate-300 items-center justify-center mt-4">
            {/* texto gris claro que explica como agregar una tarjeta */}
            <Text className="text-slate-400 text-sm font-inter-medium">
              No tienes tarjetas registradas. Pulsa &quot;+&quot; abajo para agregar una.
            </Text>
          </View>
        ) : (
          // por cada tarjeta armamos un boton con su tarjeta chica adentro
          tarjetas.map((t) => (
            <TouchableOpacity
              // identificador unico de cada tarjeta en la lista
              key={t.id}
              // se oscurece un poquito al tocarla
              activeOpacity={0.88}
              // al tocarla abre el detalle de esa tarjeta
              onPress={() => router.push(`../detalle-tarjeta/${t.id}`)}
            >
              {/* dibuja la tarjeta chica con sus datos */}
              <TarjetaMini item={t} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* menu fijo abajo */}
      <BottomNavigation />
    </View>
  );
}
