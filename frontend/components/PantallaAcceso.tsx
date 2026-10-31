import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Resultado } from '../api/tipos';
import { avisar, avisarSinConexion } from '../constants/alertas';
import { LIMITES } from '../constants/limites';
import { useSesion } from '../context/SesionContext';
import { CampoFormulario, estiloInput } from './CampoFormulario';

// Misma regla que valida el backend: algo@algo.algo, sin espacios
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CampoClaveProps {
  valor: string;
  onCambiar: (texto: string) => void;
  placeholder: string;
  esNueva: boolean;          // Contraseña nueva (registro) o la de siempre (ingreso): ayuda al autocompletar
  visible: boolean;
  onAlternarVisible: () => void;
  onEnviar?: () => void;
}

/** Campo de contraseña con el ojo para mostrarla u ocultarla. */
function CampoClave({ valor, onCambiar, placeholder, esNueva, visible, onAlternarVisible, onEnviar }: CampoClaveProps) {
  return (
    <View className="justify-center">
      <TextInput
        value={valor}
        onChangeText={onCambiar}
        secureTextEntry={!visible}
        maxLength={LIMITES.contrasenaMax}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={esNueva ? 'new-password' : 'current-password'}
        textContentType={esNueva ? 'newPassword' : 'password'}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        returnKeyType={onEnviar ? 'go' : 'next'}
        onSubmitEditing={onEnviar}
        className={estiloInput()}
        style={{ paddingRight: 48 }}
      />
      <TouchableOpacity
        onPress={onAlternarVisible}
        className="absolute right-3 w-8 h-8 items-center justify-center"
        accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748B" />
      </TouchableOpacity>
    </View>
  );
}

/** Pantalla de entrada: se muestra mientras no hay sesión iniciada (ver _layout.tsx). */
export default function PantallaAcceso() {
  const insets = useSafeAreaInsets();
  const { ingresar, registrarse } = useSesion();

  const [modo, setModo] = useState<'ingresar' | 'registro'>('ingresar');
  const esRegistro = modo === 'registro';

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [verClave, setVerClave] = useState(false);
  // evita enviar dos veces mientras espera la respuesta del servidor
  const [enviando, setEnviando] = useState(false);

  const handleEnviar = async () => {
    if (enviando) return;
    const correo = email.trim();

    // === VALIDACIONES (las mismas que repite el backend) ===
    if (esRegistro && !nombre.trim()) return avisar('Nombre requerido', 'Ingresa tu nombre.');
    if (!correo) return avisar('Correo requerido', 'Ingresa tu correo.');
    if (!CORREO_VALIDO.test(correo)) {
      return avisar('Correo inválido', 'Revisa que el correo esté bien escrito (ej: nombre@correo.cl).');
    }
    if (esRegistro) {
      if (password.length < LIMITES.contrasenaMin) {
        return avisar('Contraseña muy corta', `Usa al menos ${LIMITES.contrasenaMin} caracteres.`);
      }
      if (password !== confirmacion) {
        return avisar('Las contraseñas no coinciden', 'Escribe la misma contraseña en los dos campos.');
      }
    } else if (!password) {
      return avisar('Contraseña requerida', 'Ingresa tu contraseña.');
    }

    // === ENVÍO === (si sale bien, _layout.tsx cambia solo a la app)
    setEnviando(true);
    const { resultado, mensaje } = esRegistro
      ? await registrarse(nombre.trim(), correo, password)
      : await ingresar(correo, password);
    setEnviando(false);
    mostrarResultado(resultado, mensaje);
  };

  /** Avisa por qué no se pudo ingresar o crear la cuenta (si salió bien no hace nada). */
  const mostrarResultado = (resultado: Resultado, mensaje?: string) => {
    if (resultado === 'ok') return;
    if (resultado === 'sin_conexion') return avisarSinConexion();
    if (resultado === 'credenciales_invalidas') {
      return avisar('No pudimos ingresar', 'El correo o la contraseña no son correctos.');
    }
    if (resultado === 'email_en_uso') {
      return avisar('Correo ya registrado', 'Ya existe una cuenta con ese correo. Ingresa con tu contraseña.');
    }
    avisar('Error', mensaje ?? 'No se pudo completar. Inténtalo de nuevo.');
  };

  const cambiarModo = (nuevo: 'ingresar' | 'registro') => {
    setModo(nuevo);
    setPassword('');
    setConfirmacion('');
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg-color" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-[420px] self-center">
          {/* Marca */}
          <View className="items-center mb-8">
            <View className="w-16 h-16 rounded-2xl bg-color-menu items-center justify-center mb-4 shadow-lg">
              <Ionicons name="card" size={30} color="#10B981" />
            </View>
            <Text className="text-color-menu text-2xl font-inter-bold">Control de Tarjetas</Text>
            <Text className="text-slate-500 text-sm font-inter-regular mt-1 text-center">
              Tus tarjetas, cuotas y suscripciones en un solo lugar
            </Text>
          </View>

          {/* Ingresar / Crear cuenta */}
          <View className="flex-row p-1 bg-slate-100 rounded-2xl mb-6">
            {([
              ['ingresar', 'Ingresar'],
              ['registro', 'Crear cuenta'],
            ] as const).map(([valor, etiqueta]) => (
              <TouchableOpacity
                key={valor}
                onPress={() => cambiarModo(valor)}
                className={`flex-1 py-2 rounded-xl items-center ${modo === valor ? 'bg-white shadow-sm' : 'bg-slate-100 shadow-none'}`}
              >
                <Text
                  className={`text-sm ${modo === valor ? 'text-slate-900 font-inter-bold' : 'text-slate-500 font-inter-medium'}`}
                >
                  {etiqueta}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {esRegistro && (
            <CampoFormulario etiqueta="Nombre">
              <TextInput
                value={nombre}
                onChangeText={setNombre}
                maxLength={LIMITES.nombreMax}
                autoComplete="name"
                textContentType="name"
                placeholder="Ej: Jaimito"
                placeholderTextColor="#94A3B8"
                className={estiloInput()}
              />
            </CampoFormulario>
          )}

          <CampoFormulario etiqueta="Correo">
            <TextInput
              value={email}
              onChangeText={setEmail}
              maxLength={LIMITES.emailMax}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              placeholder="nombre@correo.cl"
              placeholderTextColor="#94A3B8"
              className={estiloInput()}
            />
          </CampoFormulario>

          <CampoFormulario etiqueta="Contraseña" className={esRegistro ? 'mb-5' : 'mb-8'}>
            <CampoClave
              valor={password}
              onCambiar={setPassword}
              placeholder={esRegistro ? `Mínimo ${LIMITES.contrasenaMin} caracteres` : 'Tu contraseña'}
              esNueva={esRegistro}
              visible={verClave}
              onAlternarVisible={() => setVerClave((v) => !v)}
              onEnviar={esRegistro ? undefined : handleEnviar}
            />
          </CampoFormulario>

          {esRegistro && (
            <CampoFormulario etiqueta="Repite la contraseña" className="mb-8">
              <CampoClave
                valor={confirmacion}
                onCambiar={setConfirmacion}
                placeholder="La misma contraseña"
                esNueva
                visible={verClave}
                onAlternarVisible={() => setVerClave((v) => !v)}
                onEnviar={handleEnviar}
              />
            </CampoFormulario>
          )}

          <TouchableOpacity
            onPress={handleEnviar}
            disabled={enviando}
            activeOpacity={0.8}
            className={`w-full h-12 rounded-2xl items-center justify-center shadow-md ${enviando ? 'bg-slate-300' : 'bg-color-action'}`}
          >
            {enviando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-white text-base font-inter-bold">{esRegistro ? 'Crear cuenta' : 'Ingresar'}</Text>
            )}
          </TouchableOpacity>

          {/* Atajo para cambiar de modo */}
          <TouchableOpacity onPress={() => cambiarModo(esRegistro ? 'ingresar' : 'registro')} className="mt-5 items-center">
            <Text className="text-slate-500 text-sm font-inter-regular">
              {esRegistro ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
              <Text className="text-color-action font-inter-bold">{esRegistro ? 'Ingresa' : 'Crea una'}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
