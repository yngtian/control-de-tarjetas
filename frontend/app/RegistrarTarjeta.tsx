// iconos de Ionicons
import { Ionicons } from '@expo/vector-icons';
// para navegar entre pantallas
import { useRouter } from 'expo-router';
// useState para guardar lo que se escribe en el formulario
import React, { useState } from 'react';
// trae las piezas básicas: lista con scroll, texto, campo para escribir, botón y caja
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

// trae el campo del formulario con su etiqueta, su estilo y el selector
import { CampoFormulario, estiloInput, SelectorCampo } from '../components/CampoFormulario';
// trae la ventana que sube desde abajo para elegir una opción
import ModalSeleccion, { FilaOpcion } from '../components/ModalSeleccion';
// trae el marco de pantalla con título y botón para volver
import PantallaFormulario from '../components/PantallaFormulario';
// trae el dibujo grande de la tarjeta
import CardItem from '../components/TarjetaGrande';
// trae las funciones para mostrar avisos
import { avisar, avisarSinConexion } from '../constants/alertas';
// trae la lista de bancos y la forma de cada banco
import { BankOption, LISTA_BANCOS } from '../constants/banks';
// trae las funciones que ponen puntos de miles y dejan solo números
import { formatearMiles, soloDigitos } from '../constants/formato';
// trae los largos máximos permitidos en los campos
import { LIMITES } from '../constants/limites';
// trae las direcciones de las pantallas de la app
import { RUTAS } from '../constants/rutas';
// trae la forma de una tarjeta y los datos generales de la app
import { TarjetaItem, useApp } from '../context/AppContext';

// la pantalla para registrar una tarjeta nueva
export default function NuevaTarjetaScreen() {
  // sirve para ir a otras pantallas
  const router = useRouter();
  // sacamos la funcion que agrega tarjetas al contexto
  const { agregarTarjeta } = useApp();

  // banco elegido, parte con el primero de la lista (Banco Estado)
  const [bancoSeleccionado, setBancoSeleccionado] = useState<BankOption>(LISTA_BANCOS[0]);

  // guarda el alias que escribe el usuario
  const [alias, setAlias] = useState('');
  const [cupo, setCupo] = useState('');   // Solo dígitos; se muestra con puntos de miles
  // guarda el día de facturación que escribe el usuario
  const [dia, setDia] = useState('');
  // si el modal de bancos esta abierto o cerrado
  const [modalVisible, setModalVisible] = useState(false);
  // evita guardar dos veces mientras espera la respuesta del servidor
  const [guardando, setGuardando] = useState(false);
  // lo que se escribe en el buscador del modal
  const [busqueda, setBusqueda] = useState('');

  // 1. Identificamos si es una tarjeta genérica que obliga a usar alias
  const requiereAlias = bancoSeleccionado.id === 'visa' || bancoSeleccionado.id === 'mastercard';

  // 2. Definimos qué título se mostrará en grande en la tarjeta gráfica
  const tituloTarjeta = requiereAlias && alias.trim() !== ''
    // si hay alias, usa el alias sin espacios de sobra
    ? alias.trim()
    // si no, usa el nombre del banco
    : bancoSeleccionado.nombre;

  // pasa el cupo escrito a número (0 si está vacío)
  const cupoNumerico = parseInt(cupo, 10) || 0;

  // Previsualización dinámica: la tarjeta se va armando mientras el usuario escribe
  const previewItem: TarjetaItem = {
    // un id de mentira solo para la vista previa
    id: 'preview',
    // el banco o emisor elegido
    emisor: bancoSeleccionado.id,
    // la tarjeta es del usuario
    propia: true,
    // no hay otro dueño
    duenoNombre: null,
    // todavía no se comparte con nadie
    compartidaCon: [],
    // todavía no tiene otras personas
    miembros: [],
    // el título grande de la tarjeta
    banco: tituloTarjeta,
    // el nombre de la tarjeta
    nombre: tituloTarjeta,
    // si no hay alias muestra "Sin alias"
    alias: alias || 'Sin alias',
    // monto en 0 porque una tarjeta nueva no tiene compras
    monto: '$0',
    // el mismo monto pero como número
    montoNumerico: 0,
    // si el dia esta vacio usa 1 para que no quede NaN
    diaVencimiento: parseInt(dia, 10) || 1,
    // sin texto de estado de vencimiento
    estadoVencimiento: '',
    // si ya escribieron el dia lo muestra, si no sale "Fecha de corte"
    vencimiento: dia ? `${dia} de este mes` : 'Fecha de corte',
    // el color sale del banco elegido
    colorHex: bancoSeleccionado.colorHex,
    // el cupo total que escribió el usuario
    cupoTotal: cupoNumerico,
    // al inicio todo el cupo está disponible
    cupoDisponible: cupoNumerico,
    // todavía no se ha pagado este mes
    pagadaEsteMes: false,
    // no tiene meses atrasados
    mesesAtrasados: 0,
    // no debe nada atrasado
    montoAtrasado: 0,
  };

  // lo que pasa al tocar "Guardar Tarjeta"
  const handleGuardar = async () => {
    // si ya se está guardando, no hace nada
    if (guardando) return;

    // === VALIDACIONES ===

    // A) Validación del Alias Obligatorio para Visa/Mastercard
    if (requiereAlias && !alias.trim()) {
      // muestra un aviso pidiendo el alias
      avisar(
        // título del aviso
        'Alias obligatorio',
        // mensaje del aviso con el nombre del banco
        `Por favor ingresa un nombre para identificar tu tarjeta ${bancoSeleccionado.nombre} (Ej: Visa Platinum).`
      );
      // no sigue
      return;
    }

    // pasa el dia a numero
    const diaNumero = parseInt(dia, 10);
    // si esta vacio, no es numero o se sale de 1 a 31, avisa y corta
    if (!dia.trim() || isNaN(diaNumero) || diaNumero < 1 || diaNumero > 31) {
      // avisa que el día no es válido
      avisar('Día inválido', 'Por favor ingresa un día de facturación válido entre 1 y 31.');
      // no sigue
      return;
    }

    // el cupo tiene que ser mayor a 0
    if (cupoNumerico <= 0) {
      // avisa que el cupo no es válido
      avisar('Cupo inválido', 'Por favor ingresa un cupo total mayor a 0.');
      // no sigue
      return;
    }

    // === GUARDADO ===

    // guarda la tarjeta en el backend, el resto de datos (monto del mes, cupo disponible) se calculan alla
    setGuardando(true);
    // manda la tarjeta nueva y espera la respuesta
    const { resultado, mensaje } = await agregarTarjeta({
      // el banco o emisor elegido
      emisor: bancoSeleccionado.id,
      banco: tituloTarjeta, // Título principal de la tarjeta
      // el nombre de la tarjeta
      nombre: tituloTarjeta,
      alias: alias.trim(), // Nombre interno; si va vacío el backend usa el nombre del banco
      // el día de facturación como número
      diaVencimiento: diaNumero,
      // el color del banco elegido
      colorHex: bancoSeleccionado.colorHex,
      // el cupo total que escribió el usuario
      cupoTotal: cupoNumerico,
    });
    // terminó de guardar
    setGuardando(false);

    // si no hay internet, lo avisa
    if (resultado === 'sin_conexion') return avisarSinConexion();
    // si algo falló, muestra el error
    if (resultado !== 'ok') return avisar('Error', mensaje ?? 'No se pudo guardar la tarjeta. Revisa los datos.');

    // si salió bien, vuelve a la lista de tarjetas
    router.replace(RUTAS.tarjetas);
  };

  // deja solo los bancos cuyo nombre coincide con lo buscado
  const bancosFiltrados = LISTA_BANCOS.filter((b) =>
    // compara sin importar mayúsculas o minúsculas
    b.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Día de facturación: solo números y nunca mayor a 31
  const handleCambioDia = (texto: string) => {
    // quita todo lo que no sea número
    const soloNumeros = soloDigitos(texto);

    // Si lo deja vacío, permitir borrar
    if (soloNumeros === '') {
      // deja el día vacío
      setDia('');
      // no sigue
      return;
    }

    // Impedir que escriba un número superior a 31
    if (parseInt(soloNumeros, 10) <= 31) {
      // guarda el día escrito
      setDia(soloNumeros);
    }
  };

  // muestra la pantalla
  return (
    // marco de pantalla con el título "Nueva Tarjeta" y botón para volver al inicio
    <PantallaFormulario titulo="Nueva Tarjeta" onVolver={() => router.replace(RUTAS.inicio)}>
      {/* zona que se puede deslizar, con márgenes a los lados */}
      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        {/* Previsualización en vivo */}
        <View className="pt-4 pb-4">
          {/* el dibujo de la tarjeta con lo que se va escribiendo */}
          <CardItem item={previewItem} />
        </View>

        {/* Selector de Banco */}
        <CampoFormulario etiqueta="Emisor / Banco">
          {/* caja que al tocarla abre la lista de bancos */}
          <SelectorCampo onPress={() => setModalVisible(true)}>
            {/* texto negro con el banco elegido */}
            <Text className="text-slate-900 text-sm font-inter-medium">
              {/* el nombre del banco elegido */}
              {bancoSeleccionado.nombre}
            </Text>
          </SelectorCampo>
        </CampoFormulario>

        {/* Alias (obligatorio solo en Visa / MasterCard) */}
        <CampoFormulario etiqueta={`Alias de la Tarjeta ${requiereAlias ? '(Obligatorio)' : '(Opcional)'}`}>
          {/* campo para escribir el alias */}
          <TextInput
            // muestra el alias guardado
            value={alias}
            // guarda el alias cada vez que el usuario escribe
            onChangeText={setAlias}
            // no deja escribir más letras de las permitidas
            maxLength={LIMITES.aliasMax}
            // texto de ejemplo cuando el campo está vacío
            placeholder={
              // si el alias es obligatorio
              requiereAlias
                // muestra un ejemplo con el nombre del banco
                ? `Ej: ${bancoSeleccionado.nombre} Platinum`
                // si no, un ejemplo opcional
                : 'Ej: Tarjeta del trabajo (opcional)'
            }
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
            // estilo normal del campo
            className={estiloInput()}
          />
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
            // maximo 2 digitos
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
          // al tocarlo, revisa los datos y guarda la tarjeta
          onPress={handleGuardar}
          // botón verde ancho con esquinas redondeadas y sombra
          className="w-full h-12 bg-color-action rounded-2xl items-center justify-center mb-8 shadow-md"
          // se pone un poco transparente al tocarlo
          activeOpacity={0.8}
        >
          {/* texto blanco en negrita del botón */}
          <Text className="text-white text-base font-inter-bold">
            Guardar Tarjeta
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Selección de Banco (con buscador) */}
      <ModalSeleccion
        // se muestra solo si está abierta
        visible={modalVisible}
        // título de la ventana
        titulo="Seleccionar Banco"
        // ocupa como máximo el 80% del alto de la pantalla
        alturaMax="max-h-[80%]"
        // al cerrarla, se oculta
        onCerrar={() => setModalVisible(false)}
        // buscador que va arriba de la lista
        encabezadoExtra={
          // caja blanca redondeada con borde gris para el buscador
          <View className="mt-4 h-12 px-4 bg-white rounded-2xl border border-slate-200 flex-row items-center">
            {/* ícono gris de lupa */}
            <Ionicons name="search" size={18} color="#94A3B8" />
            {/* campo para escribir lo que se busca */}
            <TextInput
              // muestra lo que se está buscando
              value={busqueda}
              // guarda lo que escribe el usuario
              onChangeText={setBusqueda}
              // texto de ejemplo cuando está vacío
              placeholder="Buscar banco o emisor..."
              // color gris del texto de ejemplo
              placeholderTextColor="#94A3B8"
              // ocupa el resto del ancho, texto gris oscuro
              className="flex-1 text-slate-800 ml-2"
            />
          </View>
        }
      >
        {/* una fila por cada banco que coincide con la búsqueda */}
        {bancosFiltrados.map((item) => (
          // fila de un banco
          <FilaOpcion
            // identifica cada fila con el id del banco
            key={item.id}
            // marca la fila si es el banco elegido
            seleccionada={bancoSeleccionado.id === item.id}
            // lo que pasa al tocar un banco
            onPress={() => {
              // guarda el banco elegido
              setBancoSeleccionado(item);
              setAlias(''); // El alias depende del banco elegido
              // cierra la ventana
              setModalVisible(false);
            }}
          >
            {/* el nombre del banco en negro */}
            <Text className="text-slate-900 text-base font-inter-medium">{item.nombre}</Text>
          </FilaOpcion>
        ))}
      </ModalSeleccion>

    </PantallaFormulario>
  );
}
