# Proyecto App: control de tarjetas de crédito

App móvil para llevar las tarjetas de crédito en un solo lugar: registras tus tarjetas con su cupo y día de vencimiento, anotas las compras en cuotas y la app te va diciendo cuánto te toca pagar este mes, cuánto cupo te queda y si estás atrasado.

El proyecto está separado en dos partes:

- **`frontend/`**: la app hecha con Expo (React Native) para Android, iOS y web. Solo dibuja pantallas.
- **`backend/`**: una API en Node.js + Express. Guarda los datos en **Firebase Realtime Database** (un árbol JSON) y hace todos los cálculos.

## Qué se puede hacer

- Crear una cuenta e ingresar con correo y contraseña. Cada usuario ve solo sus propias tarjetas, compras y suscripciones, y la sesión queda guardada en el dispositivo hasta que se cierra desde el inicio.
- Agregar tarjetas de Banco Estado, CMR Falabella, Santander, Visa o MasterCard. Visa y MasterCard piden un alias para saber cuál es cuál.
- Ver todas las tarjetas con el cupo disponible y el % usado.
- Compartir una tarjeta con otra cuenta (botón "Compartir tarjeta" en su detalle, escribiendo el correo de la otra persona). Las dos personas ven la misma tarjeta con todas sus compras y suscripciones, y la marca "Cuenta compartida con ...". Cualquiera puede registrar gastos y el pago del mes, y lo que registra uno le aparece al otro (marcado "Registrada por ...") sin recargar: la app se actualiza sola cada 10 segundos y al volver a ella. Cada persona edita o elimina lo que ella registró; solo el dueño edita o elimina la tarjeta y elige con quién se comparte. Quien la recibió puede "dejar de verla".
- Registrar compras en una o varias cuotas. Si la compra se pasa del cupo, no se guarda.
- Registrar suscripciones (Netflix, Spotify…) que se cobran cada mes en una tarjeta.
- Ver el detalle de cada suscripción (tocándola en cualquier lista): precio mensual y anual, estado del pago (al día, por pagar o meses atrasados), próximo cobro, tarjeta con que se paga y desde cuándo está activa. Desde ahí se puede ir a su tarjeta o eliminarla.
- Ver el detalle de cada tarjeta: cuánto se paga este mes, cuándo vence y en qué cuota va cada compra.
- Editar una tarjeta propia (alias, cupo y día de vencimiento) o eliminarla junto con sus compras y suscripciones; si estaba compartida, deja de verse en las otras cuentas. El cupo no se puede bajar de lo que ya está usado.
- Editar una compra (tocándola en el detalle de la tarjeta) o eliminarla, liberando su cupo. El monto y las cuotas solo se cambian si todavía no se paga ninguna cuota; después, solo el motivo.
- Marcar el mes como pagado: las compras avanzan las cuotas pagadas y las que terminan se borran, liberando cupo.
- Meses sin pagar: si pasa un mes sin registrar el pago, sus cuotas y suscripciones se acumulan. La tarjeta muestra "N meses sin pagar" con el monto atrasado, el inicio avisa "Tienes pagos atrasados", y al pagar se cubre todo lo acumulado de una vez.
- Ver las proyecciones de 3, 6 o 12 meses: cuánto se pagará cada mes (cuotas + suscripciones), en qué tarjeta, cuánta deuda queda y en qué mes se paga la última cuota.

## Cómo correrlo

Se necesita Node.js 22 o más nuevo, y la app Expo Go en el celular si se quiere probar ahí. Hay que levantar las dos partes, cada una en su terminal.

**1. Backend** (queda en http://localhost:3000)

```bash
cd backend
npm install
npm run dev
```

Sin configurar nada, los datos se guardan en `backend/datos-local.json`, con la misma estructura que tendrán en Firebase. Para usar Firebase, ver la sección de abajo.

**2. Frontend**

```bash
cd frontend
npm install
npx expo start
```

Después escaneas el QR con Expo Go, o apretas `a` para Android, `i` para iOS o `w` para abrirla en el navegador.

La app busca el backend en el mismo computador que sirve la app, en el puerto 3000. Eso funciona en el navegador y en Expo Go si el celular está en la misma red wifi. Si el backend está en otra dirección, copia `frontend/.env.example` como `frontend/.env` y define `EXPO_PUBLIC_API_URL`.

**Cuentas:** la primera vez, crea tu cuenta desde la app con "Crear cuenta" (correo válido y contraseña de al menos 8 caracteres). No hay cuentas creadas de antemano.

**Probar una tarjeta compartida en un mismo computador:** abre la app en `http://localhost:8081` con una cuenta y en `http://127.0.0.1:8081` con otra: el navegador guarda una sesión distinta para cada dirección.

Si la app no logra conectarse, muestra una pantalla "Sin conexión" con la dirección que intentó y un botón para reintentar.

Otros comandos:

```bash
# frontend/
npm run lint      # revisa el código con ESLint
npx tsc --noEmit  # revisa los tipos de TypeScript

# backend/
npm run typecheck # revisa los tipos de TypeScript
npm start         # corre sin recargar al guardar cambios
```

## Conectar Firebase Realtime Database

1. En la [consola de Firebase](https://console.firebase.google.com/), crea un proyecto (o usa uno existente) y activa **Realtime Database**.
2. Copia la URL de la base. Aparece arriba de los datos, por ejemplo `https://mi-proyecto-default-rtdb.firebaseio.com`.
3. En *Configuración del proyecto → Cuentas de servicio*, aprieta **Generar nueva clave privada**. Se descarga un JSON: guárdalo como `backend/firebase-credenciales.json`.
4. Copia `backend/.env.example` como `backend/.env` y completa `FIREBASE_DATABASE_URL`.
5. Reinicia el backend. En la consola debe decir `Base de datos: Firebase Realtime Database (...)`.
6. Si ya tenías datos en el archivo local (`datos-local.json`), pásalos con `npm run migrar` dentro de `backend`. Copia todos los usuarios con sus tarjetas, compras y suscripciones; si un usuario ya existe en Firebase, lo reemplaza.

El JSON de credenciales da acceso total a la base: no lo subas al repositorio (ya está en `backend/.gitignore`). El backend entra con esa cuenta de servicio, así que las reglas de seguridad de la base no lo afectan, y la app nunca habla directo con Firebase.

Así queda el árbol en Firebase. Está pensado para leerse a simple vista en la consola: cada usuario tiene sus tarjetas, y cada tarjeta tiene adentro sus compras y suscripciones. Los identificadores se arman con el nombre de cada cosa (`jaimito-k3f9`, `banco-santander-a1b2`), más 4 letras al azar para que no se repitan.

```json
{
  "correos": {
    "jaimito@correo,cl": "jaimito-k3f9"
  },
  "usuarios": {
    "jaimito-k3f9": {
      "nombre": "Jaimito",
      "correo": "jaimito@correo.cl",
      "contrasena": "jaimito123",
      "contrasenaCifrada": "<sal:hash>",
      "tarjetas": {
        "banco-santander-a1b2": {
          "banco": "Banco Santander",
          "emisor": "santander",
          "color": "#DC2626",
          "cupo": 600000,
          "diaVencimiento": 15,
          "pagadoHasta": "2026-10",
          "compartidaCon": { "camila-p4q8": "Camila" },
          "compras": {
            "bicicleta-oxford-x9w2": {
              "descripcion": "Bicicleta Oxford",
              "monto": 359990,
              "cuotas": 6,
              "cuotaActual": 3,
              "primerMes": "2026-07",
              "registradaPor": "jaimito-k3f9"
            }
          },
          "suscripciones": {
            "netflix-7c3d": {
              "nombre": "Netflix",
              "plan": "Estándar",
              "monto": 10990,
              "desde": "2026-05",
              "pagadoHasta": "2026-10",
              "registradaPor": "jaimito-k3f9"
            }
          }
        }
      },
      "tarjetasDeOtros": {
        "visa-camila-m2n6": "camila-p4q8"
      }
    }
  }
}
```

- **`correos`** sirve solo para ingresar: dice a qué usuario pertenece cada correo. Firebase no acepta puntos en las claves, por eso el correo va con `,` en vez de `.`.
- **`contrasena`** es la contraseña tal cual, para poder verla en la consola. Para ingresar se usa **`contrasenaCifrada`**, un hash (scrypt con sal) que no se puede revertir. Las cuentas creadas antes de este cambio muestran su contraseña después de su próximo ingreso.
- **`pagadoHasta`** es el último mes pagado; **`primerMes`** y **`desde`**, el primer mes que se cobra una compra o una suscripción. Una tarjeta Visa o MasterCard usa su alias como título (`banco`); en los demás bancos, `alias` aparece solo si es distinto del nombre del banco.
- **Tarjetas compartidas:** una tarjeta se guarda una sola vez, en el usuario dueño, con sus compras y suscripciones adentro aunque las registre otra persona (`registradaPor` dice quién). En `compartidaCon` están las personas que la ven, y cada una anota en `tarjetasDeOtros` de quién es. Así todos leen y escriben la misma copia.

Solo se guarda lo que escribe el usuario. Todo lo demás (monto del mes, cupo disponible, vencimientos, proyecciones) se calcula en cada consulta, así nunca queda desactualizado.

## API

| Método | Ruta | Qué hace |
| --- | --- | --- |
| POST | `/api/auth/registro` | Crear cuenta (body: `{ nombre, email, password }`); responde `{ token, usuario }` (409 si el correo ya existe) |
| POST | `/api/auth/login` | Ingresar (body: `{ email, password }`); responde `{ token, usuario }` (401 si el correo o la contraseña no son correctos) |
| GET | `/api/auth/yo` | El usuario de la sesión actual |
| GET | `/api/estado` | Todo lo que la app necesita: tarjetas, compras y suscripciones ya calculadas, y los totales |
| GET | `/api/proyecciones?meses=6` | Pagos proyectados mes a mes (1 a 24 meses) |
| POST | `/api/tarjetas` | Nueva tarjeta |
| POST | `/api/tarjetas/:id/compartir` | Compartir una tarjeta propia con otra cuenta (body: `{ email }`; 404 si no hay cuenta con ese correo) |
| DELETE | `/api/tarjetas/:id/miembros/:uid` | Dejar de compartirla con alguien (el dueño), o dejar de verla (el propio miembro) |
| PATCH | `/api/tarjetas/:id` | Editar `alias`, `cupoTotal` o `diaVencimiento` (409 si el cupo queda bajo lo usado) |
| DELETE | `/api/tarjetas/:id` | Eliminar la tarjeta con sus compras y suscripciones (403 si es de otra persona) |
| POST | `/api/tarjetas/:id/pagar` | Registrar el pago de todo lo acumulado, meses atrasados incluidos (también en una tarjeta compartida) (409 si ya estaba pagado) |
| POST | `/api/transacciones` | Nueva compra en cuotas (409 si supera el cupo) |
| PATCH | `/api/transacciones/:id` | Editar `motivo`, `monto` o `cuotas` (409 si ya tiene cuotas pagadas o no cabe en el cupo) |
| DELETE | `/api/transacciones/:id` | Eliminar la compra |
| POST | `/api/suscripciones` | Nueva suscripción (409 si supera el cupo) |
| DELETE | `/api/suscripciones/:id` | Eliminar una suscripción |

Todas las rutas salvo registro e ingreso exigen el encabezado `Authorization: Bearer <token>` (si falta o venció, responden 401) y trabajan solo con los datos de ese usuario.

Las acciones responden `{ resultado, estado }`. Si salió bien, la app reemplaza su estado por el nuevo sin tener que volver a pedirlo.

### Validaciones

La API valida todo lo que recibe, aunque la app ya lo haya revisado antes. Si un dato no sirve, responde `400` con `{ resultado: "datos_invalidos", mensaje }`, y el mensaje explica qué campo falló (por ejemplo, "La cantidad de cuotas debe ser un número entero entre 1 y 48."). Un JSON mal formado también responde `400`.

| Dato | Regla |
| --- | --- |
| Cupo, monto de compra y de suscripción | Entero entre 1 y 999.999.999 |
| Cuotas | Entero entre 1 y 48 |
| Día de vencimiento | Entero entre 1 y 31 |
| Emisor | Uno de los bancos de la lista; Visa y MasterCard exigen alias |
| Motivo de la compra | Obligatorio, máximo 60 caracteres |
| Nombre de suscripción / plan / alias | Máximo 40 / 40 / 30 caracteres |
| Color | Formato `#RRGGBB` |

Además se rechaza una compra o suscripción que supera el cupo disponible (`409`) y pagar dos veces el mismo mes (`409`). Los límites están en `backend/src/limites.ts` y la app usa una copia en `frontend/constants/limites.ts`: si cambias uno, cambia el otro.

## Cómo está organizado

```
frontend/                    app Expo
  app/                       pantallas (expo-router: cada archivo es una pantalla)
    _layout.tsx              carga fuentes, providers y el Stack de pantallas
    index.tsx                inicio
    Tarjetas.tsx             lista de tarjetas
    Suscripciones.tsx        lista de suscripciones
    Proyecciones.tsx         pagos proyectados de los próximos meses
    Registrar*.tsx           formularios de tarjeta, compra y suscripción
    detalle-tarjeta/[id].tsx detalle de una tarjeta
    detalle-suscripcion/[id].tsx detalle de una suscripción
  api/
    cliente.ts               llamadas HTTP al backend
    tipos.ts                 tipos de lo que devuelve la API
  components/                piezas de UI reutilizables
  context/AppContext.tsx     guarda la última respuesta del backend y expone las acciones
  context/SesionContext.tsx  sesión del usuario: ingresar, crear cuenta, cerrar sesión
  constants/                 bancos, rutas, formato de montos, nombres de meses y avisos

backend/                     API Node.js + Express
  src/
    index.ts                 arranca el servidor
    migrar.ts                pasa los datos del archivo local a Firebase (npm run migrar)
    auth.ts                  contraseñas (scrypt) y tokens de sesión firmados
    rutasAuth.ts             crear cuenta, ingresar y exigir sesión
    validacion.ts            validaciones comunes del body
    rutas.ts                 endpoints y validación de lo que llega
    limites.ts               límites de cuotas, montos y textos
    servicio.ts              acciones y reglas de negocio (cupo, corte, pago del mes)
    db.ts                    Firebase Realtime Database (o el archivo local)
    almacen.ts               cómo se guardan los datos en Firebase y su traducción a la lógica
    modelos.ts               tipos de lo que se guarda y lo que se entrega
    logica/                  cálculos puros: cuotas, fechas, estado, proyecciones
```

## Tecnologías

- **Frontend:** Expo SDK 58 con React Native 0.88 y React 19.3, expo-router, NativeWind 4 + Tailwind 3, TypeScript y la fuente Inter.
- **Backend:** Node.js con Express 5, firebase-admin, TypeScript (se ejecuta con tsx).

## Cosas pendientes y detalles conocidos

- **Las contraseñas se ven en Firebase** (campo `contrasena`), a pedido. Cualquiera con acceso a la consola o al JSON de credenciales las ve, y la gente suele repetir contraseñas en otros servicios. Antes de que la usen otras personas conviene dejar de guardarlas: quitar esa línea en `rutasAuth.ts` y borrar los campos `contrasena`; el ingreso sigue funcionando con `contrasenaCifrada`.
- **No se cambia el banco de una tarjeta ni la tarjeta de una compra.**
- **Compartir es inmediato:** al escribir el correo, la otra persona ya ve la tarjeta; no hay invitación que aceptar ni aviso. Los cambios del otro llegan en hasta 10 segundos (la app consulta al servidor; no hay notificaciones en tiempo real).
- **El pago es siempre del total acumulado:** no hay pagos parciales ni registro del monto pagado.
- **Cuentas sin recuperación de contraseña ni límite de intentos.** No hay "olvidé mi contraseña" ni bloqueo tras varios intentos fallidos. Antes de publicar la API conviene agregar ambos y servirla con HTTPS.
- **Secreto de sesión:** en producción hay que definir `SESSION_SECRET` en `backend/.env`. Sin ella, en desarrollo se genera uno en `backend/.secreto-sesion`.
- Los límites (`limites.ts`) y los tipos de la API están copiados en el backend y en la app. Los tipos están en `backend/src/modelos.ts` y `frontend/api/tipos.ts`. Si cambia uno, hay que actualizar el otro.
