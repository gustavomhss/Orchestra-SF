# W01 e2 — Fragments INERTES para 114/I00

Sem escrita shared por W01. Revalidar estas preimages antes de editar:
`apps/desktop/src/main/index.ts` @ `51245e8469fa60decda9ed84efb3796fdf3fd510`
`apps/desktop/src/main/ipc.ts` @ `babb1249587caf085909ed6316bbd0b9f968ce3c`
`apps/desktop/src/main/owned-serve.ts` @ `08a84d3b8b6021f6590eb33e5ece22bc3d76d518`
`apps/desktop/src/preload/index.ts` @ `d03c62bb17ae88d31b0e74c7be65b27226e68536`
`apps/desktop/src/preload/types.ts` @ `c71515ffd200e521782378943377faa3f59f5667`
`apps/desktop/src/main/renderer-origin.ts` @ `5ce9ea6fdc76273d55c3696a00349b7956cea1c3`.

## Patch do preload, reservado à 114

No arquivo `preload/types.ts`, importar `SfDesktopCapability` de `@orchestra/client/sucafina/transport` e adicionar `sucafina: SfDesktopCapability` ao `ElectronAPI`. No `preload/index.ts`, importar `createSfDesktopPreloadCapability` de `./sucafina` e adicionar `sucafina: createSfDesktopPreloadCapability(ipcRenderer)` ao objeto literal `api:ElectronAPI`. Manter o único `contextBridge.exposeInMainWorld("api", api)`.

## Patch de composição do main, reservado à 114

Após instalar F01/F02/I00 reais, criar uma instância de `createSfDesktopBroker({electron:{app,BrowserWindow,ipcMain,session,net,dialog},operations:installedBindings,isRendererUrl:trustedRendererUrl,isMainWindow,ownedConnection:actualMainConnection,requestLocalEnrollment:authenticatedChildDockRoundTrip})`. Tratar remove/restart por `invalidateServer`; no quit chamar `dispose`. Não aceitar renderer-generated `serverKey` como conexão aprovada nem adotar `defaultSession`.

O `authenticatedChildDockRoundTrip` precisa correlacionar current launchId + requestId em AppDockSocket do filho de `owned-serve` e entregar `SfNativeEnrollmentReply` privado sem log/stdout/HTTP. Não inventar schema para return-intents: registrar forma exata no I00, depois reconciliar `auth.ts`.

## Files

A resposta `byte-response` fornece handle opaco e `byte-chunk` sequencial de no máximo 64 KiB. I00 deve conectar o consumidor ao `response-download` existente (begin/write/finish/cancel + chooser) e ao token da `read-picked-file` para origem de upload; não criar chooser/FS paralelo. Sem scanner-success presumido. O shared diff completo somente pode ser calculado pela 114 após instalar registry, bindings, providers e coletar preimages atuais; nenhum snippet acima foi aplicado.
