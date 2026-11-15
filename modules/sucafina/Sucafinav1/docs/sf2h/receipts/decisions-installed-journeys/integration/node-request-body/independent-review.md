# M52 — revisão independente estática do transporte composto sobre C23

Estado: **STATIC_REVIEW_COMPLETE / RUNTIME_NOT_EXECUTED_BY_REVIEWER**. Não há aprovação global, aceite de política ou transferência de PASS neste registro.

## Identidade

- Base C23: `25ed395829f9ec5f06a80c70467c23b25376f853`, tree `4082dba2644a6adf71de7a1af844dd7d063cbd70`.
- Path: `apps/cli/src/sucafina-product/installation.ts`.
- Preimage Microsoft49 lido via GitHub MCP e conferido no arquivo local: blob `21236af83e4de879242fd298d9e15a9923f3bf41`, SHA256 `6e20349d72f7131a1b66507d81907df78d18e2e8eedcafd9b741bba77b67b294`, 5315 bytes.
- Postimage proposto: blob `5d9fe7ec2f070dbbedc2bdbfff4c8458e1187437`, SHA256 `db7ff3461010172b2555795b1c1ef7b7c9d31cb46629de7dda2fe399ae74e4c2`, 6258 bytes.
- Referência de APIs: `Effect-TS/effect-smol@cd7ab658994104bd6fe8f841f1440bea32c387f5`, beta83, conforme `transport-c23-candidate/pinned-api-evidence.json`.

## Conclusão

**Nenhum bloqueio estático novo identificado neste postimage.** A composição preserva Microsoft49 e corrige o desvio de classificação de excesso de body apontado no candidato antigo3664ef. A qualificação runtime do novo SHA continua sendo trabalho da raiz em candidato isolado; esta revisão não executou teste ou compilação.

Foram conferidos três blocos modificados apenas: imports (5–6), consumo/reconstrução do body (43–48) e tratamento de causa (53–62). Comparação textual confirmou igualdade integral do prefixo de factory/transport até a reconstrução, do bridge/final signal/response e do sufixo de privacy/validação de transporte. Nenhum path de CurrentChoice46 foi editado.

## Fronteiras preservadas

| Fronteira | Revisão |
| --- | --- |
| Factory e configuração | `loadSfInstallation`, `composeSfInstallation`, validação de path/mount/origin e `readTransport` permanecem byte-idênticos. Nenhum header escolhe perfil ou fornece configuração. |
| Host e origens | Primeiro compara Host com ingress configurado; depois `toURL(sanitized)` deve coincidir com requestOrigin. Não usa hints de proxy como identidade de origem. |
| Proxy hints | Em transporte Microsoft, remove `forwarded` e todo `x-forwarded-*` antes de reconstruir URL. A filtragem é a mesma do preimage. |
| Headers e bytes | Cria Web Request com método e headers sanitizados originais. Usa ArrayBuffer, sem decode/encode de texto. A seleção de métodos é a mesma `HttpMethod.hasBody` do adaptador anterior. |
| Microsoft bridge | Chamada `microsoftRequest(web, transport)` preservada. O código canônico dessa função, blob `6e3b56e13795b60949bc14548921c37af16b615f`, verifica ingress/Host, apaga hints novamente, substitui Host pela origem HTTPS configurada e mantém método/path/query/body. |
| Privacy | A Layer que desativa tracing do listener em transporte Microsoft e sua posição externa a HttpRouter.serve não mudaram. O delta não adiciona log, serialização de causa ou detalhes de request em resposta. |
| Abort e scope | Body consumido na fibra do servidor; o clone final `new Request(request,{signal})` continua dentro da mesma Effect.tryPromise. Interrupção e os demais motivos seguem o tratamento redigido do preimage C23. |
| Limite | `sanitized.arrayBuffer` observa a MaxBodySize corrente. O body-limit canônico C23 permanece blob `f55e2c264aade5a27c9f1abcccf3c5a9c661f226`, com16MiB para /sucafina/* e413 para excesso. Nenhum teto foi aumentado. |

## Tratamento exato de causa

O body usa `Effect.orDie`. Em seguida, `catchCause` percorre `cause.reasons`; somente um `Cause.isDieReason(reason)` permite inspecionar `reason.defect`. A API fixada em beta83 declara exatamente essas formas.

O predicado que permite reemitir o defect é idêntico ao de `BodyLimit.exceeded`:

1. `HttpServerError.isHttpServerError(defect)`;
2. `defect.reason._tag === "RequestParseError"`;
3. `defect.reason.cause instanceof Error`;
4. `defect.reason.cause.message === "maxBytes exceeded"`.

Somente esse defect é devolvido por `Effect.die(defect)`, permitindo ao middleware externo criar o413 canônico com mensagem limitada ao tamanho e `connection:close`. Nenhuma causa arbitrária é reemitida ou convertida em texto público. Outros defects de leitura, erros tipados do handler e demais motivos retornam503 vazio, conservando a redação do C23. Uma causa composta que inclua o cutoff emite apenas o defect selecionado, sem encaminhar os outros motivos.

Isso resolve a lacuna estática do candidato anterior, cujo `Effect.catch` transformava o cutoff tipado em503 antes de ele alcançar BodyLimit.

## Limites

O comportamento Microsoft vivo, B2B, credenciais, o status HTTP efetivo em um socket interrompido e a execução deste postimage não foram demonstrados por esta leitura. Não há afirmação de que Bun.destroy causou a falha anterior; o accessor canônico também possui cleanup de stream. O resultado é revisão estática de composição e preservação, com hashes conferidos, sem escrita remota, teste, compilação ou alteração de política.

