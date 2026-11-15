/** Exactly the five main-process COPY-02 strings; app-shell dictionaries stay outside Electron main. */
export const SF_DESKTOP_COPY = Object.freeze({
  connectionTitle: "Connect Sucafina",
  connectionPrompt: "Allow Sucafina to connect to this server?",
  connectionDetail: (origin: string, projectId: string) => origin + "\nProject: " + projectId,
  cancel: "Cancel",
  connect: "Connect",
})
export const SF_DESKTOP_COPY_BR = Object.freeze({
  connectionTitle: "Conectar Sucafina",
  connectionPrompt: "Permitir que a Sucafina se conecte a este servidor?",
  connectionDetail: (origin: string, projectId: string) => origin + "\nProjeto: " + projectId,
  cancel: "Cancelar",
  connect: "Conectar",
})
