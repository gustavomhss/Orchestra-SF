# W7 — por que DEBUG não expôs o lançamento

**Finding estático de observabilidade; causa do stall ainda não determinada.** A leitura usou GitHub MCP e fontes primárias do Playwright `v1.59.1`, resolvido ao commit `d466ac5358cae058cdc75d2ae3ab3ad220042730`. Nenhum produto ou teste foi executado localmente.

No W7 (`5886df8aaedb4db179f336e474e123c30a1d1193`), o driver publicado é `76188b9f567861b30dba3b22afce66d60a2424c8`, idêntico ao W6d. Ele define `DEBUG=pw:browser` antes de importar Playwright no Node. O log observado confirma que passou desse ponto e entrou em `chromium-launch`.

## Cadeia confirmada na biblioteca

| Fonte primária | Bloco | Constatação |
|---|---|---|
| [browserServerImpl.ts](https://github.com/microsoft/playwright/blob/d466ac5358cae058cdc75d2ae3ab3ad220042730/packages/playwright-core/src/browserServerImpl.ts) | 62, 74 | launchServer creates ProgressController(metadata) without the optional onCallLog callback. |
| [progress.ts](https://github.com/microsoft/playwright/blob/d466ac5358cae058cdc75d2ae3ab3ad220042730/packages/playwright-core/src/server/progress.ts) | 35, 38, 80, 84 | Progress.log appends to metadata.log and invokes only the optional callback. It does not call debugLogger itself. |
| [progress.ts](https://github.com/microsoft/playwright/blob/d466ac5358cae058cdc75d2ae3ab3ad220042730/packages/playwright-core/src/server/progress.ts) | 42, 49 | createForSdkObject supplies the callback that invokes debugLogger, but launchServer does not use that factory. |
| [processLauncher.ts](https://github.com/microsoft/playwright/blob/d466ac5358cae058cdc75d2ae3ab3ad220042730/packages/playwright-core/src/server/utils/processLauncher.ts) | 133, 144, 170, 174, 179 | Launch command, PID and browser stdout/stderr all flow into options.log; BrowserType sends those to progress.log. |
| [browserServerImpl.ts](https://github.com/microsoft/playwright/blob/d466ac5358cae058cdc75d2ae3ab3ad220042730/packages/playwright-core/src/browserServerImpl.ts) | 75, 77 | Recorded metadata.log is appended to the error when launchServer rejects. W7 observes outer scope cancellation, without a native launch rejection or attached metadata; physical process exit remains unproved. |

O caminho `launchServer` guarda suas mensagens de progresso em memória. O callback que encaminha essas mensagens ao logger de debug é fornecido por outra fábrica, que esse caminho não utiliza. O texto com comando, PID e saída do Chrome só é anexado ao erro quando a promise de lançamento rejeita. A interrupção externa do processo proprietário pode anteceder esse erro.

Isso explica por que adicionar apenas `DEBUG=pw:browser` não trouxe o diagnóstico pretendido. **A ausência de PID no log não demonstra que o processo Chrome nunca existiu.** O driver ainda não tinha obtido o `ready` e, por isso, também não havia publicado o PID por seu protocolo próprio.

## O que continua sem prova

A causa de `launchServer` permanecer pendente não foi identificada. A leitura não reprova o coletor stderr, o Omni, uma imagem de runner ou o tamanho da seleção. O próximo diagnóstico deve observar um limite de processo real ou um caminho de logging que efetivamente publique antes de `ready`, conservando prazo, captura limitada e assertions de cleanup.

Os recibos W7 já congelados permanecem intactos. Este adendo registra conhecimento posterior sobre a observabilidade. As fontes completas estão em `reference/playwright-v1.59.1/`; o JSON ao lado contém blobs, hashes e referências imutáveis.
