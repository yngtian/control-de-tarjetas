// trae los iconos que se usan en la pantalla
import { Ionicons } from '@expo/vector-icons';
// trae las funciones para leer la ruta y moverse entre pantallas
import { useLocalSearchParams, useRouter } from 'expo-router';
// trae React y el tipo para lo que va dentro de una fila
import React, { ReactNode } from 'react';
// trae las piezas basicas: lista deslizable, texto, boton y caja
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

// trae el marco comun de las pantallas de formulario
import PantallaFormulario from '../../components/PantallaFormulario';
// trae la funcion que da un color segun el nombre del servicio
import { colorSuscripcion } from '../../components/SuscripcionFila';
// trae las funciones para avisar sin internet y preguntar
import { avisarSinConexion, confirmar } from '../../constants/alertas';
// trae la funcion que escribe el mes con su año
import { nombreMesConAnio } from '../../constants/fechas';
// trae la funcion que escribe montos en pesos chilenos
import { formatearCLP } from '../../constants/formato';
// trae las direcciones de las pantallas de la app
import { RUTAS } from '../../constants/rutas';
// trae el tipo de suscripcion y los datos guardados de la app
import { SuscripcionItem, useApp } from '../../context/AppContext';

/** Una fila "etiqueta · valor" de la ficha. */
// recibe el titulo, lo que va a la derecha y si es la ultima fila
function Fila({ etiqueta, children, ultima = false }: { etiqueta: string; children: ReactNode; ultima?: boolean }) {
  // dibuja la fila
  return (
    // fila con titulo a la izquierda y valor a la derecha; linea gris abajo salvo la ultima
    <View className={`flex-row items-center justify-between py-3 ${ultima ? '' : 'border-b border-slate-100'}`}>
      {/* titulo de la fila en gris claro */}
      <Text className="text-slate-400 text-sm font-inter-medium">{etiqueta}</Text>
      {/* valor de la fila, pegado a la derecha */}
      <View className="flex-1 items-end pl-4">{children}</View>
    </View>
  );
}

/** Cómo va el pago: al día, por pagar este mes o con meses atrasados. */
function estadoDePago(s: SuscripcionItem) {
  // si no debe ningun mes
  if (s.mesesPorPagar === 0) {
    // dice "Al día" en verde con la fecha del proximo cobro
    return { texto: 'Al día', detalle: `Próximo cobro el ${s.proximoCobro}`, fondo: 'bg-emerald-50', color: 'text-emerald-700' };
  }
  // si debe solo este mes
  if (s.mesesPorPagar === 1) {
    // devuelve el aviso en color amarillo
    return {
      // texto principal del aviso
      texto: 'Por pagar este mes',
      // monto a pagar y cuanto falta
      detalle: `${formatearCLP(s.montoPorPagar)} · ${s.textoRestante.toLowerCase()}`,
      // fondo amarillo claro
      fondo: 'bg-amber-50',
      // letra amarilla oscura
      color: 'text-amber-700',
    };
  }
  // si debe varios meses, devuelve el aviso en rojo
  return {
    // cuantos meses debe
    texto: `${s.mesesPorPagar} meses por pagar`,
    // cuanto suma lo que debe
    detalle: `${formatearCLP(s.montoPorPagar)} acumulados`,
    // fondo rojo claro
    fondo: 'bg-red-50',
    // letra roja oscura
    color: 'text-red-700',
  };
}

// pantalla con el detalle de una suscripcion
export default function DetalleSuscripcionScreen() {
  // saca el id que viene en la ruta, ej: /detalle-suscripcion/1727630000000
  const { id } = useLocalSearchParams<{ id: string }>();
  // sirve para ir a otras pantallas
  const router = useRouter();
  // saca las suscripciones, las tarjetas y la funcion para borrar
  const { suscripciones, tarjetas, eliminarSuscripcion } = useApp();
  // busca la suscripcion que tiene ese id
  const suscripcion = suscripciones.find((s) => s.id === id);

  // si no la encontro (por ejemplo se acaba de eliminar) muestra un aviso
  if (!suscripcion) {
    // muestra una pantalla simple con el aviso
    return (
      // caja blanca que ocupa todo, con el contenido al centro
      <View className="flex-1 bg-white items-center justify-center p-6">
        {/* texto gris que dice que no se encontro */}
        <Text className="text-slate-600 text-base mb-4">Suscripción no encontrada.</Text>
        {/* boton para volver a la lista de suscripciones */}
        <TouchableOpacity
          // al tocarlo va a la lista de suscripciones
          onPress={() => router.replace(RUTAS.suscripciones)}
          // boton con color principal y esquinas redondeadas
          className="px-5 py-2.5 bg-color-action rounded-xl">
          {/* texto blanco en negrita del boton */}
          <Text className="text-white font-inter-bold">Volver a Suscripciones</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // nombre corto para la suscripcion encontrada
  const s = suscripcion;
  // calcula si esta al dia, por pagar o atrasada
  const estado = estadoDePago(s);
  // busca la tarjeta donde se cobra
  const tarjeta = tarjetas.find((t) => t.id === s.tarjetaId);

  // se ejecuta al tocar "Eliminar suscripción"
  const confirmarEliminar = () => {
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
        // pide al servidor borrar la suscripcion
        const { resultado } = await eliminarSuscripcion(s.id);
        // si no hay internet, avisa
        if (resultado === 'sin_conexion') return avisarSinConexion();
        // vuelve a la pantalla anterior
        router.back();
      },
    });
  };

  // lo que se ve en la pantalla
  return (
    // marco de formulario con titulo y flecha para volver atras
    <PantallaFormulario titulo="Detalle Suscripción" onVolver={() => router.back()}>
      {/* zona deslizable con espacio a los lados y arriba */}
      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
        {/* Resumen: servicio, plan y precio */}
        {/* caja oscura con esquinas muy redondeadas y sombra */}
        <View className="w-full p-6 relative bg-color-menu rounded-3xl overflow-hidden shadow-lg mb-5">
          {/* circulo blanco transparente de adorno en la esquina */}
          <View className="w-40 h-40 -right-10 -top-10 absolute bg-white/5 rounded-full" />

          {/* fila con el cuadrito de color y el nombre del servicio */}
          <View className="flex-row items-center z-10">
            {/* cuadrito con esquinas redondeadas para la inicial */}
            <View
              // tamaño y forma del cuadrito
              className="w-12 h-12 rounded-xl items-center justify-center mr-3"
              // lo pinta con un color segun el nombre
              style={{ backgroundColor: colorSuscripcion(s.nombre) }}
            >
              {/* primera letra del nombre en blanco y mayuscula */}
              <Text className="text-white text-lg font-inter-bold">{s.nombre.charAt(0).toUpperCase()}</Text>
            </View>
            {/* caja con nombre y plan, ocupa el resto del ancho */}
            <View className="flex-1">
              {/* nombre del servicio en blanco y negrita */}
              <Text className="text-white text-lg font-inter-bold" numberOfLines={1}>{s.nombre}</Text>
              {/* plan en gris claro; si no tiene dice "Plan mensual" */}
              <Text className="text-color-inactive text-sm font-inter-regular" numberOfLines={1}>
                {s.plan || 'Plan mensual'}
              </Text>
            </View>
          </View>

          {/* fila con el precio */}
          <View className="flex-row items-baseline mt-5 z-10">
            {/* precio grande en blanco */}
            <Text className="text-white text-4xl font-inter-bold tracking-tight">{formatearCLP(s.monto)}</Text>
            {/* texto chico "/mes" al lado del precio */}
            <Text className="text-color-inactive text-sm font-inter-regular"> /mes</Text>
          </View>

          {/* fila con dos etiquetas redondeadas */}
          <View className="flex-row flex-wrap gap-2 mt-3 z-10">
            {/* etiqueta con borde blanco suave */}
            <View className="px-4 py-1.5 rounded-full border border-white/10">
              {/* cuanto se gasta en un año */}
              <Text className="text-slate-300 text-xs font-inter-medium">{formatearCLP(s.monto * 12)} al año</Text>
            </View>
            {/* etiqueta con borde blanco suave */}
            <View className="px-4 py-1.5 rounded-full border border-white/10">
              {/* dia del mes en que se cobra */}
              <Text className="text-slate-300 text-xs font-inter-medium">Se cobra el día {s.diaCobro}</Text>
            </View>
          </View>
        </View>

        {/* Estado del pago */}
        {/* caja redondeada con fondo verde, amarillo o rojo segun el estado */}
        <View className={`flex-row items-center p-4 mb-5 rounded-2xl ${estado.fondo}`}>
          {/* icono del estado */}
          <Ionicons
            // check si esta al dia, reloj si debe
            name={s.mesesPorPagar === 0 ? 'checkmark-circle-outline' : 'time-outline'}
            // tamaño del icono
            size={22}
            // verde si esta al dia, amarillo si debe un mes, rojo si debe mas
            color={s.mesesPorPagar === 0 ? '#047857' : s.mesesPorPagar === 1 ? '#B45309' : '#B91C1C'}
          />
          {/* caja con los textos del estado */}
          <View className="flex-1 ml-3">
            {/* texto principal del estado en negrita */}
            <Text className={`text-sm font-inter-bold ${estado.color}`}>{estado.texto}</Text>
            {/* detalle del estado en letra chica */}
            <Text className={`text-xs font-inter-regular ${estado.color}`}>{estado.detalle}</Text>
          </View>
        </View>

        {/* Ficha */}
        {/* caja blanca con borde, esquinas redondeadas y sombra suave */}
        <View className="px-4 bg-white rounded-2xl border border-slate-100 shadow-sm mb-5">
          {/* fila del proximo cobro */}
          <Fila etiqueta="Próximo cobro">
            {/* fecha del proximo cobro en negrita */}
            <Text className="text-slate-900 text-sm font-inter-bold">{s.proximoCobro}</Text>
            {/* cuanto falta para el cobro, en gris */}
            <Text className="text-slate-400 text-xs font-inter-regular">{s.textoRestante}</Text>
          </Fila>
          {/* fila de la tarjeta donde se cobra */}
          <Fila etiqueta="Tarjeta">
            {/* fila con el color y el nombre del banco */}
            <View className="flex-row items-center">
              {/* circulito pintado con el color de la tarjeta */}
              <View className="w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: s.tarjetaColor }} />
              {/* nombre del banco en negrita */}
              <Text className="text-slate-900 text-sm font-inter-bold" numberOfLines={1}>{s.tarjetaBanco}</Text>
            </View>
          </Fila>
          {/* si se sabe quien la agrego, muestra esa fila */}
          {s.autor && (
            <Fila etiqueta="Agregada por">
              {/* nombre de quien la agrego */}
              <Text className="text-slate-900 text-sm font-inter-bold">{s.autor}</Text>
            </Fila>
          )}
          {/* fila con el mes en que empezo */}
          <Fila etiqueta="Activa desde">
            {/* mes de inicio o "Sin registro" si no se sabe */}
            <Text className="text-slate-900 text-sm font-inter-bold">
              {s.mesInicio ? nombreMesConAnio(s.mesInicio) : 'Sin registro'}
            </Text>
          </Fila>
          {/* ultima fila, sin linea abajo, con el gasto del año */}
          <Fila etiqueta="Gasto anual" ultima>
            {/* monto mensual por 12 */}
            <Text className="text-slate-900 text-sm font-inter-bold">{formatearCLP(s.monto * 12)}</Text>
          </Fila>
        </View>

        {/* Cómo se paga: junto con la tarjeta */}
        {/* texto chico gris que explica como se paga */}
        <Text className="text-slate-400 text-xs font-inter-regular mb-3">
          La suscripción se paga junto con {s.tarjetaBanco}, al registrar el pago del mes de esa tarjeta.
        </Text>

        {/* si la tarjeta existe, muestra un boton para verla */}
        {tarjeta && (
          <TouchableOpacity
            // al tocarlo abre el detalle de la tarjeta
            onPress={() => router.push(RUTAS.detalleTarjeta(tarjeta.id))}
            // se aclara un poco al tocarlo
            activeOpacity={0.8}
            // boton ancho blanco con borde gris y esquinas redondeadas
            className="w-full h-12 mb-3 rounded-2xl items-center justify-center flex-row gap-2 bg-white border border-slate-300"
          >
            {/* icono de tarjeta gris oscuro */}
            <Ionicons name="card-outline" size={20} color="#0F172A" />
            {/* texto del boton en negrita */}
            <Text className="text-slate-900 text-base font-inter-bold">Ver tarjeta</Text>
          </TouchableOpacity>
        )}

        {/* si puede borrarla, muestra el boton para eliminar */}
        {s.editable && (
        <TouchableOpacity
          // al tocarlo pregunta si quiere borrarla
          onPress={confirmarEliminar}
          // se aclara un poco al tocarlo
          activeOpacity={0.8}
          // boton ancho blanco con borde gris y esquinas redondeadas
          className="w-full h-12 mb-8 rounded-2xl items-center justify-center flex-row gap-2 bg-white border border-slate-300"
        >
          {/* icono rojo de basurero */}
          <Ionicons name="trash-outline" size={20} color="#DC2626" />
          {/* texto rojo en negrita del boton */}
          <Text className="text-red-600 text-base font-inter-bold">Eliminar suscripción</Text>
        </TouchableOpacity>
        )}
      </ScrollView>
    </PantallaFormulario>
  );
}
