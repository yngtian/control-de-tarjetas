// trae los íconos que se usan en la pantalla
import { Ionicons } from '@expo/vector-icons';
// trae las funciones para leer el id de la dirección y moverse entre pantallas
import { useLocalSearchParams, useRouter } from 'expo-router';
// trae React y la función para recordar datos en la pantalla
import React, { useState } from 'react';
// trae las piezas básicas: lista con scroll, texto, campo para escribir, botón y caja
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

// trae el campo del formulario con su etiqueta y su estilo
import { CampoFormulario, estiloInput } from '../../components/CampoFormulario';
// trae el marco de pantalla con título y botón para volver
import PantallaFormulario from '../../components/PantallaFormulario';
// trae el dibujo grande de la tarjeta
import CardItem from '../../components/TarjetaGrande';
// trae las funciones para mostrar avisos y pedir confirmación
import { avisar, avisarSinConexion, confirmar } from '../../constants/alertas';
// trae las funciones que escriben montos, miles, nombres y dejan solo números
import { formatearCLP, formatearMiles, nombresCompartidos, soloDigitos } from '../../constants/formato';
// trae los largos máximos permitidos en los campos
import { LIMITES } from '../../constants/limites';
// trae las direcciones de las pantallas de la app
import { RUTAS } from '../../constants/rutas';
// trae la forma de una tarjeta y los datos generales de la app
import { TarjetaItem, useApp } from '../../context/AppContext';
// trae la forma de los cambios que se mandan al servidor
import type { CambiosTarjeta } from '../../api/tipos';

// la pantalla para editar una tarjeta
export default function EditarTarjetaScreen() {
  // saca el id que viene en la ruta, ej: /editar-tarjeta/1727630000000
  const { id } = useLocalSearchParams<{ id: string }>();
  // sirve para ir a otras pantallas
  const router = useRouter();
  // trae las tarjetas, compras y suscripciones del usuario
  const { tarjetas, transacciones, suscripciones } = useApp();
  // busca la tarjeta que tiene este id
  const tarjeta = tarjetas.find((t) => t.id === id);

  // si no encontro la tarjeta (por ejemplo se acaba de eliminar), o es de otra persona, muestra un aviso
  if (!tarjeta || !tarjeta.propia) {
    // muestra la pantalla del aviso
    return (
      // caja blanca que ocupa toda la pantalla, con todo centrado
      <View className="flex-1 bg-white items-center justify-center p-6">
        {/* texto gris centrado del aviso */}
        <Text className="text-slate-600 text-base mb-4 text-center">
          {/* si es de otra persona dice quién puede editarla; si no, que no se encontró */}
          {tarjeta ? `Solo ${tarjeta.duenoNombre ?? 'el dueño'} puede editar esta tarjeta.` : 'Tarjeta no encontrada.'}
        </Text>
        {/* botón para volver a la lista */}
        <TouchableOpacity
          // al tocarlo, vuelve a la lista de tarjetas
          onPress={() => router.replace(RUTAS.tarjetas)}
          // botón verde con esquinas redondeadas
          className="px-5 py-2.5 bg-color-action rounded-xl">
          {/* texto blanco en negrita del botón */}
          <Text className="text-white font-inter-bold">Volver a Tarjetas</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // muestra el formulario de edición
  return (
    // el formulario con los datos de la tarjeta
    <FormularioEdicion
      // la tarjeta que se va a editar
      tarjeta={tarjeta}
      // cuántas compras tiene esta tarjeta
      cantidadCompras={transacciones.filter((tx) => tx.tarjetaId === tarjeta.id).length}
      // cuántas suscripciones tiene esta tarjeta
      cantidadSuscripciones={suscripciones.filter((s) => s.tarjetaId === tarjeta.id).length}
    />
  );
}

// datos que necesita el formulario
interface FormularioProps {
  // la tarjeta a editar
  tarjeta: TarjetaItem;
  // cuántas compras tiene
  cantidadCompras: number;
  // cuántas suscripciones tiene
  cantidadSuscripciones: number;
}

/** El formulario parte con los datos actuales de la tarjeta (por eso va aparte: se crea con ella ya cargada). */
function FormularioEdicion({ tarjeta, cantidadCompras, cantidadSuscripciones }: FormularioProps) {
  // sirve para ir a otras pantallas
  const router = useRouter();
  // trae las acciones para editar y eliminar tarjetas
  const { editarTarjeta, eliminarTarjeta } = useApp();

  // Visa y MasterCard se distinguen solo por su alias: es obligatorio
  const requiereAlias = tarjeta.emisor === 'visa' || tarjeta.emisor === 'mastercard';

  // Un alias igual al nombre del banco es el que se puso por defecto: se muestra vacío (opcional)
  const [alias, setAlias] = useState(requiereAlias || tarjeta.alias !== tarjeta.banco ? tarjeta.alias : '');
  const [cupo, setCupo] = useState(String(tarjeta.cupoTotal));   // Solo dígitos; se muestra con puntos de miles
  // guarda el día de facturación, parte con el actual
  const [dia, setDia] = useState(String(tarjeta.diaVencimiento));
  // recuerda si se está guardando, para no guardar dos veces
  const [guardando, setGuardando] = useState(false);

  // pasa el cupo escrito a número (0 si está vacío)
  const cupoNumerico = parseInt(cupo, 10) || 0;
  // Lo que ya ocupan las compras y suscripciones (de todos, si está compartida)
  const usado = tarjeta.cupoTotal - tarjeta.cupoDisponible;

  // Previsualización: la tarjeta como quedará con los cambios
  const previewItem: TarjetaItem = {
    // copia todos los datos de la tarjeta
    ...tarjeta,
    // si el alias es obligatorio, lo muestra como título
    banco: requiereAlias ? alias.trim() || tarjeta.banco : tarjeta.banco,
    // muestra el cupo nuevo que se está escribiendo
    cupoTotal: cupoNumerico,
  };

  // Día de facturación: solo números y nunca mayor a 31
  const handleCambioDia = (texto: string) => {
    // quita todo lo que no sea número
    const soloNumeros = soloDigitos(texto);
    // guarda el día si está vacío o no pasa de 31
    if (soloNumeros === '' || parseInt(soloNumeros, 10) <= 31) setDia(soloNumeros);
  };

  // lo que pasa al tocar "Guardar Cambios"
  const handleGuardar = async () => {
    // si ya se está guardando, no hace nada
    if (guardando) return;

    // === VALIDACIONES ===
    // si falta el alias obligatorio
    if (requiereAlias && !alias.trim()) {
      // muestra un aviso pidiendo el alias
      return avisar(
        // título del aviso
        'Alias obligatorio',
        // mensaje del aviso con el tipo de tarjeta
        `Ingresa un nombre para identificar tu tarjeta ${tarjeta.emisor === 'visa' ? 'Visa' : 'MasterCard'}.`
      );
    }
    // pasa el día a número
    const diaNumero = parseInt(dia, 10);
    // si el día no es número o se sale de 1 a 31
    if (isNaN(diaNumero) || diaNumero < 1 || diaNumero > 31) {
      // avisa que el día no es válido
      return avisar('Día inválido', 'Por favor ingresa un día de facturación válido entre 1 y 31.');
    }
    // si el cupo es 0 o menos, avisa
    if (cupoNumerico <= 0) return avisar('Cupo inválido', 'Por favor ingresa un cupo total mayor a 0.');
    // si el cupo nuevo es menor a lo ya gastado
    if (cupoNumerico < usado) {
      // avisa que el cupo no alcanza
      return avisar('Cupo insuficiente', `El cupo no puede ser menor a lo que ya está usado (${formatearCLP(usado)}).`);
    }

    // === GUARDADO: solo lo que cambió ===
    // lista vacía donde se anotan los cambios
    const cambios: CambiosTarjeta = {};
    // el alias que tenía antes de editar
    const aliasOriginal = requiereAlias || tarjeta.alias !== tarjeta.banco ? tarjeta.alias : '';
    // si cambió el alias, lo anota
    if (alias.trim() !== aliasOriginal) cambios.alias = alias.trim();
    // si cambió el cupo, lo anota
    if (cupoNumerico !== tarjeta.cupoTotal) cambios.cupoTotal = cupoNumerico;
    // si cambió el día, lo anota
    if (diaNumero !== tarjeta.diaVencimiento) cambios.diaVencimiento = diaNumero;
    // si no cambió nada, solo vuelve atrás
    if (Object.keys(cambios).length === 0) return router.back();

    // marca que está guardando
    setGuardando(true);
    // manda los cambios al servidor y espera la respuesta
    const { resultado, mensaje } = await editarTarjeta(tarjeta.id, cambios);
    // terminó de guardar
    setGuardando(false);

    // si no hay internet, lo avisa
    if (resultado === 'sin_conexion') return avisarSinConexion();
    // si el servidor dice que el cupo no alcanza
    if (resultado === 'sin_cupo') {
      // avisa que el cupo no puede ser menor a lo usado
      return avisar('Cupo insuficiente', `El cupo no puede ser menor a lo que ya está usado (${formatearCLP(usado)}).`);
    }
    // si algo más falló, muestra el error
    if (resultado !== 'ok') return avisar('Error', mensaje ?? 'No se pudo guardar la tarjeta.');
    // si salió bien, vuelve a la pantalla anterior
    router.back();
  };

  // lo que pasa al tocar "Eliminar tarjeta"
  const handleEliminar = () => {
    // "su compra" / "sus 3 compras"
    const contar = (n: number, singular: string, plural: string) => (n === 1 ? `su ${singular}` : `sus ${n} ${plural}`);
    // arma el texto de lo que también se borrará
    const detalle = [
      // las compras, si tiene
      cantidadCompras > 0 && contar(cantidadCompras, 'compra', 'compras'),
      // las suscripciones, si tiene
      cantidadSuscripciones > 0 && contar(cantidadSuscripciones, 'suscripción', 'suscripciones'),
    // quita lo vacío y une todo con " y "
    ].filter(Boolean).join(' y ');

    // muestra una ventana para confirmar
    confirmar({
      // título de la ventana
      titulo: 'Eliminar tarjeta',
      // mensaje que explica qué se borrará
      mensaje:
        // pregunta si quiere eliminar la tarjeta
        `¿Quieres eliminar ${tarjeta.banco}?` +
        // dice qué compras y suscripciones también se borran
        (detalle ? ` También se eliminarán ${detalle}.` : '') +
        // Si está compartida, deja de verse en las otras cuentas
        (tarjeta.compartidaCon.length > 0
          // dice quiénes dejarán de verla
          ? ` ${nombresCompartidos(tarjeta.compartidaCon)} dejará de verla.`
          // si no está compartida, no agrega nada
          : '') +
        // advierte que no se puede deshacer
        ' Esto no se puede deshacer.',
      // texto del botón para confirmar
      textoConfirmar: 'Eliminar',
      // el botón se muestra en rojo porque borra datos
      destructivo: true,
      // lo que pasa al confirmar
      onConfirmar: async () => {
        // le pide al servidor borrar la tarjeta y espera la respuesta
        const { resultado } = await eliminarTarjeta(tarjeta.id);
        // si salió bien, vuelve a la lista de tarjetas
        if (resultado === 'ok') return router.replace(RUTAS.tarjetas);
        // si no hay internet, lo avisa
        if (resultado === 'sin_conexion') return avisarSinConexion();
        // si falló por otra razón, muestra un error
        avisar('Error', 'No se pudo eliminar la tarjeta.');
      },
    });
  };

  // muestra la pantalla
  return (
    // marco de pantalla con el título "Editar Tarjeta" y botón para volver atrás
    <PantallaFormulario titulo="Editar Tarjeta" onVolver={() => router.back()}>
      {/* zona que se puede deslizar, con márgenes a los lados */}
      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        {/* Previsualización en vivo */}
        <View className="pt-4 pb-4">
          {/* el dibujo de la tarjeta con los cambios */}
          <CardItem item={previewItem} />
        </View>

        {/* Nombre / alias */}
        <CampoFormulario etiqueta={`Alias de la Tarjeta ${requiereAlias ? '(Obligatorio)' : '(Opcional)'}`}>
          {/* campo para escribir el alias */}
          <TextInput
            // muestra el alias guardado
            value={alias}
            // guarda el alias cada vez que el usuario escribe
            onChangeText={setAlias}
            // no deja escribir más letras de las permitidas
            maxLength={LIMITES.aliasMax}
            // texto de ejemplo según si el alias es obligatorio o no
            placeholder={requiereAlias ? 'Ej: Visa Platinum' : 'Ej: Tarjeta del trabajo (opcional)'}
            // color gris del texto de ejemplo
            placeholderTextColor="#94A3B8"
            // el campo se marca en rojo si falta el alias obligatorio
            className={estiloInput(requiereAlias && !alias.trim())}
          />
        </CampoFormulario>

        {/* Cupo Total */}
        <CampoFormulario etiqueta="Cupo Total">
          {/* campo para escribir el cupo total */}
          <TextInput
            // muestra el cupo con puntos de miles
            value={formatearMiles(cupo)}
            // guarda solo los números, sin pasarse del largo máximo
            onChangeText={(txt) => setCupo(soloDigitos(txt).slice(0, LIMITES.digitosMonto))}
            // abre el teclado de números
            keyboardType="numeric"
            // texto de ejemplo cuando el campo está vacío
            placeholder="$300.000"
            // color gris del texto de ejemplo
            placeholderTextColor="#94A3B8"
            // el campo se marca en rojo si el cupo es menor a lo ya usado
            className={estiloInput(cupoNumerico > 0 && cupoNumerico < usado)}
          />
          {/* si ya hay algo gastado, muestra cuánto debajo del campo */}
          {usado > 0 && (
            <Text className="text-slate-400 text-xs font-inter-regular mt-1.5">
              {/* dice cuánto está usado y si es entre varias personas */}
              Ya usado: {formatearCLP(usado)}{tarjeta.compartidaCon.length > 0 ? ' (entre todos los que la comparten)' : ''}
            </Text>
          )}
        </CampoFormulario>

        {/* Día Vencimiento */}
        <CampoFormulario etiqueta="Día de Facturación / Vencimiento" className="mb-8">
          {/* campo para escribir el día de facturación */}
          <TextInput
            // muestra el día guardado
            value={dia}
            // revisa y guarda el día cada vez que el usuario escribe
            onChangeText={handleCambioDia}
            // abre el teclado de números
            keyboardType="numeric"
            // máximo 2 dígitos
            maxLength={2}
            // texto de ejemplo cuando el campo está vacío
            placeholder="Seleccionar día (1 - 31)"
            // color gris del texto de ejemplo
            placeholderTextColor="#94A3B8"
            // estilo normal del campo
            className={estiloInput()}
          />
        </CampoFormulario>

        {/* Botón Guardar */}
        <TouchableOpacity
          // al tocarlo, revisa los datos y guarda los cambios
          onPress={handleGuardar}
          // no se puede tocar mientras se está guardando
          disabled={guardando}
          // botón verde ancho con esquinas redondeadas y sombra
          className="w-full h-12 bg-color-action rounded-2xl items-center justify-center mb-3 shadow-md"
          // se pone un poco transparente al tocarlo
          activeOpacity={0.8}
        >
          {/* texto blanco en negrita "Guardar Cambios" */}
          <Text className="text-white text-base font-inter-bold">Guardar Cambios</Text>
        </TouchableOpacity>

        {/* Botón Eliminar */}
        <TouchableOpacity
          // al tocarlo, pide confirmar para eliminar la tarjeta
          onPress={handleEliminar}
          // se pone un poco transparente al tocarlo
          activeOpacity={0.8}
          // botón blanco ancho con borde gris y esquinas redondeadas
          className="w-full h-12 mb-8 rounded-2xl items-center justify-center flex-row gap-2 bg-white border border-slate-300"
        >
          {/* ícono rojo de basurero */}
          <Ionicons name="trash-outline" size={20} color="#DC2626" />
          {/* texto rojo en negrita "Eliminar tarjeta" */}
          <Text className="text-red-600 text-base font-inter-bold">Eliminar tarjeta</Text>
        </TouchableOpacity>
      </ScrollView>
    </PantallaFormulario>
  );
}
