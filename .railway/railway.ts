import { defineRailway, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "control-de-tarjetas";
export default defineRailway(() => {
  const controlDeTarjetas = service("control-de-tarjetas", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    healthcheck: "/health",
    healthcheckTimeout: 120,
    replicas: { "iad": 1 },
  });

  return project("control-de-tarjetas", {
    variables: { managed: false },
    resources: [controlDeTarjetas],
  });
});
