import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../api/cliente';

interface Props {
  error: boolean;
  onReintentar: () => void;
}

/** Se muestra mientras llega la primera respuesta del backend, o si no se pudo conectar. */
export default function PantallaConexion({ error, onReintentar }: Props) {
  if (!error) {
    return (
      <View className="flex-1 bg-bg-color items-center justify-center">
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-color items-center justify-center p-8">
      <Ionicons name="cloud-offline-outline" size={40} color="#94A3B8" />
      <Text className="text-slate-900 text-lg font-inter-bold mt-4 mb-2">Sin conexión</Text>
      <Text className="text-slate-500 text-sm font-inter-regular text-center mb-1">
        No se pudo conectar con el servidor. Revisa que el backend esté corriendo.
      </Text>
      <Text className="text-slate-400 text-xs font-inter-regular text-center mb-6">{API_URL}</Text>
      <TouchableOpacity onPress={onReintentar} className="px-5 py-2.5 bg-color-action rounded-xl">
        <Text className="text-white font-inter-bold">Reintentar</Text>
      </TouchableOpacity>
    </View>
  );
}
