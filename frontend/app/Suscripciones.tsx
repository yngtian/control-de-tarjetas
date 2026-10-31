// trae los iconos que se usan en la pantalla
import { Ionicons } from '@expo/vector-icons';
// trae la funcion para moverse entre pantallas
import { useRouter } from 'expo-router';
// trae React para poder armar la pantalla
import React from 'react';
// trae las piezas basicas: lista deslizable, texto, boton y caja
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
// trae los margenes seguros del celular (notch)
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// trae la barra de arriba con flecha y titulo
import EncabezadoPantalla from '../components/EncabezadoPantalla';
// trae el menu de abajo para moverse entre pantallas
import BottomNavigation from '../components/MenuNavegacion';
// trae la fila que muestra cada suscripcion
import SuscripcionFila from '../components/SuscripcionFila';
// trae las funciones para mostrar avisos y preguntas
import { avisar, avisarSinConexion, confirmar } from '../constants/alertas';
// trae la funcion que escribe montos en pesos chilenos
import { formatearCLP } from '../constants/formato';
// trae las direcciones de las pantallas de la app
import { RUTAS } from '../constants/rutas';
// trae el tipo de suscripcion y los datos guardados de la app
import { SuscripcionItem, useApp } from '../context/AppContext';

// pantalla con la lista de suscripciones
export default function SuscripcionesScreen() {
  // margenes seguros del celular
  const insets = useSafeAreaInsets();
  // sirve para ir a otras pantallas
  const router = useRouter();
  // saca las suscripciones, su total mensual y la funcion para borrarlas
  const { suscripciones, totalSuscripciones, eliminarSuscripcion } = useApp();

  // La suscripción con el cobro más cercano (la lista ya viene ordenada)
  // toma la primera de la lista
  const proxima = suscripciones[0];

  // se ejecuta al tocar borrar en una suscripcion
  const confirmarEliminar = (s: SuscripcionItem) => {
    // En una tarjeta compartida, solo quien la agregó (o el dueño de la tarjeta) la elimina
    if (!s.editable) {
      // avisa que no puede borrarla porque es de otra persona
      return avisar('Suscripción de otra persona', `Solo ${s.autor} o el dueño de la tarjeta pueden eliminarla.`);
    }
    // pregunta si de verdad quiere borrarla
    confirmar({
      // titulo del aviso
      titulo: 'Eliminar suscripción',
      // texto del aviso con el nombre de la suscripcion
      mensaje: `¿Quieres eliminar ${s.nombre}? Dejará de sumarse a tu gasto mensual.`,
      // texto del boton para aceptar
      textoConfirmar: 'Eliminar',
      // pinta el boton de rojo porque borra algo
      destructivo: true,
      // si acepta, se borra la suscripcion
      onConfirmar: async () => {
        // borra y, si no hay internet, avisa que no se pudo
        if ((await eliminarSuscripcion(s.id)).resultado === 'sin_conexion') avisarSinConexion();
      },
    });
  };

  // lo que se ve en la pantalla
  return (
    // caja que ocupa toda la pantalla, bajada lo que mide el notch
    <View className="flex-1 bg-bg-color" style={{ paddingTop: insets.top }}>
      {/* barra de arriba con titulo y flecha que vuelve al inicio */}
      <EncabezadoPantalla titulo="Suscripciones" onVolver={() => router.replace(RUTAS.inicio)} />

      {/* zona deslizable con espacio a los lados */}
      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        {/* Resumen: total de todas las suscripciones activas (estén pagadas o no este mes) */}
        {/* caja oscura con esquinas muy redondeadas y sombra */}
        <View className="w-full p-6 relative bg-color-menu rounded-3xl overflow-hidden shadow-lg mb-5">
          {/* circulo blanco transparente de adorno en la esquina */}
          <View className="w-40 h-40 -right-10 -top-10 absolute bg-white/5 rounded-full" />

          {/* grupo con el titulo y el monto, encima del adorno */}
          <View className="gap-1 z-10">
            {/* texto chico gris claro */}
            <Text className="text-color-inactive text-sm font-inter-regular tracking-tight">
              Gasto mensual en suscripciones
            </Text>
            {/* monto total grande en blanco y negrita */}
            <Text className="text-white text-4xl font-inter-bold tracking-tight">
              {formatearCLP(totalSuscripciones)}
            </Text>
          </View>

          {/* fila con dos etiquetas redondeadas */}
          <View className="flex-row gap-2 mt-3 z-10">
            {/* etiqueta con borde blanco suave */}
            <View className="px-4 py-1.5 rounded-full border border-white/10">
              {/* cuantas suscripciones activas hay */}
              <Text className="text-slate-300 text-xs font-inter-medium">
                {suscripciones.length} activa{suscripciones.length === 1 ? '' : 's'}
              </Text>
            </View>
            {/* etiqueta con borde blanco suave */}
            <View className="px-4 py-1.5 rounded-full border border-white/10">
              {/* cuanto se gasta en un año (mes por 12) */}
              <Text className="text-slate-300 text-xs font-inter-medium">
                {formatearCLP(totalSuscripciones * 12)} al año
              </Text>
            </View>
          </View>
        </View>

        {/* Próximo cobro */}
        {/* si hay alguna suscripcion, muestra una caja azul clara con el proximo cobro */}
        {proxima && (
          <View className="flex-row items-center p-4 mb-5 bg-blue-50 border border-blue-100 rounded-2xl">
            {/* cuadrito azul con esquinas redondeadas para el icono */}
            <View className="w-9 h-9 rounded-xl bg-blue-100 items-center justify-center mr-3">
              {/* icono de calendario azul */}
              <Ionicons name="calendar-outline" size={18} color="#1D4ED8" />
            </View>
            {/* texto azul oscuro con nombre, dias que faltan y monto */}
            <Text className="flex-1 text-blue-900 text-xs font-inter-regular">
              Próximo cobro: <Text className="font-inter-bold">{proxima.nombre}</Text>{' '}
              ({proxima.textoRestante.toLowerCase()}) por{' '}
              <Text className="font-inter-bold">{formatearCLP(proxima.monto)}</Text>
            </Text>
          </View>
        )}

        {/* Botón nueva suscripción */}
        <TouchableOpacity
          // al tocarlo abre la pantalla para agregar una suscripcion
          onPress={() => router.push(RUTAS.registrarSuscripcion)}
          // se aclara un poco al tocarlo
          activeOpacity={0.8}
          // boton ancho, alto, con color principal y esquinas redondeadas
          className="w-full h-14 bg-color-action rounded-2xl flex-row items-center justify-center gap-2 shadow-sm mb-6"
        >
          {/* icono blanco de "+" en un circulo */}
          <Ionicons name="add-circle-outline" size={22} color="#FFFFFF" />
          {/* texto blanco en negrita del boton */}
          <Text className="text-white text-base font-inter-bold tracking-tight">Nueva Suscripción</Text>
        </TouchableOpacity>

        {/* Listado */}
        {/* titulo chico gris de la lista */}
        <Text className="text-slate-500 text-sm font-inter-bold tracking-wider mb-4">
          PRÓXIMOS COBROS
        </Text>

        {/* si no hay suscripciones muestra un aviso con borde punteado, si hay las lista */}
        {suscripciones.length === 0 ? (
          <View className="p-6 rounded-2xl border border-dashed border-slate-300 items-center justify-center">
            {/* texto gris claro centrado del aviso */}
            <Text className="text-slate-400 text-sm font-inter-medium text-center">
              Aún no tienes suscripciones registradas.
            </Text>
          </View>
        ) : (
          // recorre cada suscripcion para mostrarla
          suscripciones.map((s) => (
            // fila con la suscripcion, su cobro y la opcion de borrarla
            <SuscripcionFila key={s.id} item={s} mostrarCobro onEliminar={confirmarEliminar} />
          ))
        )}

        {/* espacio vacio al final de la lista */}
        <View className="h-6" />
      </ScrollView>

      {/* menu fijo abajo */}
      <BottomNavigation />
    </View>
  );
}
