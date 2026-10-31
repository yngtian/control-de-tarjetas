// trae los iconos (la nube tachada)
import { Ionicons } from '@expo/vector-icons';
// trae React para poder armar la pantalla
import React from 'react';
// trae la ruedita de carga, textos, botones y cajas
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
// trae la dirección del servidor
import { API_URL } from '../api/cliente';

// datos que recibe esta pantalla
interface Props {
  // si no se pudo conectar con el servidor
  error: boolean;
  // qué hacer al tocar "Reintentar"
  onReintentar: () => void;
}

/** Se muestra mientras llega la primera respuesta del backend, o si no se pudo conectar. */
// pantalla de espera o de error de conexión
export default function PantallaConexion({ error, onReintentar }: Props) {
  // si no hay error, todavía está cargando
  if (!error) {
    // muestra solo la ruedita de carga
    return (
      // fondo de la app con todo centrado
      <View className="flex-1 bg-bg-color items-center justify-center">
        {/* ruedita verde grande que gira */}
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  // si hubo error, muestra el aviso de sin conexión
  return (
    // fondo de la app con todo centrado y margen
    <View className="flex-1 bg-bg-color items-center justify-center p-8">
      {/* icono gris de nube tachada */}
      <Ionicons name="cloud-offline-outline" size={40} color="#94A3B8" />
      {/* título "Sin conexión" en negrita */}
      <Text className="text-slate-900 text-lg font-inter-bold mt-4 mb-2">Sin conexión</Text>
      {/* explicación gris centrada */}
      <Text className="text-slate-500 text-sm font-inter-regular text-center mb-1">
        {/* mensaje de que no se pudo conectar */}
        No se pudo conectar con el servidor. Revisa que el backend esté corriendo.
      </Text>
      {/* muestra en chico la dirección del servidor */}
      <Text className="text-slate-400 text-xs font-inter-regular text-center mb-6">{API_URL}</Text>
      {/* botón verde para volver a intentar */}
      <TouchableOpacity onPress={onReintentar} className="px-5 py-2.5 bg-color-action rounded-xl">
        {/* texto blanco "Reintentar" */}
        <Text className="text-white font-inter-bold">Reintentar</Text>
      </TouchableOpacity>
    </View>
  );
}
