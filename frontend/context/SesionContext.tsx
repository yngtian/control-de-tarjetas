import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, configurarSesion, ErrorApi } from '../api/cliente';
import type { Resultado, Usuario } from '../api/tipos';
import { avisar } from '../constants/alertas';

// Dónde queda guardada la sesión en el dispositivo (en web, el localStorage del navegador)
const CLAVE_SESION = 'sesion';

interface SesionGuardada {
  token: string;
  usuario: Usuario;
}

/** Lo que devuelve ingresar / registrarse a la pantalla. */
interface ResultadoSesion {
  resultado: Resultado;
  mensaje?: string; // Con 'datos_invalidos': qué campo falló, listo para mostrar
}

/**
 * Sesión del usuario. Se accede con: const { usuario, cerrarSesion } = useSesion();
 * Mientras no hay usuario, _layout.tsx muestra la pantalla de acceso en vez de la app.
 */
interface SesionContextType {
  cargando: boolean;      // true mientras se revisa la sesión guardada al abrir la app
  usuario: Usuario | null;
  ingresar: (email: string, password: string) => Promise<ResultadoSesion>;
  registrarse: (nombre: string, email: string, password: string) => Promise<ResultadoSesion>;
  cerrarSesion: () => Promise<void>;
}

const SesionContext = createContext<SesionContextType | undefined>(undefined);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const cerrarSesion = useCallback(async () => {
    configurarSesion(null);
    setUsuario(null);
    try {
      await AsyncStorage.removeItem(CLAVE_SESION);
    } catch {
      // Sin almacenamiento disponible: la sesión ya se cerró en memoria
    }
  }, []);

  // El backend dijo que la sesión ya no vale (venció o es inválida): de vuelta a ingresar
  const sesionVencida = useCallback(() => {
    cerrarSesion();
    avisar('Sesión vencida', 'Vuelve a ingresar para continuar.');
  }, [cerrarSesion]);

  const abrirSesion = useCallback(
    async (sesion: SesionGuardada) => {
      configurarSesion(sesion.token, sesionVencida);
      setUsuario(sesion.usuario);
      try {
        await AsyncStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
      } catch {
        // Sin almacenamiento disponible: la sesión dura hasta cerrar la app
      }
    },
    [sesionVencida]
  );

  // Al abrir la app: retoma la sesión guardada si el backend la sigue aceptando
  useEffect(() => {
    const retomar = async () => {
      try {
        const texto = await AsyncStorage.getItem(CLAVE_SESION);
        if (!texto) return;
        const guardada: SesionGuardada = JSON.parse(texto);
        configurarSesion(guardada.token, sesionVencida);
        try {
          // Trae el perfil al día (y confirma que el token sigue valiendo)
          const { usuario: actual } = await api.yo();
          await abrirSesion({ token: guardada.token, usuario: actual });
        } catch (error) {
          // Respuesta de error (401 ya cerró la sesión): hay que ingresar de nuevo.
          // Sin conexión: se mantiene la sesión; la app mostrará "Sin conexión" con Reintentar.
          if (!(error instanceof ErrorApi)) setUsuario(guardada.usuario);
        }
      } catch {
        // Almacenamiento no disponible o sesión guardada ilegible: se pide ingresar
      } finally {
        setCargando(false);
      }
    };
    retomar();
  }, [abrirSesion, sesionVencida]);

  const ingresar = async (email: string, password: string): Promise<ResultadoSesion> => {
    const r = await api.ingresar(email, password);
    if (r.resultado === 'ok' && r.token && r.usuario) await abrirSesion({ token: r.token, usuario: r.usuario });
    return { resultado: r.resultado, mensaje: r.mensaje };
  };

  const registrarse = async (nombre: string, email: string, password: string): Promise<ResultadoSesion> => {
    const r = await api.registrarse(nombre, email, password);
    if (r.resultado === 'ok' && r.token && r.usuario) await abrirSesion({ token: r.token, usuario: r.usuario });
    return { resultado: r.resultado, mensaje: r.mensaje };
  };

  return (
    <SesionContext.Provider value={{ cargando, usuario, ingresar, registrarse, cerrarSesion }}>
      {children}
    </SesionContext.Provider>
  );
}

export function useSesion() {
  const context = useContext(SesionContext);
  if (!context) throw new Error('useSesion debe usarse dentro de SesionProvider');
  return context;
}
