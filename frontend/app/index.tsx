// trae los iconos que se usan en la pantalla
import { Ionicons } from '@expo/vector-icons';
// trae React para poder armar la pantalla
import React from 'react';
// trae las piezas basicas: lista deslizable, texto, boton y caja
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
// trae los margenes seguros del celular (notch)
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// trae el carrusel que muestra las tarjetas
import HomeCardsCarousel from '../components/CarruselTarjetas';
// trae la seccion de suscripciones del inicio
import HomeSuscripciones from '../components/HomeSuscripciones';
// trae la tarjeta grande con el resumen del inicio
import HomeCard from '../components/HomeTarjeta';
// trae el menu de abajo para moverse entre pantallas
import BottomNavigation from '../components/MenuNavegacion';
// trae la funcion que pregunta "¿estas seguro?"
import { confirmar } from '../constants/alertas';
// trae los datos de la sesion del usuario
import { useSesion } from '../context/SesionContext';

// pantalla de inicio de la app
export default function Index() {
  // insets.top es el alto del notch / barra de estado
  const insets = useSafeAreaInsets();
  // saca el usuario y la funcion para cerrar sesion
  const { usuario, cerrarSesion } = useSesion();
  // solo el primer nombre en el saludo: "Tomás Paris" queda "Tomás"
  const primerNombre = usuario?.nombre.split(' ')[0] ?? '';

  // se ejecuta al tocar el boton de salir
  const confirmarSalida = () => {
    // muestra un aviso preguntando si de verdad quiere salir
    confirmar({
      // titulo del aviso
      titulo: 'Cerrar sesión',
      // texto que explica el aviso
      mensaje: '¿Quieres salir de tu cuenta? Tus datos quedan guardados para la próxima vez.',
      // texto del boton para aceptar
      textoConfirmar: 'Cerrar sesión',
      // si acepta, se cierra la sesion
      onConfirmar: cerrarSesion,
    });
  };

  // lo que se ve en la pantalla
  return (
    // caja que ocupa toda la pantalla
    <View
      // fondo con el color de la app y ocupa todo el alto
      className="flex-1 bg-bg-color"
      // baja el contenido para no tapar el notch
      style={{ paddingTop: insets.top }}
    >
      {/* zona que se puede deslizar hacia abajo */}
      <ScrollView
        // ocupa todo el espacio libre
        className="flex-1"
        // esconde la barrita de desplazamiento
        showsVerticalScrollIndicator={false}
      >
        {/* fila del saludo con el nombre del usuario y el boton para cerrar sesion */}
        <View className="w-full px-6 pt-8 pb-4 flex-row justify-between items-center">
          {/* saludo grande en negrita con el nombre del usuario */}
          <Text className="text-color-menu text-xl font-inter-bold">
            Hola, {primerNombre} 👋
          </Text>
          {/* boton redondo para cerrar sesion */}
          <TouchableOpacity
            // al tocarlo pregunta si quiere salir
            onPress={confirmarSalida}
            // circulo blanco con borde gris y el icono al centro
            className="w-10 h-10 rounded-full bg-white border border-slate-200 items-center justify-center"
            // nombre del boton para lectores de pantalla
            accessibilityLabel="Cerrar sesión"
          >
            {/* icono de puerta de salida */}
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
