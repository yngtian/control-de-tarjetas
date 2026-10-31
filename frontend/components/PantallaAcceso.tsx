// trae los iconos que se usan en la pantalla (ojo, tarjeta)
import { Ionicons } from '@expo/vector-icons';
// trae React y la forma de recordar datos en la pantalla
import React, { useState } from 'react';
// trae las piezas básicas para armar la pantalla
import {
  // ruedita que gira mientras se espera
  ActivityIndicator,
  // caja que se corre hacia arriba cuando sale el teclado
  KeyboardAvoidingView,
  // sirve para saber si el celular es iPhone o Android
  Platform,
  // caja que permite deslizar hacia arriba y abajo
  ScrollView,
  // pieza para mostrar textos
  Text,
  // casilla donde el usuario escribe
  TextInput,
  // pieza que se puede tocar como botón
  TouchableOpacity,
  // caja para agrupar cosas
  View,
} from 'react-native';
// sirve para saber cuánto espacio ocupan la muesca y la barra del celular
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// trae el tipo de respuesta que da el servidor al ingresar
import type { Resultado } from '../api/tipos';
// trae las funciones para mostrar alertas y preguntas
import { avisar, avisarSinConexion, confirmar } from '../constants/alertas';
// trae los largos máximos y mínimos permitidos en los textos
import { LIMITES } from '../constants/limites';
// trae las funciones para ingresar y crear cuenta
import { useSesion } from '../context/SesionContext';
// trae la caja con título para cada casilla y su estilo
import { CampoFormulario, estiloInput } from './CampoFormulario';

// Misma regla que valida el backend: algo@algo.algo, sin espacios
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// lista de datos que recibe la casilla de contraseña
interface CampoClaveProps {
  // la contraseña escrita
  valor: string;
  // qué hacer cuando el usuario escribe
  onCambiar: (texto: string) => void;
  // texto gris de ayuda que se ve cuando la casilla está vacía
  placeholder: string;
  // indica si es una contraseña nueva o una ya existente
  esNueva: boolean;          // Contraseña nueva (registro) o la de siempre (ingreso): ayuda al autocompletar
  // indica si la contraseña se ve o se tapa con puntitos
  visible: boolean;
  // qué hacer al tocar el ojo
  onAlternarVisible: () => void;
  // qué hacer al apretar "enviar" en el teclado (opcional)
  onEnviar?: () => void;
}

/** Campo de contraseña con el ojo para mostrarla u ocultarla. */
// casilla de contraseña con el botón del ojo
function CampoClave({ valor, onCambiar, placeholder, esNueva, visible, onAlternarVisible, onEnviar }: CampoClaveProps) {
  // devuelve lo que se ve en pantalla
  return (
    // caja que centra la casilla y el ojo
    <View className="justify-center">
      {/* casilla donde se escribe la contraseña */}
      <TextInput
        // muestra la contraseña escrita
        value={valor}
        // guarda lo que el usuario va escribiendo
        onChangeText={onCambiar}
        // tapa la contraseña con puntitos si no está visible
        secureTextEntry={!visible}
        // no deja escribir más letras que el máximo permitido
        maxLength={LIMITES.contrasenaMax}
        // no pone mayúscula automática
        autoCapitalize="none"
        // no corrige las palabras automáticamente
        autoCorrect={false}
        // le dice al celular si debe sugerir una contraseña nueva o la guardada
        autoComplete={esNueva ? 'new-password' : 'current-password'}
        // lo mismo pero para iPhone
        textContentType={esNueva ? 'newPassword' : 'password'}
        // texto gris de ayuda
        placeholder={placeholder}
        // color gris del texto de ayuda
        placeholderTextColor="#94A3B8"
        // botón del teclado: "ir" si envía, "siguiente" si no
        returnKeyType={onEnviar ? 'go' : 'next'}
        // al apretar el botón del teclado, envía el formulario
        onSubmitEditing={onEnviar}
        // aplica el estilo de casilla con borde redondeado
        className={estiloInput()}
        // deja espacio a la derecha para el ojo
        style={{ paddingRight: 48 }}
      />
      {/* botón del ojo para mostrar u ocultar la contraseña */}
      <TouchableOpacity
        // al tocarlo, muestra u oculta la contraseña
        onPress={onAlternarVisible}
        // lo pone pegado a la derecha dentro de la casilla
        className="absolute right-3 w-8 h-8 items-center justify-center"
        // texto que lee el lector de pantalla para personas ciegas
        accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {/* icono del ojo abierto o tachado */}
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748B" />
      </TouchableOpacity>
    </View>
  );
}

/** Pantalla de entrada: se muestra mientras no hay sesión iniciada (ver _layout.tsx). */
// pantalla para ingresar o crear una cuenta
export default function PantallaAcceso() {
  // mide el espacio de la muesca y la barra del celular
  const insets = useSafeAreaInsets();
  // trae las funciones para ingresar y para crear cuenta
  const { ingresar, registrarse } = useSesion();

  // recuerda si estamos en "Ingresar" o en "Crear cuenta"
  const [modo, setModo] = useState<'ingresar' | 'registro'>('ingresar');
  // indica si estamos creando una cuenta nueva
  const esRegistro = modo === 'registro';

  // guarda el nombre que escribió el usuario
  const [nombre, setNombre] = useState('');
  // guarda el correo que escribió el usuario
  const [email, setEmail] = useState('');
  // guarda la contraseña que escribió el usuario
  const [password, setPassword] = useState('');
  // guarda la contraseña repetida para comparar
  const [confirmacion, setConfirmacion] = useState('');
  // recuerda si la contraseña se muestra o se tapa
  const [verClave, setVerClave] = useState(false);
  // evita enviar dos veces mientras espera la respuesta del servidor
  const [enviando, setEnviando] = useState(false);

  // qué pasa al tocar el botón de ingresar o crear cuenta
  const handleEnviar = async () => {
    // si ya se está enviando, no hace nada
    if (enviando) return;
    // quita los espacios sobrantes del correo
    const correo = email.trim();

    // === VALIDACIONES (las mismas que repite el backend) ===
    // si está creando cuenta y no puso nombre, avisa
    if (esRegistro && !nombre.trim()) return avisar('Nombre requerido', 'Ingresa tu nombre.');
    // si no escribió correo, avisa
    if (!correo) return avisar('Correo requerido', 'Ingresa tu correo.');
    // si el correo está mal escrito, avisa
    if (!CORREO_VALIDO.test(correo)) {
      // muestra el aviso de correo inválido
      return avisar('Correo inválido', 'Revisa que el correo esté bien escrito (ej: nombre@correo.cl).');
    }
    // revisiones extra solo al crear cuenta
    if (esRegistro) {
      // si la contraseña es muy corta, avisa
      if (password.length < LIMITES.contrasenaMin) {
        // muestra el aviso de contraseña corta
        return avisar('Contraseña muy corta', `Usa al menos ${LIMITES.contrasenaMin} caracteres.`);
      }
      // si las dos contraseñas no son iguales, avisa
      if (password !== confirmacion) {
        // muestra el aviso de contraseñas distintas
        return avisar('Las contraseñas no coinciden', 'Escribe la misma contraseña en los dos campos.');
      }
    // al ingresar, si no escribió contraseña, avisa
    } else if (!password) {
      // muestra el aviso de contraseña vacía
      return avisar('Contraseña requerida', 'Ingresa tu contraseña.');
    }

    // === ENVÍO === (si sale bien, _layout.tsx cambia solo a la app)
    // marca que se está enviando (el botón se pone gris)
    setEnviando(true);
    // manda los datos al servidor y espera la respuesta
    const { resultado, mensaje } = esRegistro
      // si es registro, crea la cuenta nueva
      ? await registrarse(nombre.trim(), correo, password)
      // si no, ingresa con la cuenta existente
      : await ingresar(correo, password);
    // marca que ya terminó de enviar
    setEnviando(false);
    // muestra un aviso si algo salió mal
    mostrarResultado(resultado, mensaje);
  };

  /** Avisa por qué no se pudo ingresar o crear la cuenta (si salió bien no hace nada). */
  // revisa la respuesta del servidor y avisa si hubo problema
  const mostrarResultado = (resultado: Resultado, mensaje?: string) => {
    // si todo salió bien, no muestra nada
    if (resultado === 'ok') return;
    // si no hay internet, muestra el aviso de sin conexión
    if (resultado === 'sin_conexion') return avisarSinConexion();
    // si el correo no tiene cuenta
    if (resultado === 'sin_cuenta') {
      // Ofrece crearla: cambia a "Crear cuenta" y deja escrito el mismo correo
      return confirmar({
        // título de la pregunta
        titulo: 'No existe esa cuenta',
        // explicación de la pregunta
        mensaje: 'No hay ninguna cuenta con ese correo. Revisa que esté bien escrito o crea una cuenta nueva.',
        // texto del botón para crear la cuenta
        textoConfirmar: 'Crear cuenta',
        // texto del botón para volver a revisar
        textoCancelar: 'Revisar correo',
        // si acepta, cambia a la pestaña "Crear cuenta"
        onConfirmar: () => cambiarModo('registro'),
      });
    }
    // si la contraseña está mal
    if (resultado === 'credenciales_invalidas') {
      // muestra el aviso de contraseña incorrecta
      return avisar('Contraseña incorrecta', 'La contraseña no es correcta. Inténtalo de nuevo.');
    }
    // si el correo ya tiene una cuenta
    if (resultado === 'email_en_uso') {
      // muestra el aviso de correo ya registrado
      return avisar('Correo ya registrado', 'Ya existe una cuenta con ese correo. Ingresa con tu contraseña.');
    }
    // cualquier otro problema muestra un error general
    avisar('Error', mensaje ?? 'No se pudo completar. Inténtalo de nuevo.');
  };

  // cambia entre "Ingresar" y "Crear cuenta"
  const cambiarModo = (nuevo: 'ingresar' | 'registro') => {
    // guarda la pestaña elegida
    setModo(nuevo);
    // borra la contraseña escrita
    setPassword('');
    // borra la contraseña repetida
    setConfirmacion('');
  };

  // devuelve lo que se ve en pantalla
  return (
    // caja de fondo que se corre hacia arriba cuando sale el teclado en iPhone
    <KeyboardAvoidingView className="flex-1 bg-bg-color" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* zona que se puede deslizar con todo el formulario */}
      <ScrollView
        // ocupa toda la pantalla con margen a los lados
        className="flex-1 px-6"
        // centra el formulario y deja espacio arriba y abajo del celular
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
        // deja tocar botones aunque el teclado esté abierto
        keyboardShouldPersistTaps="handled"
        // oculta la barrita de desplazamiento
        showsVerticalScrollIndicator={false}
      >
        {/* caja centrada con ancho máximo para que no se estire en pantallas grandes */}
        <View className="w-full max-w-[420px] self-center">
          {/* Marca */}
          {/* caja con el logo, el nombre y la frase de la app */}
          <View className="items-center mb-8">
            {/* cuadrado oscuro redondeado donde va el logo */}
            <View className="w-16 h-16 rounded-2xl bg-color-menu items-center justify-center mb-4 shadow-lg">
              {/* icono verde de tarjeta */}
              <Ionicons name="card" size={30} color="#10B981" />
            </View>
            {/* nombre de la app en grande y negrita */}
            <Text className="text-color-menu text-2xl font-inter-bold">Control de Tarjetas</Text>
            {/* frase gris y chica debajo del nombre */}
            <Text className="text-slate-500 text-sm font-inter-regular mt-1 text-center">
              Tus tarjetas, cuotas y suscripciones en un solo lugar
            </Text>
          </View>

          {/* Ingresar / Crear cuenta */}
          {/* barra gris con las dos pestañas para elegir */}
          <View className="flex-row p-1 bg-slate-100 rounded-2xl mb-6">
            {/* arma un botón por cada pestaña: Ingresar y Crear cuenta */}
            {([
              ['ingresar', 'Ingresar'],
              ['registro', 'Crear cuenta'],
            ] as const).map(([valor, etiqueta]) => (
              <TouchableOpacity
                // nombre único de cada pestaña
                key={valor}
                // al tocarla, cambia a esa pestaña
                onPress={() => cambiarModo(valor)}
                // la pestaña elegida se pinta blanca con sombra, la otra gris
                className={`flex-1 py-2 rounded-xl items-center ${modo === valor ? 'bg-white shadow-sm' : 'bg-slate-100 shadow-none'}`}
              >
                {/* texto de la pestaña */}
                <Text
                  // la elegida va en negro y negrita, la otra en gris
                  className={`text-sm ${modo === valor ? 'text-slate-900 font-inter-bold' : 'text-slate-500 font-inter-medium'}`}
                >
                  {/* muestra "Ingresar" o "Crear cuenta" */}
                  {etiqueta}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* si está creando cuenta, muestra la casilla del nombre */}
          {esRegistro && (
            <CampoFormulario etiqueta="Nombre">
              {/* casilla para escribir el nombre */}
              <TextInput
                // muestra el nombre escrito
                value={nombre}
                // guarda el nombre mientras se escribe
                onChangeText={setNombre}
                // no deja pasar del largo máximo
                maxLength={LIMITES.nombreMax}
                // el celular sugiere el nombre guardado
                autoComplete="name"
                // lo mismo pero para iPhone
                textContentType="name"
                // texto gris de ejemplo
                placeholder="Ej: Jaimito"
                // color gris del texto de ejemplo
                placeholderTextColor="#94A3B8"
                // aplica el estilo de casilla
                className={estiloInput()}
              />
            </CampoFormulario>
          )}

          {/* caja con título "Correo" */}
          <CampoFormulario etiqueta="Correo">
            {/* casilla para escribir el correo */}
            <TextInput
              // muestra el correo escrito
              value={email}
              // guarda el correo mientras se escribe
              onChangeText={setEmail}
              // no deja pasar del largo máximo
              maxLength={LIMITES.emailMax}
              // abre el teclado con la @ a mano
              keyboardType="email-address"
              // no pone mayúscula automática
              autoCapitalize="none"
              // no corrige las palabras
              autoCorrect={false}
              // el celular sugiere el correo guardado
              autoComplete="email"
              // lo mismo pero para iPhone
              textContentType="emailAddress"
              // texto gris de ejemplo
              placeholder="nombre@correo.cl"
              // color gris del texto de ejemplo
              placeholderTextColor="#94A3B8"
              // aplica el estilo de casilla
              className={estiloInput()}
            />
          </CampoFormulario>

          {/* caja con título "Contraseña", con más espacio abajo si es ingreso */}
          <CampoFormulario etiqueta="Contraseña" className={esRegistro ? 'mb-5' : 'mb-8'}>
            {/* casilla de contraseña con el ojo */}
            <CampoClave
              // muestra la contraseña escrita
              valor={password}
              // guarda la contraseña mientras se escribe
              onCambiar={setPassword}
              // texto gris de ayuda según si crea cuenta o ingresa
              placeholder={esRegistro ? `Mínimo ${LIMITES.contrasenaMin} caracteres` : 'Tu contraseña'}
              // es contraseña nueva solo al crear cuenta
              esNueva={esRegistro}
              // muestra u oculta la contraseña
              visible={verClave}
              // al tocar el ojo, cambia entre ver y ocultar
              onAlternarVisible={() => setVerClave((v) => !v)}
              // al ingresar, el botón del teclado envía el formulario
              onEnviar={esRegistro ? undefined : handleEnviar}
            />
          </CampoFormulario>

          {/* si está creando cuenta, muestra la casilla para repetir la contraseña */}
          {esRegistro && (
            <CampoFormulario etiqueta="Repite la contraseña" className="mb-8">
              {/* casilla para repetir la contraseña con el ojo */}
              <CampoClave
                // muestra la contraseña repetida
                valor={confirmacion}
                // guarda la contraseña repetida mientras se escribe
                onCambiar={setConfirmacion}
                // texto gris de ayuda
                placeholder="La misma contraseña"
                // es una contraseña nueva
                esNueva
                // muestra u oculta la contraseña
                visible={verClave}
                // al tocar el ojo, cambia entre ver y ocultar
                onAlternarVisible={() => setVerClave((v) => !v)}
                // el botón del teclado envía el formulario
                onEnviar={handleEnviar}
              />
            </CampoFormulario>
          )}

          {/* botón principal para ingresar o crear la cuenta */}
          <TouchableOpacity
            // al tocarlo, envía los datos
            onPress={handleEnviar}
            // no se puede tocar mientras se envía
            disabled={enviando}
            // se aclara un poco al tocarlo
            activeOpacity={0.8}
            // botón ancho y redondeado: gris mientras envía, de color si no
            className={`w-full h-12 rounded-2xl items-center justify-center shadow-md ${enviando ? 'bg-slate-300' : 'bg-color-action'}`}
          >
            {/* mientras envía muestra la ruedita, si no muestra el texto del botón */}
            {enviando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-white text-base font-inter-bold">{esRegistro ? 'Crear cuenta' : 'Ingresar'}</Text>
            )}
          </TouchableOpacity>

          {/* Atajo para cambiar de modo */}
          {/* texto tocable de abajo para pasar a la otra pestaña */}
          <TouchableOpacity onPress={() => cambiarModo(esRegistro ? 'ingresar' : 'registro')} className="mt-5 items-center">
            {/* frase gris de la pregunta */}
            <Text className="text-slate-500 text-sm font-inter-regular">
              {/* pregunta si ya tiene cuenta o no */}
              {esRegistro ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
              {/* palabra de color en negrita que invita a cambiar */}
              <Text className="text-color-action font-inter-bold">{esRegistro ? 'Ingresa' : 'Crea una'}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
