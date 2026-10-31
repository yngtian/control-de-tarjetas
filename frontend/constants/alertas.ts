// trae las ventanas de aviso y la forma de saber si es web o teléfono
import { Alert, Platform } from 'react-native';

/**
 * Diálogos que funcionan igual en web y móvil.
 *
 * Por qué existen: en web `Alert.alert` con botones NO hace nada, hay que usar
 * window.alert / window.confirm. Estas funciones esconden esa diferencia para
 * que las pantallas no repitan el `if (Platform.OS === 'web')`.
 */

// dice si la app se está usando en el navegador
const esWeb = Platform.OS === 'web';

/**
 * Mensaje informativo con un solo botón "OK".
 * `onAceptar` se ejecuta cuando el usuario cierra el mensaje (útil para navegar después).
 */
export function avisar(titulo: string, mensaje: string, onAceptar?: () => void) {
  // si es el navegador, usa el aviso del navegador
  if (esWeb) {
    // muestra el aviso con el título y el mensaje
    window.alert(`${titulo}\n\n${mensaje}`);
    // cuando el usuario cierra el aviso, hace lo que se pidió
    onAceptar?.();
    // termina aquí, no sigue con el aviso del teléfono
    return;
  }
  // en el teléfono, muestra el aviso con un botón "OK"
  Alert.alert(titulo, mensaje, onAceptar ? [{ text: 'OK', onPress: onAceptar }] : undefined);
}

// datos que necesita la pregunta de confirmar
interface OpcionesConfirmar {
  // título de la pregunta
  titulo: string;
  // texto de la pregunta
  mensaje: string;
  // texto del botón para aceptar (opcional)
  textoConfirmar?: string;
  // texto del botón para cancelar (opcional)
  textoCancelar?: string;
  // si es para borrar algo, el botón sale en rojo
  destructivo?: boolean;      // Pinta el botón de rojo en iOS (ej: eliminar)
  // qué hacer si el usuario acepta
  onConfirmar: () => void;
  // qué hacer si el usuario cancela (opcional)
  onCancelar?: () => void;
}

/** Pregunta con dos botones (cancelar / confirmar). */
export function confirmar({
  // título de la pregunta
  titulo,
  // texto de la pregunta
  mensaje,
  // si no se indica, el botón dice "Confirmar"
  textoConfirmar = 'Confirmar',
  // si no se indica, el botón dice "Cancelar"
  textoCancelar = 'Cancelar',
  // si no se indica, el botón no sale en rojo
  destructivo = false,
  // qué hacer si el usuario acepta
  onConfirmar,
  // qué hacer si el usuario cancela
  onCancelar,
}: OpcionesConfirmar) {
  // si es el navegador, usa la pregunta del navegador
  if (esWeb) {
    // si el usuario aceptó, hace la acción
    if (window.confirm(`${titulo}\n\n${mensaje}`)) onConfirmar();
    // si canceló, hace lo de cancelar
    else onCancelar?.();
    // termina aquí, no sigue con la pregunta del teléfono
    return;
  }
  // en el teléfono, muestra la pregunta con dos botones
  Alert.alert(titulo, mensaje, [
    // botón para cancelar
    { text: textoCancelar, style: 'cancel', onPress: onCancelar },
    // botón para aceptar (en rojo si es para borrar)
    { text: textoConfirmar, style: destructivo ? 'destructive' : 'default', onPress: onConfirmar },
  ]);
}

/** Aviso estándar cuando el backend no responde. */
export function avisarSinConexion() {
  // muestra el aviso de que no hay conexión con el servidor
  avisar('Sin conexión', 'No se pudo conectar con el servidor. Revisa que el backend esté corriendo e inténtalo de nuevo.');
}
