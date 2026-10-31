import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { CampoFormulario, estiloInput } from '../../components/CampoFormulario';
import PantallaFormulario from '../../components/PantallaFormulario';
import CardItem from '../../components/TarjetaGrande';
import { avisar, avisarSinConexion, confirmar } from '../../constants/alertas';
import { LIMITES } from '../../constants/limites';
import { RUTAS } from '../../constants/rutas';
import { Miembro, useApp } from '../../context/AppContext';

export default function CompartirTarjetaScreen() {
  // saca el id que viene en la ruta, ej: /compartir-tarjeta/1727630000000
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tarjetas, compartirTarjeta, dejarDeCompartir } = useApp();
  const tarjeta = tarjetas.find((t) => t.id === id);

  const [email, setEmail] = useState('');
  // evita enviar dos veces mientras espera la respuesta del servidor
  const [enviando, setEnviando] = useState(false);

  // Solo el dueño elige con quién se comparte
  if (!tarjeta || !tarjeta.propia) {
    return (
      <View className="flex-1 bg-white items-center justify-center p-6">
        <Text className="text-slate-600 text-base mb-4 text-center">
          {tarjeta ? `Solo ${tarjeta.duenoNombre ?? 'el dueño'} puede compartir esta tarjeta.` : 'Tarjeta no encontrada.'}
        </Text>
        <TouchableOpacity onPress={() => router.replace(RUTAS.tarjetas)} className="px-5 py-2.5 bg-color-action rounded-xl">
          <Text className="text-white font-inter-bold">Volver a Tarjetas</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCompartir = async () => {
    if (enviando) return;
    const correo = email.trim();
    if (!correo) return avisar('Correo requerido', 'Escribe el correo con que la otra persona entra a la app.');

    setEnviando(true);
    const { resultado, mensaje } = await compartirTarjeta(tarjeta.id, correo);
    setEnviando(false);

    if (resultado === 'sin_conexion') return avisarSinConexion();
    if (resultado !== 'ok') return avisar('No se pudo compartir', mensaje ?? 'Revisa el correo e inténtalo de nuevo.');
    setEmail('');
    avisar('Tarjeta compartida', `Desde ahora esa persona ve ${tarjeta.banco} y puede registrar gastos en ella.`);
  };

  const handleQuitar = (m: Miembro) => {
    confirmar({
      titulo: 'Dejar de compartir',
      mensaje: `${m.nombre} dejará de ver ${tarjeta.banco}. Lo que registró en ella se queda en el estado de cuenta.`,
      textoConfirmar: 'Dejar de compartir',
      destructivo: true,
      onConfirmar: async () => {
        const { resultado } = await dejarDeCompartir(tarjeta.id, m.uid);
        if (resultado === 'sin_conexion') return avisarSinConexion();
        if (resultado !== 'ok') avisar('Error', 'No se pudo dejar de compartir la tarjeta.');
      },
    });
  };

  return (
    <PantallaFormulario titulo="Compartir Tarjeta" onVolver={() => router.back()}>
      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="pt-4 pb-4">
          <CardItem item={tarjeta} />
        </View>

        {/* Qué significa compartirla */}
        <View className="mb-5 flex-row items-center p-4 bg-blue-50 border border-blue-100 rounded-2xl">
          <View className="w-9 h-9 rounded-xl bg-blue-100 items-center justify-center mr-3">
            <Ionicons name="people-outline" size={18} color="#1D4ED8" />
          </View>
          <Text className="flex-1 text-blue-900 text-xs font-inter-regular">
            La otra persona verá esta tarjeta en su cuenta, con todas sus compras y suscripciones, y podrá registrar
            gastos y el pago del mes. Lo que registre cualquiera aparece para todos. Solo tú puedes editarla, eliminarla
            o dejar de compartirla.
          </Text>
        </View>

        {/* Con quién */}
        <CampoFormulario etiqueta="Correo de la otra persona">
          <TextInput
            value={email}
            onChangeText={setEmail}
            maxLength={LIMITES.emailMax}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="nombre@correo.cl"
            placeholderTextColor="#94A3B8"
            returnKeyType="go"
            onSubmitEditing={handleCompartir}
            className={estiloInput()}
          />
          <Text className="text-slate-400 text-xs font-inter-regular mt-1.5">
            Tiene que tener una cuenta en la app con ese correo.
          </Text>
        </CampoFormulario>

        <TouchableOpacity
          onPress={handleCompartir}
          disabled={enviando}
          activeOpacity={0.8}
          className={`w-full h-12 rounded-2xl items-center justify-center mb-8 shadow-md ${enviando ? 'bg-slate-300' : 'bg-color-action'}`}
        >
          <Text className="text-white text-base font-inter-bold">Compartir</Text>
        </TouchableOpacity>

        {/* Personas con acceso */}
        <Text className="text-slate-500 text-sm font-inter-bold tracking-wider mb-4">COMPARTIDA CON</Text>
        {tarjeta.miembros.length === 0 ? (
          <View className="p-4 mb-8 rounded-2xl border border-dashed border-slate-200 items-center justify-center">
            <Text className="text-slate-400 text-xs">Todavía no la compartes con nadie</Text>
          </View>
        ) : (
          <View className="mb-8">
            {tarjeta.miembros.map((m) => (
              <View
                key={m.uid}
                className="p-4 mb-3 bg-white rounded-2xl border border-slate-100 flex-row items-center shadow-sm"
              >
                <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center mr-3">
                  <Text className="text-slate-700 text-base font-inter-bold">{m.nombre.charAt(0).toUpperCase()}</Text>
                </View>
                <Text className="flex-1 text-slate-900 text-base font-inter-bold" numberOfLines={1}>
                  {m.nombre}
                </Text>
                <TouchableOpacity onPress={() => handleQuitar(m)} activeOpacity={0.6} className="px-3 py-1.5">
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
