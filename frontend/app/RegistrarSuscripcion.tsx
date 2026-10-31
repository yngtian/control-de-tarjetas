// trae los iconos que se usan en la pantalla
import { Ionicons } from '@expo/vector-icons';
// trae la funcion para moverse entre pantallas
import { useRouter } from 'expo-router';
// trae React y la funcion para que la pantalla recuerde datos
import React, { useState } from 'react';
// trae las piezas basicas: lista deslizable, texto, campo para escribir, boton y caja
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

// trae la caja con titulo de cada campo, su estilo y el campo para elegir
import { CampoFormulario, estiloInput, SelectorCampo } from '../components/CampoFormulario';
// trae la ventana emergente para elegir una opcion y sus filas
import ModalSeleccion, { FilaOpcion } from '../components/ModalSeleccion';
// trae el marco comun de las pantallas de formulario
import PantallaFormulario from '../components/PantallaFormulario';
// trae la funcion que da un color segun el nombre del servicio
import { colorSuscripcion } from '../components/SuscripcionFila';
// trae las funciones para mostrar avisos
import { avisar, avisarSinConexion } from '../constants/alertas';
// trae funciones para escribir montos con puntos y dejar solo numeros
import { formatearCLP, formatearMiles, soloDigitos } from '../constants/formato';
// trae los largos maximos permitidos en los campos
import { LIMITES } from '../constants/limites';
// trae las direcciones de las pantallas de la app
import { RUTAS } from '../constants/rutas';
// trae los datos guardados de la app
import { useApp } from '../context/AppContext';
// trae la revision que pide tener al menos una tarjeta
import { useRequerirTarjetas } from '../hooks/useRequerirTarjetas';

// Servicios que se pueden elegir con un toque para rellenar el nombre
const SUGERIDAS = ['Netflix', 'Spotify', 'Disney+', 'YouTube Premium', 'Amazon Prime', 'HBO Max', 'iCloud', 'ChatGPT'];

// pantalla para agregar una suscripcion nueva
export default function NuevaSuscripcionScreen() {
  // sirve para ir a otras pantallas
  const router = useRouter();
  // saca las tarjetas y la funcion que guarda la suscripcion
  const { tarjetas, agregarSuscripcion } = useApp();

  // Sin tarjetas no se puede registrar una suscripción: ofrece crear una
  useRequerirTarjetas('suscripción', RUTAS.suscripciones);

  // La tarjeta es obligatoria: por defecto, la primera registrada.
  // Se guarda solo el id y la tarjeta se busca en cada render para tener el cupo actualizado.
  const [tarjetaId, setTarjetaId] = useState<string>(tarjetas[0]?.id ?? '');
  // busca la tarjeta elegida; si no hay ninguna queda vacia
  const tarjetaSeleccionada = tarjetas.find((t) => t.id === tarjetaId) ?? null;

  // recuerda si la ventana para elegir tarjeta esta abierta
  const [modalVisible, setModalVisible] = useState(false);
  // guarda el nombre del servicio que escribe el usuario
  const [nombre, setNombre] = useState('');
  // guarda el plan que escribe el usuario
  const [plan, setPlan] = useState('');
  // guarda el monto que escribe el usuario
  const [monto, setMonto] = useState('');   // Solo dígitos; se muestra con puntos de miles
  // evita guardar dos veces mientras espera la respuesta del servidor
  const [guardando, setGuardando] = useState(false);

  // pasa el monto a numero; si esta vacio queda en 0
  const montoNumerico = parseInt(monto, 10) || 0;

  // se ejecuta al tocar "Guardar Suscripción"
  const handleGuardar = async () => {
    // si ya se esta guardando, no hace nada
    if (guardando) return;
    // si no eligio tarjeta, avisa y no guarda
    if (!tarjetaSeleccionada) return avisar('Tarjeta requerida', 'Selecciona la tarjeta a la que se cobra la suscripción.');
    // si el nombre esta vacio, avisa y no guarda
    if (!nombre.trim()) return avisar('Campo requerido', 'Ingresa el nombre del servicio.');
    // si el monto es cero, avisa y no guarda
    if (montoNumerico <= 0) return avisar('Monto inválido', 'Ingresa un monto mensual mayor a cero.');

    // El día de cobro no se pide: la suscripción se cobra el día de vencimiento de la tarjeta
    setGuardando(true);
    // manda la suscripcion al servidor para guardarla
    const { resultado, mensaje } = await agregarSuscripcion({
      // el nombre sin espacios sobrantes
      nombre: nombre.trim(),
      // el plan sin espacios sobrantes
      plan: plan.trim(),
      // el monto mensual en numero
      monto: montoNumerico,
      // la tarjeta donde se cobra
      tarjetaId: tarjetaSeleccionada.id,
    });
    // marca que termino de guardar
    setGuardando(false);

    // si no hay internet, avisa
    if (resultado === 'sin_conexion') return avisarSinConexion();
    // si el monto no cabe en el cupo de la tarjeta
    if (resultado === 'sin_cupo') {
      // avisa que no alcanza el cupo
      return avisar(
        // titulo del aviso
        'Cupo insuficiente',
        // texto con el monto y el cupo que queda
        `El monto (${formatearCLP(montoNumerico)}) supera el cupo disponible de ${tarjetaSeleccionada.banco} (${formatearCLP(tarjetaSeleccionada.cupoDisponible)}).`
      );
    }
    // si la tarjeta fue borrada, avisa
    if (resultado === 'sin_tarjeta') return avisar('Error', 'La tarjeta seleccionada ya no existe.');
    // si hubo otro error, avisa el motivo
    if (resultado !== 'ok') return avisar('Error', mensaje ?? 'No se pudo guardar la suscripción.');

    // si todo salio bien, vuelve a la lista de suscripciones
    router.replace(RUTAS.suscripciones);
  };

  // lo que se ve en la pantalla
  return (
    // marco de formulario con titulo y flecha que vuelve a suscripciones
    <PantallaFormulario titulo="Nueva Suscripción" onVolver={() => router.replace(RUTAS.suscripciones)}>
      {/* zona deslizable; deja tocar botones aunque el teclado este abierto */}
      <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Tarjeta asociada (obligatoria) */}
        <CampoFormulario etiqueta="Tarjeta asociada">
          {/* al tocarlo abre la lista de tarjetas */}
          <SelectorCampo onPress={() => setModalVisible(true)}>
            {/* si hay tarjeta elegida, muestra un circulito con su color */}
            {tarjetaSeleccionada && (
              <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: tarjetaSeleccionada.colorHex }} />
            )}
            {/* muestra el banco elegido o un texto para elegir */}
            <Text className="text-slate-900 text-sm font-inter-medium">
              {tarjetaSeleccionada ? tarjetaSeleccionada.banco : 'Selecciona una tarjeta'}
            </Text>
          </SelectorCampo>
        </CampoFormulario>

        {/* Sugerencias rápidas */}
        {/* titulo negro en negrita de los servicios sugeridos */}
        <Text className="text-black text-base font-inter-bold mb-2">Servicios populares</Text>
        {/* fila que se desliza de lado con los servicios sugeridos */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} className="mb-5 flex-grow-0">
          {/* recorre cada servicio sugerido y arma un boton */}
          {SUGERIDAS.map((n) => {
            // revisa si este servicio es el que esta escrito
            const sel = nombre === n;
            // dibuja el boton del servicio
            return (
              <TouchableOpacity
                // identificador unico de cada boton
                key={n}
                // al tocarlo, pone ese nombre en el campo
                onPress={() => setNombre(n)}
                // se aclara un poco al tocarlo
                activeOpacity={0.8}
                // pildora redondeada: oscura si esta elegida, gris clara si no
                className={`px-4 py-2 rounded-full border ${sel ? 'bg-color-menu border-color-menu' : 'bg-slate-50 border-slate-200'}`}
              >
                {/* nombre del servicio: blanco si esta elegido, gris si no */}
                <Text className={`text-xs font-inter-medium ${sel ? 'text-white' : 'text-slate-600'}`}>{n}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Nombre (con avatar de color que se actualiza al escribir) */}
        <CampoFormulario etiqueta="Servicio">
          {/* caja gris clara con borde y esquinas redondeadas, como un campo */}
          <View className="w-full h-12 px-4 bg-slate-50 border border-slate-300 rounded-xl flex-row items-center">
            {/* si ya escribio un nombre, muestra un cuadrito de color con la inicial */}
            {nombre.trim() !== '' && (
              <View
                // cuadrito chico con esquinas redondeadas
                className="w-6 h-6 rounded-md items-center justify-center mr-2"
                // lo pinta con un color segun el nombre
                style={{ backgroundColor: colorSuscripcion(nombre.trim()) }}
              >
                {/* primera letra del nombre en blanco y mayuscula */}
                <Text className="text-white text-xs font-inter-bold">{nombre.trim().charAt(0).toUpperCase()}</Text>
              </View>
            )}
            {/* caja para escribir el nombre del servicio */}
            <TextInput
              // muestra el nombre guardado
              value={nombre}
              // guarda lo que el usuario va escribiendo
              onChangeText={setNombre}
              // no deja escribir mas letras que el maximo
              maxLength={LIMITES.nombreMax}
              // texto de ejemplo cuando esta vacio
              placeholder="Ejemplo: Netflix"
              // color gris del texto de ejemplo
              placeholderTextColor="#94A3B8"
              // ocupa el resto del ancho con letra gris oscura
              className="flex-1 text-slate-800 font-inter-medium"
            />
          </View>
        </CampoFormulario>

        {/* Plan */}
        <CampoFormulario etiqueta="Plan (opcional)">
          {/* caja para escribir el plan */}
          <TextInput
            // muestra el plan guardado
            value={plan}
            // guarda lo que el usuario va escribiendo
            onChangeText={setPlan}
            // no deja escribir mas letras que el maximo
            maxLength={LIMITES.planMax}
            // texto de ejemplo cuando esta vacio
            placeholder="Ejemplo: Plan Premium"
            // color gris del texto de ejemplo
            placeholderTextColor="#94A3B8"
            // aplica el estilo comun de los campos
            className={estiloInput()}
          />
        </CampoFormulario>

        {/* Monto */}
        <CampoFormulario etiqueta="Monto mensual">
          {/* caja para escribir el monto mensual */}
          <TextInput
            // muestra el monto con puntos de miles
            value={formatearMiles(monto)}
            // guarda solo los numeros, con un largo maximo
            onChangeText={(t) => setMonto(soloDigitos(t).slice(0, LIMITES.digitosMonto))}
            // abre el teclado de numeros
            keyboardType="numeric"
            // texto de ejemplo cuando esta vacio
            placeholder="$10.500"
            // color gris del texto de ejemplo
            placeholderTextColor="#94A3B8"
            // aplica el estilo comun de los campos
            className={estiloInput()}
          />
          {/* si hay monto, muestra en gris cuanto es al año */}
          {montoNumerico > 0 && (
            <Text className="text-slate-400 text-xs font-inter-regular mt-1.5">
              Equivale a {formatearCLP(montoNumerico * 12)} al año
            </Text>
          )}
        </CampoFormulario>

        {/* Día de cobro: viene de la tarjeta, no se ingresa */}
        {/* caja azul clara con borde y esquinas redondeadas */}
        <View className="mb-8 flex-row items-center p-4 bg-blue-50 border border-blue-100 rounded-2xl">
          {/* cuadrito azul para el icono */}
          <View className="w-9 h-9 rounded-xl bg-blue-100 items-center justify-center mr-3">
            {/* icono azul de calendario */}
            <Ionicons name="calendar-outline" size={18} color="#1D4ED8" />
          </View>
          {/* texto azul oscuro que dice que dia se cobrara */}
          <Text className="flex-1 text-blue-900 text-xs font-inter-regular">
            {tarjetaSeleccionada
              ? `Se cobrará el día ${tarjetaSeleccionada.diaVencimiento} de cada mes, igual que el vencimiento de ${tarjetaSeleccionada.banco}.`
              : 'El día de cobro será el mismo del vencimiento de la tarjeta.'}
          </Text>
        </View>

        {/* boton para guardar la suscripcion */}
        <TouchableOpacity
          // al tocarlo intenta guardar
          onPress={handleGuardar}
          // boton ancho con color principal, esquinas redondeadas y sombra
          className="w-full h-12 bg-color-action rounded-2xl items-center justify-center mb-8 shadow-md"
          // se aclara un poco al tocarlo
          activeOpacity={0.8}
        >
          {/* texto blanco en negrita del boton */}
          <Text className="text-white text-base font-inter-bold">Guardar Suscripción</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal selección de tarjeta (muestra el cupo disponible de cada una) */}
      <ModalSeleccion
        // se muestra solo si se pidio abrir
        visible={modalVisible}
        // titulo de la ventana
        titulo="Seleccionar Tarjeta"
        // al cerrarla, se esconde
        onCerrar={() => setModalVisible(false)}
      >
        {/* recorre cada tarjeta y arma una fila para elegirla */}
        {tarjetas.map((t) => (
          <FilaOpcion
            // identificador unico de cada tarjeta en la lista
            key={t.id}
            // marca la fila si es la tarjeta ya elegida
            seleccionada={tarjetaId === t.id}
            // al tocar la fila
            onPress={() => {
              // guarda esa tarjeta como la elegida
              setTarjetaId(t.id);
              // cierra la ventana
              setModalVisible(false);
            }}
          >
            {/* fila con el color y los datos de la tarjeta */}
            <View className="flex-row items-center gap-3">
              {/* circulito pintado con el color de la tarjeta */}
              <View className="w-4 h-4 rounded-full" style={{ backgroundColor: t.colorHex }} />
              {/* caja con el nombre del banco y el cupo */}
              <View>
                {/* nombre del banco en gris oscuro */}
                <Text className="text-slate-900 text-base font-inter-medium">{t.banco}</Text>
                {/* texto chico gris: dueño si es compartida y cupo disponible */}
                <Text className="text-slate-500 text-xs">
                  {t.propia ? '' : `De ${t.duenoNombre} · `}Disponible: {formatearCLP(t.cupoDisponible)}
                </Text>
              </View>
            </View>
          </FilaOpcion>
        ))}
      </ModalSeleccion>
    </PantallaFormulario>
  );
}
