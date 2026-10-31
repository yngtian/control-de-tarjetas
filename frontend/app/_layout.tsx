// Stack hace que las pantallas se apilen una encima de otra al navegar
import { Stack } from "expo-router";
// da los margenes seguros del celular (notch arriba y barra de gestos abajo)
import { SafeAreaProvider } from "react-native-safe-area-context";
// el provider que guarda las tarjetas y las compras para toda la app
import { AppProvider } from "../context/AppContext";
// la sesion del usuario: sin sesion se muestra la pantalla de acceso
import PantallaAcceso from "../components/PantallaAcceso";
// trae la pantalla de "conectando" que se ve mientras carga
import PantallaConexion from "../components/PantallaConexion";
// trae lo que guarda y revisa la sesion del usuario
import { SesionProvider, useSesion } from "../context/SesionContext";
// carga los estilos de tailwind, sin esto los className no hacen nada
import "../global.css";


// las 3 variantes de la letra Inter que usamos y el hook para cargarlas
import {
  // letra Inter normal
  Inter_400Regular,
  // letra Inter un poco mas gruesa
  Inter_500Medium,
  // letra Inter en negrita
  Inter_700Bold,
  // funcion que carga las letras al abrir la app
  useFonts,
} from '@expo-google-fonts/inter';
// para manejar la pantalla de carga que sale al abrir la app
import * as SplashScreen from 'expo-splash-screen';
// trae la funcion para hacer algo cuando un dato cambia
import { useEffect } from 'react';

// pantalla base que envuelve a toda la app
export default function RootLayout() {
  // 1. Cargamos las fuentes en memoria
  // carga las fuentes: fontsLoaded pasa a true cuando terminan y error trae algo si fallan
  const [fontsLoaded, error] = useFonts({
    // pide cargar la letra normal
    Inter_400Regular,
    // pide cargar la letra media
    Inter_500Medium,
    // pide cargar la letra negrita
    Inter_700Bold,
  });

  // 2. Ocultamos el Splash Screen cuando las fuentes terminen de cargar

  // se vuelve a ejecutar cada vez que cambia fontsLoaded o error
  useEffect(() => {
    // si ya cargaron o si fallaron, escondemos la pantalla de carga
    if (fontsLoaded || error) {
      // quita la pantalla de carga del inicio
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, error]);

  // 3. Si aún no cargan las fuentes, no renderizamos nada para evitar errores
  // si las fuentes todavia no cargan no dibujamos nada, asi el texto no aparece con otra letra y despues salta
  if (!fontsLoaded && !error) {
    // no muestra nada mientras tanto
    return null;
  }

  // dibuja la app ya con las letras listas
  return (
    // envuelve todo para que cualquier pantalla pueda pedir los margenes seguros
    <SafeAreaProvider>
      {/* guarda la sesion del usuario para todas las pantallas */}
      <SesionProvider>
        {/* decide si mostrar el acceso o la app */}
        <AppConSesion />
      </SesionProvider>
    </SafeAreaProvider>
  );
}

/** Sin sesión, la pantalla de acceso; con sesión, la app con los datos de ese usuario. */
function AppConSesion() {
  // saca si la sesion sigue cargando y quien es el usuario
  const { cargando, usuario } = useSesion();

  // revisando la sesion guardada al abrir la app
  if (cargando) return <PantallaConexion error={false} onReintentar={() => {}} />;
  // si nadie inicio sesion, muestra la pantalla para entrar
  if (!usuario) return <PantallaAcceso />;

  // si hay usuario, muestra la app con sus datos
  return (
    // AppProvider: estado global (tarjetas, transacciones, suscripciones) del usuario con sesion.
    // La key lo reinicia al cambiar de usuario, asi nunca se ven datos de la cuenta anterior
    <AppProvider key={usuario.uid}>
      {/* headerShown en false esconde la barra de titulo de expo, cada pantalla dibuja la suya */}
      <Stack screenOptions={{ headerShown: false }}>
        {/* cada Stack.Screen corresponde a un archivo dentro de la carpeta app */}
        {/* pantalla de inicio */}
        <Stack.Screen name="index" />
        {/* pantalla con la lista de tarjetas */}
        <Stack.Screen name="Tarjetas" />
        {/* pantalla para agregar una tarjeta nueva */}
        <Stack.Screen name="RegistrarTarjeta" />
        {/* pantalla para anotar una compra nueva */}
        <Stack.Screen name="RegistrarTransaccion" />
        {/* pantalla con la lista de suscripciones */}
        <Stack.Screen name="Suscripciones" />
        {/* pantalla para agregar una suscripcion nueva */}
        <Stack.Screen name="RegistrarSuscripcion" />
        {/* pantalla con lo que se pagara en los proximos meses */}
        <Stack.Screen name="Proyecciones" />
        {/* esta recibe el id de la tarjeta en la ruta, por eso el [id] */}
        <Stack.Screen name="detalle-tarjeta/[id]" />
        {/* pantalla para cambiar los datos de una tarjeta */}
        <Stack.Screen name="editar-tarjeta/[id]" />
        {/* pantalla para cambiar los datos de una compra */}
        <Stack.Screen name="editar-compra/[id]" />
        {/* pantalla con el detalle de una suscripcion */}
        <Stack.Screen name="detalle-suscripcion/[id]" />
        {/* pantalla para compartir una tarjeta con otra persona */}
        <Stack.Screen name="compartir-tarjeta/[id]" />
      </Stack>
    </AppProvider>
  );
}
