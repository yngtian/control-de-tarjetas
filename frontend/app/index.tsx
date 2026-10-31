import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeCardsCarousel from '../components/CarruselTarjetas';
import HomeSuscripciones from '../components/HomeSuscripciones';
import HomeCard from '../components/HomeTarjeta';
import BottomNavigation from '../components/MenuNavegacion';
import { confirmar } from '../constants/alertas';
import { useSesion } from '../context/SesionContext';

export default function Index() {
  // insets.top es el alto del notch / barra de estado
  const insets = useSafeAreaInsets();
  const { usuario, cerrarSesion } = useSesion();
  // solo el primer nombre en el saludo: "Tomás Paris" queda "Tomás"
  const primerNombre = usuario?.nombre.split(' ')[0] ?? '';

  const confirmarSalida = () => {
    confirmar({
      titulo: 'Cerrar sesión',
      mensaje: '¿Quieres salir de tu cuenta? Tus datos quedan guardados para la próxima vez.',
      textoConfirmar: 'Cerrar sesión',
      onConfirmar: cerrarSesion,
    });
  };

  return (
    <View
      className="flex-1 bg-bg-color"
      style={{ paddingTop: insets.top }}
    >
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
      >
        {/* fila del saludo con el nombre del usuario y el boton para cerrar sesion */}
        <View className="w-full px-6 pt-8 pb-4 flex-row justify-between items-center">
          <Text className="text-color-menu text-xl font-inter-bold">
            Hola, {primerNombre} 👋
          </Text>
          <TouchableOpacity
            onPress={confirmarSalida}
            className="w-10 h-10 rounded-full bg-white border border-slate-200 items-center justify-center"
            accessibilityLabel="Cerrar sesión"
          >
            <Ionicons name="log-out-outline" size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* Tarjeta principal home */}
        <HomeCard />

        {/* Carrusel de Mis Tarjetas */}
        <HomeCardsCarousel />

        {/* Suscripciones */}
        <HomeSuscripciones />
      </ScrollView>

      {/* Navegación inferior fija (el botón "+" registra transacciones, suscripciones y tarjetas) */}
      <BottomNavigation />
    </View>
  );
}
