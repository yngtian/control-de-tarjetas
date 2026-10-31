// iconos de Ionicons
import { Ionicons } from '@expo/vector-icons';
// usePathname da la ruta actual, useRouter sirve para navegar
import { usePathname, useRouter } from 'expo-router';
// trae React y la forma de recordar datos en la pantalla
import React, { useState } from 'react';
// trae las piezas para armar la ventana, botones, textos y cajas
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
// para saber cuanto mide la barra de gestos del celular
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// trae las direcciones de cada pantalla de la app
import { RUTAS } from '../constants/rutas';

// tipo que solo acepta nombres de iconos que existen
type NombreIcono = React.ComponentProps<typeof Ionicons>['name'];

/* ============================================================
   Menú de acciones del botón "+"
   ============================================================ */

// Opciones que se muestran al tocar el botón "+" (la primera va destacada)
const ACCIONES: {
  // pantalla a la que lleva la opción
  ruta: string;
  // icono de la opción
  icono: NombreIcono;
  // título en negrita de la opción
  titulo: string;
  // texto chico de explicación
  detalle: string;
  // si va pintada de color para resaltar
  destacada: boolean;
}[] = [
  // opción para registrar una compra
  {
    // lleva a la pantalla de nueva transacción
    ruta: RUTAS.registrarTransaccion,
    // icono de boleta
    icono: 'receipt-outline',
    // título de la opción
    titulo: 'Nueva transacción',
    // explicación de la opción
    detalle: 'Registra una compra o cargo en cuotas',
    // esta va resaltada
    destacada: true,
  },
  // opción para registrar una suscripción
  {
    // lleva a la pantalla de nueva suscripción
    ruta: RUTAS.registrarSuscripcion,
    // icono de flechas que se repiten
    icono: 'repeat-outline',
    // título de la opción
    titulo: 'Nueva suscripción',
    // explicación de la opción
    detalle: 'Netflix, Spotify y otros cobros mensuales',
    // esta no va resaltada
    destacada: false,
  },
  // opción para agregar una tarjeta
  {
    // lleva a la pantalla de nueva tarjeta
    ruta: RUTAS.registrarTarjeta,
    // icono de tarjeta
    icono: 'card-outline',
    // título de la opción
    titulo: 'Nueva tarjeta',
    // explicación de la opción
    detalle: 'Agrega una tarjeta de crédito',
    // esta no va resaltada
    destacada: false,
  },
];

// datos que recibe el menú del botón "+"
interface MenuAccionesProps {
  // si el menú se ve o no
  visible: boolean;
  // qué hacer al cerrar el menú
  onCerrar: () => void;
  // qué hacer al elegir una opción
  onElegir: (ruta: string) => void;
}

/** Bottom sheet con las acciones de registro. */
// menú que sube desde abajo con las opciones para registrar
function MenuAcciones({ visible, onCerrar, onElegir }: MenuAccionesProps) {
  // mide el espacio de la barra de gestos del celular
  const insets = useSafeAreaInsets();

  // devuelve lo que se ve en pantalla
  return (
    // ventana que aparece deslizándose desde abajo
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      {/* fondo oscuro semitransparente: al tocarlo se cierra el menú */}
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onCerrar}>
        {/* Pressable interno evita que tocar el sheet lo cierre */}
        <Pressable
          // panel claro con esquinas de arriba redondeadas
          className="bg-slate-50 rounded-t-3xl px-6 pt-3"
          // deja espacio abajo para la barra de gestos
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
          // al tocar el panel no hace nada (así no se cierra)
          onPress={() => {}}
        >
          {/* Barra de arrastre decorativa */}
          <View className="self-center w-10 h-1 rounded-full bg-slate-300 mb-4" />

          {/* fila con el título y el botón de cerrar */}
          <View className="flex-row items-center justify-between pb-4">
            {/* título del menú en negrita */}
            <Text className="text-slate-800 text-lg font-inter-bold">¿Qué quieres registrar?</Text>
            {/* botón para cerrar el menú */}
            <TouchableOpacity onPress={onCerrar}>
              {/* icono de la X */}
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {/* arma un botón por cada opción del menú */}
          {ACCIONES.map((a) => (
            <TouchableOpacity
              // nombre único de cada opción
              key={a.ruta}
              // al tocarla, va a esa pantalla
              onPress={() => onElegir(a.ruta)}
              // se aclara un poco al tocarla
              activeOpacity={0.85}
              // tarjeta redondeada: la destacada va de color, las otras blancas
              className={`p-4 mb-3 rounded-2xl flex-row items-center border shadow-sm ${
                a.destacada ? 'bg-color-action border-color-action' : 'bg-white border-slate-100'
              }`}
            >
              {/* cuadradito donde va el icono */}
              <View
                // cuadradito redondeado: transparente en la destacada, gris en las otras
                className={`w-11 h-11 rounded-xl items-center justify-center mr-3 ${
                  a.destacada ? 'bg-white/20' : 'bg-slate-100'
                }`}
              >
                {/* icono de la opción: blanco si es destacada, oscuro si no */}
                <Ionicons name={a.icono} size={22} color={a.destacada ? '#FFFFFF' : '#1E293B'} />
              </View>
              {/* caja con el título y la explicación */}
              <View className="flex-1">
                {/* título en negrita: blanco si es destacada */}
                <Text className={`text-base font-inter-bold ${a.destacada ? 'text-white' : 'text-slate-900'}`}>
                  {/* muestra el título de la opción */}
                  {a.titulo}
                </Text>
                {/* explicación chica: blanca suave o gris */}
                <Text className={`text-xs font-inter-regular ${a.destacada ? 'text-white/80' : 'text-slate-400'}`}>
                  {/* muestra la explicación de la opción */}
                  {a.detalle}
                </Text>
              </View>
              {/* flechita a la derecha */}
              <Ionicons name="chevron-forward" size={18} color={a.destacada ? '#FFFFFF' : '#CBD5E1'} />
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ============================================================
   Barra de navegación inferior
   ============================================================ */

// datos que recibe cada botón de la barra de abajo
interface ItemNavProps {
  // icono normal del botón
  icono: NombreIcono;
  // icono relleno cuando estamos en esa pantalla
  iconoActivo?: NombreIcono; // Variante rellena cuando el ítem está activo (ej: home)
  // texto chico debajo del icono
  etiqueta: string;
  // si es la pantalla en la que estamos
  activo?: boolean;
  // qué hacer al tocar el botón
  onPress?: () => void;     // Sin onPress = sección aún no disponible
}

/** Un botón de la barra: ícono + etiqueta, blanco si es la pantalla actual. */
// botón de la barra de abajo
function ItemNav({ icono, iconoActivo, etiqueta, activo = false, onPress }: ItemNavProps) {
  // devuelve lo que se ve en pantalla
  return (
    // botón tocable que ocupa su parte de la barra
    <TouchableOpacity onPress={onPress} className="items-center justify-center flex-1 py-1">
      {/* icono del botón */}
      <Ionicons
        // usa el icono relleno si estamos en esa pantalla
        name={activo && iconoActivo ? iconoActivo : icono}
        // tamaño del icono
        size={22}
        // blanco si estamos en esa pantalla, gris si no
        color={activo ? '#FFFFFF' : '#94A3B8'}
      />
      {/* texto chico debajo del icono: blanco si está activo, gris si no */}
      <Text className={`${activo ? 'text-white' : 'text-color-inactive'} text-[10px] font-inter-regular mt-1`}>
        {/* muestra el nombre del botón */}
        {etiqueta}
      </Text>
    </TouchableOpacity>
  );
}

// barra de navegación de abajo de la app
export default function BottomNavigation() {
  // trae la herramienta para cambiar de pantalla
  const router = useRouter();
  // ruta en la que estamos, ej: "/" o "/Tarjetas"
  const pathname = usePathname();
  // mide el espacio de la barra de gestos del celular
  const insets = useSafeAreaInsets();
  // recuerda si el menú del botón "+" está abierto
  const [menuAbierto, setMenuAbierto] = useState(false);

  // El ítem activo se pinta de blanco según la ruta actual
  const activo = (ruta: string) => pathname.toLowerCase() === ruta.toLowerCase();

  // cierra el menú y va a la pantalla elegida
  const irA = (ruta: string) => {
    // cierra el menú del botón "+"
    setMenuAbierto(false);
    // abre la pantalla elegida
    router.push(ruta as any);
  };

  // devuelve lo que se ve en pantalla
  return (
    // agrupa la barra y el menú sin agregar una caja extra
    <>
      {/* barra oscura de abajo con esquinas de arriba redondeadas */}
      <View
        // barra ancha oscura con los botones repartidos en fila
        className="w-full bg-color-menu rounded-t-3xl flex-row justify-around items-center px-2 pt-2"
        // deja espacio abajo para la barra de gestos
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        {/* botón de Inicio */}
        <ItemNav
          // icono de casita
          icono="home-outline"
          // casita rellena cuando estamos en Inicio
          iconoActivo="home"
          // texto del botón
          etiqueta="Inicio"
          // se pinta blanco si estamos en Inicio
          activo={activo(RUTAS.inicio)}
          // al tocarlo, va a Inicio
          onPress={() => router.replace(RUTAS.inicio)}
        />
        {/* botón de Suscripciones */}
        <ItemNav
          // icono de flechas que se repiten
          icono="repeat-outline"
          // texto del botón
          etiqueta="Suscripciones"
          // se pinta blanco si estamos en Suscripciones
          activo={activo(RUTAS.suscripciones)}
          // al tocarlo, va a Suscripciones
          onPress={() => router.replace(RUTAS.suscripciones)}
        />

        {/* Botón flotante central (+): abre el menú de acciones */}
        <View className="items-center justify-center flex-1">
          {/* botón redondo verde del "+" */}
          <TouchableOpacity
            // al tocarlo, abre el menú
            onPress={() => setMenuAbierto(true)}
            // círculo de color que sobresale hacia arriba de la barra
            className="w-14 h-14 -mt-8 bg-color-action rounded-full items-center justify-center border-4 border-bg-color shadow-lg"
            // se aclara un poco al tocarlo
            activeOpacity={0.8}
          >
            {/* icono blanco del "+" */}
            <Ionicons name="add" size={32} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* botón de Tarjetas */}
        <ItemNav
          // icono de tarjeta
          icono="card-outline"
          // texto del botón
          etiqueta="Tarjetas"
          // se pinta blanco si estamos en Tarjetas
          activo={activo(RUTAS.tarjetas)}
          // al tocarlo, va a Tarjetas
          onPress={() => router.replace(RUTAS.tarjetas)}
        />
        {/* botón de Proyecciones */}
        <ItemNav
          // icono de gráfico que sube
          icono="trending-up-outline"
          // gráfico relleno cuando estamos en Proyecciones
          iconoActivo="trending-up"
          // texto del botón
          etiqueta="Proyecciones"
          // se pinta blanco si estamos en Proyecciones
          activo={activo(RUTAS.proyecciones)}
          // al tocarlo, va a Proyecciones
          onPress={() => router.replace(RUTAS.proyecciones)}
        />
      </View>

      {/* menú del botón "+" que sube desde abajo */}
      <MenuAcciones visible={menuAbierto} onCerrar={() => setMenuAbierto(false)} onElegir={irA} />
    </>
  );
}
