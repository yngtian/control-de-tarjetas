# Imagen que usa Railway: arma la app web y la publica junto con la API en un solo servicio.
# Los datos viven en Firebase; las variables secretas se definen en Railway (ver README).

# ---------- 1) App web: el frontend de Expo convertido en archivos para el navegador ----------
FROM node:24-slim AS web
WORKDIR /app/frontend
# primero solo las dependencias, así se reutilizan si no cambian
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
# después el código de la app
COPY frontend/ ./
# deja la app web lista en frontend/dist
RUN npx expo export --platform web

# ---------- 2) Backend: la API, que además entrega la app web ----------
FROM node:24-slim
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
# --include=dev porque el servidor corre con tsx (está en devDependencies)
RUN npm ci --include=dev
COPY backend/ ./
# la app web armada queda en la misma carpeta que en el repositorio (backend/../frontend/dist)
COPY --from=web /app/frontend/dist /app/frontend/dist

# producción: exige Firebase y SESSION_SECRET (no usa archivos locales que se borrarían)
ENV NODE_ENV=production
# Las fechas (mes actual, días de corte y vencimientos) se calculan con la hora de Chile
ENV TZ=America/Santiago

# Railway define PORT; el servidor lo lee solo
CMD ["node", "--import", "tsx", "src/index.ts"]
