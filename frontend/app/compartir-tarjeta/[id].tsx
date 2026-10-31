// trae los iconos que se usan en la pantalla
import { Ionicons } from '@expo/vector-icons';
// trae las funciones para leer la ruta y moverse entre pantallas
import { useLocalSearchParams, useRouter } from 'expo-router';
// trae React y la funcion para que la pantalla recuerde datos
import React, { useState } from 'react';
// trae las piezas basicas: lista deslizable, texto, campo para escribir, boton y caja
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

// trae la caja con titulo para cada campo y el estilo de los campos
import { CampoFormulario, estiloInput } from '../../components/CampoFormulario';
// trae el marco comun de las pantallas de formulario
import PantallaFormulario from '../../components/PantallaFormulario';
// trae el dibujo de la tarjeta grande
import CardItem from '../../components/TarjetaGrande';
// trae las funciones para mostrar avisos y preguntas
import { avisar, avisarSinConexion, confirmar } from '../../constants/alertas';
// trae los largos maximos permitidos en los campos
import { LIMITES } from '../../constants/limites';
// trae las direcciones de las pantallas de la app
import { RUTAS } from '../../constants/rutas';
// trae el tipo de persona invitada y los datos guardados de la app
import { Miembro, useApp } from '../../context/AppContext';

// pantalla para compartir una tarjeta con otra persona
export default function CompartirTarjetaScreen() {
  // saca el id que viene en la ruta, ej: /compartir-tarjeta/1727630000000
  const { id } = useLocalSearchParams<{ id: string }>();
  // sirve para ir a otras pantallas
  const router = useRouter();
  // saca las tarjetas y las funciones para compartir o dejar de compartir
  const { tarjetas, compartirTarjeta, dejarDeCompartir } = useApp();
  // busca la tarjeta que tiene ese id
  const tarjeta = tarjetas.find((t) => t.id === id);

  // guarda el correo que escribe el usuario
  const [email, setEmail] = useState('');
  // evita enviar dos veces mientras espera la respuesta del servidor
  const [enviando, setEnviando] = useState(false);

  // Solo el dueño elige con quién se comparte
  if (!tarjeta || !tarjeta.propia) {
    // muestra una pantalla simple con un aviso
    return (
      // caja blanca que ocupa todo, con el contenido al centro
      <View className="flex-1 bg-white items-center justify-center p-6">
        {/* texto gris centrado con el motivo */}
        <Text className="text-slate-600 text-base mb-4 text-center">
          {tarjeta ? `Solo ${tarjeta.duenoNombre ?? 'el dueño'} puede compartir esta tarjeta.` : 'Tarjeta no encontrada.'}
        </Text>
        {/* boton con color principal que vuelve a la lista de tarjetas */}
        <TouchableOpacity onPress={() => router.replace(RUTAS.tarjetas)} className="px-5 py-2.5 bg-color-action rounded-xl">
          {/* texto blanco en negrita del boton */}
          <Text className="text-white font-inter-bold">Volver a Tarjetas</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // se ejecuta al tocar "Compartir"
  const handleCompartir = async () => {
    // si ya se esta enviando, no hace nada
    if (enviando) return;
    // quita los espacios sobrantes del correo
    const correo = email.trim();
    // si el correo esta vacio, avisa que hay que escribirlo
    if (!correo) return avisar('Correo requerido', 'Escribe el correo con que la otra persona entra a la app.');

    // marca que empezo el envio
    setEnviando(true);
    // pide al servidor compartir la tarjeta con ese correo
    const { resultado, mensaje } = await compartirTarjeta(tarjeta.id, correo);
    // marca que termino el envio
    setEnviando(false);

    // si no hay internet, avisa
    if (resultado === 'sin_conexion') return avisarSinConexion();
    // si algo salio mal, avisa el motivo
    if (resultado !== 'ok') return avisar('No se pudo compartir', mensaje ?? 'Revisa el correo e inténtalo de nuevo.');
    // limpia el campo del correo
    setEmail('');
    // avisa que se compartio bien
    avisar('Tarjeta compartida', `Desde ahora esa persona ve ${tarjeta.banco} y puede registrar gastos en ella.`);
  };

  // se ejecuta al tocar "Quitar" en una persona
  const handleQuitar = (m: Miembro) => {
    // pregunta si de verdad quiere quitarle el acceso
    confirmar({
      // titulo del aviso
      titulo: 'Dejar de compartir',
      // texto del aviso con el nombre de la persona y del banco
      mensaje: `${m.nombre} dejará de ver ${tarjeta.banco}. Lo que registró en ella se queda en el estado de cuenta.`,
      // texto del boton para aceptar
      textoConfirmar: 'Dejar de compartir',
      // pinta el boton de rojo porque quita algo
      destructivo: true,
      // si acepta, se le quita el acceso
      onConfirmar: async () => {
        // pide al servidor quitar a esa persona de la tarjeta
        const { resultado } = await dejarDeCompartir(tarjeta.id, m.uid);
        // si no hay internet, avisa
        if (resultado === 'sin_conexion') return avisarSinConexion();
        // si algo salio mal, avisa con un error
        if (resultado !== 'ok') avisar('Error', 'No se pudo dejar de compartir la tarjeta.');
      },
    });
  };

  // lo que se ve en la pantalla
  return (
    // marco de formulario con titulo y flecha para volver atras
    <PantallaFormulario titulo="Compartir Tarjeta" onVolver={() => router.back()}>
      {/* zona deslizable; deja tocar botones aunque el teclado este abierto */}
      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* caja con espacio arriba y abajo para la tarjeta */}
        <View className="pt-4 pb-4">
          {/* dibujo grande de la tarjeta que se va a compartir */}
          <CardItem item={tarjeta} />
        </View>

        {/* Qué significa compartirla */}
        {/* caja azul clara con borde y esquinas redondeadas */}
        <View className="mb-5 flex-row items-center p-4 bg-blue-50 border border-blue-100 rounded-2xl">
          {/* cuadrito azul para el icono */}
          <View className="w-9 h-9 rounded-xl bg-blue-100 items-center justify-center mr-3">
            {/* icono azul de personas */}
            <Ionicons name="people-outline" size={18} color="#1D4ED8" />
          </View>
          {/* texto azul oscuro que explica que pasa al compartir */}
          <Text className="flex-1 text-blue-900 text-xs font-inter-regular">
            La otra persona verá esta tarjeta en su cuenta, con todas sus compras y suscripciones, y podrá registrar
            gastos y el pago del mes. Lo que registre cualquiera aparece para todos. Solo tú puedes editarla, eliminarla
            o dejar de compartirla.
          </Text>
        </View>

        {/* Con quién */}
        {/* campo con el titulo "Correo de la otra persona" */}
        <CampoFormulario etiqueta="Correo de la otra persona">
          {/* caja para escribir el correo */}
          <TextInput
            // muestra el correo guardado
            value={email}
            // guarda lo que el usuario va escribiendo
            onChangeText={setEmail}
            // no deja escribir mas letras que el maximo de un correo
            maxLength={LIMITES.emailMax}
            // abre el teclado con la @ a mano
            keyboardType="email-address"
            // no pone mayusculas solas
            autoCapitalize="none"
            // no corrige las palabras solas
            autoCorrect={false}
            // texto de ejemplo cuando esta vacio
            placeholder="nombre@correo.cl"
            // color gris del texto de ejemplo
            placeholderTextColor="#94A3B8"
            // la tecla enter del teclado dice "ir"
            returnKeyType="go"
            // al apretar enter, comparte la tarjeta
            onSubmitEditing={handleCompartir}
            // aplica el estilo comun de los campos
            className={estiloInput()}
          />
          {/* texto chico gris de ayuda debajo del campo */}
          <Text className="text-slate-400 text-xs font-inter-regular mt-1.5">
            Tiene que tener una cuenta en la app con ese correo.
          </Text>
        </CampoFormulario>

        {/* boton para compartir la tarjeta */}
        <TouchableOpacity
          // al tocarlo intenta compartir
          onPress={handleCompartir}
          // se bloquea mientras se esta enviando
          disabled={enviando}
          // se aclara un poco al tocarlo
          activeOpacity={0.8}
          // boton ancho y redondeado: gris mientras envia, color principal si no
          className={`w-full h-12 rounded-2xl items-center justify-center mb-8 shadow-md ${enviando ? 'bg-slate-300' : 'bg-color-action'}`}
        >
          {/* texto blanco en negrita del boton */}
          <Text className="text-white text-base font-inter-bold">Compartir</Text>
        </TouchableOpacity>

        {/* Personas con acceso */}
        {/* titulo chico gris de la lista de personas */}
        <Text className="text-slate-500 text-sm font-inter-bold tracking-wider mb-4">COMPARTIDA CON</Text>
        {/* si no hay nadie muestra un aviso punteado, si hay muestra la lista */}
        {tarjeta.miembros.length === 0 ? (
          <View className="p-4 mb-8 rounded-2xl border border-dashed border-slate-200 items-center justify-center">
            {/* texto gris claro del aviso */}
            <Text className="text-slate-400 text-xs">Todavía no la compartes con nadie</Text>
          </View>
        ) : (
          // caja con la lista de personas
          <View className="mb-8">
            {/* recorre cada persona y arma su fila */}
            {tarjeta.miembros.map((m) => (
              <View
                // identificador unico de cada persona en la lista
                key={m.uid}
                // fila blanca con borde, esquinas redondeadas y sombra suave
                className="p-4 mb-3 bg-white rounded-2xl border border-slate-100 flex-row items-center shadow-sm"
              >
                {/* circulo gris para la inicial */}
                <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center mr-3">
                  {/* primera letra del nombre en mayuscula */}
                  <Text className="text-slate-700 text-base font-inter-bold">{m.nombre.charAt(0).toUpperCase()}</Text>
                </View>
                {/* nombre de la persona en una sola linea */}
                <Text className="flex-1 text-slate-900 text-base font-inter-bold" numberOfLines={1}>
                  {m.nombre}
                </Text>
                {/* boton para quitarle el acceso a esa persona */}
                <TouchableOpacity onPress={() => handleQuitar(m)} activeOpacity={0.6} className="px-3 py-1.5">
                  {/* texto rojo "Quitar" */}
                  <Text className="text-red-600 text-sm font-inter-bold">Quitar</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </PantallaFormulario>
  );
}
