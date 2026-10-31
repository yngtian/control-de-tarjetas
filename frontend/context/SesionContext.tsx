// trae la memoria del teléfono para guardar la sesión
import AsyncStorage from '@react-native-async-storage/async-storage';
// trae las herramientas de React para compartir y recordar datos
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
// trae las funciones que hablan con el servidor
import { api, configurarSesion, ErrorApi } from '../api/cliente';
// trae la forma del resultado y del usuario
import type { Resultado, Usuario } from '../api/tipos';
// trae la función para mostrar avisos en pantalla
import { avisar } from '../constants/alertas';

// Dónde queda guardada la sesión en el dispositivo (en web, el localStorage del navegador)
const CLAVE_SESION = 'sesion';

// forma de la sesión que se guarda en el teléfono
interface SesionGuardada {
  // llave secreta que prueba que el usuario ingresó
  token: string;
  // datos del usuario que ingresó
  usuario: Usuario;
}

/** Lo que devuelve ingresar / registrarse a la pantalla. */
interface ResultadoSesion {
  // código que dice si se pudo ingresar o no
  resultado: Resultado;
  // mensaje opcional para mostrar al usuario
  mensaje?: string; // Con 'datos_invalidos': qué campo falló, listo para mostrar
}

/**
 * Sesión del usuario. Se accede con: const { usuario, cerrarSesion } = useSesion();
 * Mientras no hay usuario, _layout.tsx muestra la pantalla de acceso en vez de la app.
 */
interface SesionContextType {
  // dice si todavía se está revisando la sesión guardada
  cargando: boolean;      // true mientras se revisa la sesión guardada al abrir la app
  // usuario que ingresó, o vacío si nadie ingresó
  usuario: Usuario | null;
  // acción para ingresar con correo y contraseña
  ingresar: (email: string, password: string) => Promise<ResultadoSesion>;
  // acción para crear una cuenta nueva
  registrarse: (nombre: string, email: string, password: string) => Promise<ResultadoSesion>;
  // acción para salir de la cuenta
  cerrarSesion: () => Promise<void>;
}

// crea la caja vacía donde se guardará la sesión
const SesionContext = createContext<SesionContextType | undefined>(undefined);

// caja que guarda la sesión y la comparte con toda la app
export function SesionProvider({ children }: { children: ReactNode }) {
  // recuerda si todavía se está revisando la sesión
  const [cargando, setCargando] = useState(true);
  // recuerda qué usuario ingresó
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  // función para salir de la cuenta
  const cerrarSesion = useCallback(async () => {
    // olvida la llave secreta del usuario
    configurarSesion(null);
    // borra el usuario de la app
    setUsuario(null);
    // intenta borrar la sesión guardada en el teléfono
    try {
      // borra la sesión de la memoria del teléfono
      await AsyncStorage.removeItem(CLAVE_SESION);
    // si no se pudo borrar, entra aquí
    } catch {
      // Sin almacenamiento disponible: la sesión ya se cerró en memoria
    }
  }, []);

  // El backend dijo que la sesión ya no vale (venció o es inválida): de vuelta a ingresar
  const sesionVencida = useCallback(() => {
    // saca al usuario de su cuenta
    cerrarSesion();
    // muestra un aviso diciendo que la sesión venció
    avisar('Sesión vencida', 'Vuelve a ingresar para continuar.');
  }, [cerrarSesion]);

  // función que deja al usuario dentro de su cuenta
  const abrirSesion = useCallback(
    // recibe la llave secreta y los datos del usuario
    async (sesion: SesionGuardada) => {
      // le da la llave secreta al cliente del servidor
      configurarSesion(sesion.token, sesionVencida);
      // guarda en la app qué usuario ingresó
      setUsuario(sesion.usuario);
      // intenta guardar la sesión en el teléfono
      try {
        // guarda la sesión para no tener que ingresar de nuevo
        await AsyncStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
      // si no se pudo guardar, entra aquí
      } catch {
        // Sin almacenamiento disponible: la sesión dura hasta cerrar la app
      }
    },
    // se vuelve a crear solo si cambia la función de sesión vencida
    [sesionVencida]
  );

  // Al abrir la app: retoma la sesión guardada si el backend la sigue aceptando
  useEffect(() => {
    // función que intenta recuperar la sesión guardada
    const retomar = async () => {
      // intenta leer la memoria del teléfono
      try {
        // lee la sesión guardada en el teléfono
        const texto = await AsyncStorage.getItem(CLAVE_SESION);
        // si no había sesión guardada, no hace nada más
        if (!texto) return;
        // convierte el texto guardado en datos de sesión
        const guardada: SesionGuardada = JSON.parse(texto);
        // le da la llave secreta guardada al cliente del servidor
        configurarSesion(guardada.token, sesionVencida);
        // intenta confirmar la sesión con el servidor
        try {
          // Trae el perfil al día (y confirma que el token sigue valiendo)
          const { usuario: actual } = await api.yo();
          // deja al usuario dentro con sus datos al día
          await abrirSesion({ token: guardada.token, usuario: actual });
        // si el servidor falló, entra aquí
        } catch (error) {
          // Respuesta de error (401 ya cerró la sesión): hay que ingresar de nuevo.
          // Sin conexión: se mantiene la sesión; la app mostrará "Sin conexión" con Reintentar.
          if (!(error instanceof ErrorApi)) setUsuario(guardada.usuario);
        }
      // si no se pudo leer la memoria, entra aquí
      } catch {
        // Almacenamiento no disponible o sesión guardada ilegible: se pide ingresar
      // pase lo que pase, al final se ejecuta esto
      } finally {
        // ya terminó de revisar, deja de mostrar la carga
        setCargando(false);
      }
    };
    // arranca la recuperación de la sesión
    retomar();
  }, [abrirSesion, sesionVencida]);

  // función para ingresar con correo y contraseña
  const ingresar = async (email: string, password: string): Promise<ResultadoSesion> => {
    // manda el correo y la contraseña al servidor
    const r = await api.ingresar(email, password);
    // si salió bien, deja al usuario dentro de su cuenta
    if (r.resultado === 'ok' && r.token && r.usuario) await abrirSesion({ token: r.token, usuario: r.usuario });
    // devuelve a la pantalla cómo salió
    return { resultado: r.resultado, mensaje: r.mensaje };
  };

  // función para crear una cuenta nueva
  const registrarse = async (nombre: string, email: string, password: string): Promise<ResultadoSesion> => {
    // manda nombre, correo y contraseña al servidor
    const r = await api.registrarse(nombre, email, password);
    // si salió bien, deja al usuario dentro de su cuenta
    if (r.resultado === 'ok' && r.token && r.usuario) await abrirSesion({ token: r.token, usuario: r.usuario });
    // devuelve a la pantalla cómo salió
    return { resultado: r.resultado, mensaje: r.mensaje };
  };

  // entrega la sesión y sus acciones a toda la app
  return (
    <SesionContext.Provider value={{ cargando, usuario, ingresar, registrarse, cerrarSesion }}>
      {/* aquí van todas las pantallas de la app */}
      {children}
    </SesionContext.Provider>
  );
}

// atajo para usar la sesión en cualquier pantalla
export function useSesion() {
  // lee la sesión guardada en la caja
  const context = useContext(SesionContext);
  // si se usa fuera de SesionProvider, avisa con un error
  if (!context) throw new Error('useSesion debe usarse dentro de SesionProvider');
  // entrega la sesión a la pantalla
  return context;
}
