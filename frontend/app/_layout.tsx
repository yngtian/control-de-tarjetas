// Stack hace que las pantallas se apilen una encima de otra al navegar
import { Stack } from "expo-router";
// da los margenes seguros del celular (notch arriba y barra de gestos abajo)
import { SafeAreaProvider } from "react-native-safe-area-context";
// el provider que guarda las tarjetas y las compras para toda la app
import { AppProvider } from "../context/AppContext";
// la sesion del usuario: sin sesion se muestra la pantalla de acceso
import PantallaAcceso from "../components/PantallaAcceso";
import PantallaConexion from "../components/PantallaConexion";
import { SesionProvider, useSesion } from "../context/SesionContext";
// carga los estilos de tailwind, sin esto los className no hacen nada
import "../global.css";


// las 3 variantes de la letra Inter que usamos y el hook para cargarlas
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
// para manejar la pantalla de carga que sale al abrir la app
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

export default function RootLayout() {
  // 1. Cargamos las fuentes en memoria
  // carga las fuentes: fontsLoaded pasa a true cuando terminan y error trae algo si fallan
  const [fontsLoaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });

  // 2. Ocultamos el Splash Screen cuando las fuentes terminen de cargar

  // se vuelve a ejecutar cada vez que cambia fontsLoaded o error
  useEffect(() => {
    // si ya cargaron o si fallaron, escondemos la pantalla de carga
    if (fontsLoaded || error) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, error]);

  // 3. Si aún no cargan las fuentes, no renderizamos nada para evitar errores
  // si las fuentes todavia no cargan no dibujamos nada, asi el texto no aparece con otra letra y despues salta
  if (!fontsLoaded && !error) {
    return null;
  }

  return (
    // envuelve todo para que cualquier pantalla pueda pedir los margenes seguros
    <SafeAreaProvider>
      <SesionProvider>
        <AppConSesion />
      </SesionProvider>
    </SafeAreaProvider>
  );
}

/** Sin sesión, la pantalla de acceso; con sesión, la app con los datos de ese usuario. */
function AppConSesion() {
  const { cargando, usuario } = useSesion();

  // revisando la sesion guardada al abrir la app
  if (cargando) return <PantallaConexion error={false} onReintentar={() => {}} />;
  if (!usuario) return <PantallaAcceso />;

  return (
    // AppProvider: estado global (tarjetas, transacciones, suscripciones) del usuario con sesion.
    // La key lo reinicia al cambiar de usuario, asi nunca se ven datos de la cuenta anterior
    <AppProvider key={usuario.uid}>
      {/* headerShown en false esconde la barra de titulo de expo, cada pantalla dibuja la suya */}
      <Stack screenOptions={{ headerShown: false }}>
        {/* cada Stack.Screen corresponde a un archivo dentro de la carpeta app */}
        <Stack.Screen name="index" />
        <Stack.Screen name="Tarjetas" />
        <Stack.Screen name="RegistrarTarjeta" />
        <Stack.Screen name="RegistrarTransaccion" />
        <Stack.Screen name="Suscripciones" />
        <Stack.Screen name="RegistrarSuscripcion" />
        <Stack.Screen name="Proyecciones" />
        {/* esta recibe el id de la tarjeta en la ruta, por eso el [id] */}
        <Stack.Screen name="detalle-tarjeta/[id]" />
        <Stack.Screen name="editar-tarjeta/[id]" />
        <Stack.Screen name="editar-compra/[id]" />
        <Stack.Screen name="detalle-suscripcion/[id]" />
        <Stack.Screen name="compartir-tarjeta/[id]" />
      </Stack>
    </AppProvider>
  );
}
