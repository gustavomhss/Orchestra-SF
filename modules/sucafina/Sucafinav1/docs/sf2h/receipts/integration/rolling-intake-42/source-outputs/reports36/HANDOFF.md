# Missão36 — Reports: recuperação de rascunhos e jornadas reais

## Estado terminal

**Implementação própria comitada na mesma `astra-wp07` / PR27; entrega liberada à sessão33 como implementação. Aceitação funcional bloqueada.**

Estado: `TERMINAL_BLOCKED_SHARED_ROUTER`, ator S3-A, lease `reports-browser36`. O [CONSUMER-RELEASE.json](CONSUMER-RELEASE.json) encerra esta entrega de forma explícita, sem conceder aprovação de campanha ou nova autoridade de dispatcher.

A execução nominal **selecionou e iniciou os quatro casos** sobre C6 mais os dez deltas próprios. Todos falharam no setup da instalação real, antes da primeira assertion de negócio:

```text
Reports CLI exited 1 before readiness
Method 'ACL' already declared for route '/sucafina'
```

Isso é uma colisão de registro no loader compartilhado. **Reports já foi incorporado ao C6**, com os dezenove paths materiais e os 54 recibos da missão25. A montagem entregue não foi recriada e o diagnóstico antigo de montagem ausente não se aplica.

[RUNS.json](RUNS.json), [FINDINGS.json](FINDINGS.json), [PRECONDITIONS.json](PRECONDITIONS.json) e [evidence/nominal-03.log](evidence/nominal-03.log) registram a fronteira entre implementação, checks isolados e jornada real.

## Identidades e preservação de histórico

| Identidade | Commit | Tree / relação |
|---|---|---|
| Planejamento fixo | `dbf9547211d9b0fade619790de7c19c0869b7c7d` | Pack completo S3-A e anexos; recibo de leituras separado por leitor |
| Fonte inicial da PR27 | `2b418a754e90d9f52f69e570e6c8e36adda3f4a8` | HANDOFF25 e CONSUMER-RELEASE25 reconciliados antes de editar |
| C6, input integral | `52add8433f8ecf9d361ee635cda484142131ef84` | `efec3fadd92b1507a1c42bdf5aad48b7e778c17d` |
| Produto próprio entregue, Wsource4 | `73b716b89d84dfba10070cf4a9369ca9c9e75159` | `fbe942eb99a3e73e95fcf79ec2d9ef056001b249` |
| Produto coerente testado, Wtest4 | `83d7102664c9983a06fabffcc61334165cba756d` | `5cf09ca749d89b6705ee0ded2182ef672303407f`; parent C6 |
| Envelope nominal S3 | `624bfe326a7a11f8509541eb254501c28e6ee3f9` | `8d3731cab27de62da6844b0ba76cf42cc95e2d9a`; parent Wtest4 |

[INPUT-CLOSURE.json](INPUT-CLOSURE.json) contém a proveniência SHA/path/blob dos dez postimages, seus preimages C6, os dezenove inputs materiais já consumidos, fixtures, host, dispatcher e configurações. Wtest4 contém a árvore integral C6 com **somente dez overlays próprios**. S3 difere de Wtest4 **somente em `.ci-run.json`**. Os blobs próprios de Wsource4 e Wtest4 são iguais. Nenhum patch compartilhado foi aplicado ao produto testado.

A cadeia da PR é preservada: autoridade `1a7bbe4258c155f48854e9f67471f12924457bd7`, depois Wsource1 `8038b99b724165948ecc6c03ed3ee1a2729e7ec1`, Wsource2 `54db6e5d16dd47cb2dfca680f98f1ffae9ed6856`, Wsource3 `2e902bcc5ccdf6183309c80c13c82a51d9af0e6f` e Wsource4 acima. O commit que contém este handoff acrescenta ou atualiza **somente recibos próprios**; o produto verificado continua Wsource4.

## Correção de REPORTS25-DRAFT-LOSS-ON-ACTION-ERROR

A view guarda rascunhos de resposta e edição fora do DOM reconstruído das mensagens. Erros recuperáveis mantêm o texto exato e apresentam feedback. Uma edição conserva a encarnação e a versão originalmente observadas; não passa silenciosamente a editar uma versão nova.

Cada tentativa preserva texto, intenção, chave de idempotência e payload serializado. Uma resposta perdida pode corresponder a uma gravação durável. Nessa situação, a UI mantém a tentativa e exige duas ações distintas: **reconciliar por leitura autorizada** e depois **repetir explicitamente a mesma ação**, com a mesma chave e o mesmo payload. Atualizar, reconciliar ou receber erro não envia outra mutação. Texto igual no histórico não é usado como comprovante de commit.

Somente as rejeições pré-commit conhecidas deste caminho C05, `product-state-changed` e `thread-changed`, permitem abandonar a tentativa sem resultado incerto. A edição pode então apresentar a versão atual e oferecer aplicação explícita do rascunho, seguida de um novo save humano. Conflitos de idempotência ou troca de alvo não são tratados como prova de que nada foi gravado. Falha de leitura após um POST bem-sucedido também não libera uma chave nova.

A fronteira de privacidade permanece separada: negação de acesso, mudança de binding/principal/escopo, deriva de origem/path, descarte e evento de revogação limpam mapas, intenção e textareas e abortam pedidos pendentes. Revalidações após cada espera impedem a volta de dados por respostas tardias. Nenhum rascunho foi colocado em URL, localStorage ou storageState.

O cliente envia o binding da admissão atual e só libera respostas com eco compatível. Isso **depende do patch compartilhado** de verificação antes da ação e eco autorizado. Sem suporte no host C6, a discussão fecha antes de habilitar mutações; ausência do contrato não é apresentada como prova de revogação global da reunião independente. Consumir client/view e esse patch como uma fronteira compatível.

A [revisão estática](shared-patches/review-discussion-binding/independent-static-review.json) registra correções de flag de rejeição persistente, erro de leitura confundido com rejeição de mutação, conflito genérico, redirect de login, aborto durante leitura do body e mudança do mount. Seu addendum distingue o blob atual do cliente da assinatura de fetch anteriormente revisada.

**Limite decisivo:** os testes reais que reproduzem perda da resposta e falha de envio da edição foram acrescentados ao RPT-02, mas não chegaram aos textareas devido à falha de startup. Os 19 testes do cliente provam comportamento isolado de transporte; não provam retenção de texto no DOM nem autorizam encerrar CAMP.QLT.03 como aceito.

## Quatro cenários preservados e resultado real

| Caso | Oráculos preservados | Resultado no run 43646916265 |
|---|---|---|
| RPT-01 | Captura 1320 permanece imutável após fonte 1400; 25 projetos; notas longas; DOCX/PPTX completos; reabertura e navegação autorizada à fonte atual | Selecionado e iniciado; `FAILED_SETUP` antes da UI |
| RPT-02 | C05/pergunta/resposta/confirmação/reuso/histórico; resposta perdida exige mesma chave/payload e retry explícito; erro de edição conserva rascunho sem duplicar | Selecionado e iniciado; `FAILED_SETUP` antes da UI |
| RPT-03 | Remoção explícita 25→24 sem editar a origem; nova revisão somente por ação explícita; revisão anterior preservada | Selecionado e iniciado; `FAILED_SETUP` antes da UI |
| RPT-04 | Logout real; conteúdo privado removido; credencial antiga negada; nova admissão legítima; hash do artefato original igual | Selecionado e iniciado; `FAILED_SETUP` antes da UI |

Não há skip, xfail, assertion removida, retry automático de mutação, sleep ou aumento de timeout. Os controles de captura de trace/vídeo/screenshot foram movidos, sem mudança de valor, para o escopo do arquivo: a posição anterior dentro de describe era rejeitada pelo Playwright. A coleta posterior dos quatro casos confirma essa correção.

A fixture continua iniciando um único CLI, uma única factory de instalação e uma única layer. A navegação à fonte agora aguarda a resposta real e clica o destino autorizado; o download aguarda o href do novo artefato para não reutilizar o DOCX anterior ao pedir PPTX. Esses passos preservam os oráculos e ainda aguardam execução após a prontidão do host.

## Actions e checks

| Run | W / S | Resultado efetivo |
|---|---|---|
| [43645734030](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43645734030) | Wtest1 `2a518ef4…`; S `2d487a88…` | Falha de coleta; zero casos executados |
| [43646097458](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43646097458) | Wtest1; S `44cbdf70…` | 22 PASS / 1 FAIL: 18 client + 4 bundles passaram; um teste observava credentials do Request clonado pelo Bun |
| [43646326014](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43646326014) | Wtest2 `c41bafd2…`; S `3fd6d21d…` | Falha de coleta novamente; lazy imports não resolveram a causa |
| [43646667683](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43646667683) | Wtest3 `5cc6ec11…`; S `b4cdbe60…` | **19/19 client PASS, 4/4 bundles PASS**; diagnóstico de coleta FAIL. Agregado 23 PASS / 1 FAIL |
| [43646916265](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43646916265) | Wtest4; S3 | **4 selecionados, 4 iniciados, 4 FAILED_SETUP, 0 jornadas completas** |
| [43647268470](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43647268470) | Wsource4, workflow direto existente | Typecheck FAIL137; guards PASS; geração de quatro fixtures PASS; app typecheck:e2e não executado |

O teste de credentials foi corrigido para observar o RequestInit efetivamente entregue ao fetch, mantendo as assertions de same-origin e no-store. O diagnóstico de coleta capturou stdout e stderr da interface Playwright real e revelou as opções de worker dentro de describe. O último resultado desse teste diagnóstico isolado continua FAIL; a correção subsequente é demonstrada pela coleta real do run nominal, não por um rerun omitido.

O typecheck atual tem **137 diagnósticos em 46 paths, zero nos paths próprios alterados**. Todos os 137 headers de diagnóstico, com localização, são idênticos em ordem ao run predecessor 43640600856; os logs existentes foram comparados, sem novo teste baseline. Isso não transforma o typecheck em PASS. [evidence/typecheck-diagnostics.json](evidence/typecheck-diagnostics.json) conserva os diagnósticos e a relação de comparação.

Guards: 78 regras, 735 paths contra `origin/dev@a1d37698a7bb097c1578f827eba6a19b9917ef07`, zero gate, 12 warnings e zero erros. A geração de fixtures DOCX/PPTX é separada das exportações nominais e não fornece aprovação visual.

Omni: o run diagnóstico registrou PASS de um spawn declarado do processo de coleta; o primeiro run client/bundle registrou `not applicable`. No nominal não houve relatório de positive-control PASS nem witness de negócio nativo. A presença do spawner no stack ou a preparação de binários não recebe esse crédito.

O artefato nominal `14134114103` tem SHA256 `bec6567f190060f719a203b584e870fc6ab6f697276d2bc1928e2e983ddaeb30`, 241618 bytes e treze arquivos no upload. Metadados, recibo de upload e logs foram lidos; o MCP disponibilizou o ZIP, mas seu conteúdo não foi descompactado nesta sessão. Não há alegação de inspeção visual desse arquivo.

Todos os testes ocorreram no Actions por interfaces existentes, com no máximo um run WP07 em voo. Dois nomes temporários usaram `transport` e `collection` no segmento reservado ao hash do pedido; esse desvio de nomenclatura está explicitamente registrado em RUNS, sem ocultar os requests/S validados. Não houve teste, build, typecheck, servidor ou browser de produto local.

## Patches completos para a sessão33

Cada bundle inclui preimagem e pós-imagem integrais inertes, diff completo, manifesto de hashes e aplicação delimitada. Nada foi alterado em host/router/autoridade/config/workflows ativos.

| Bundle | Alvos / finalidade | SHA256 do patch |
|---|---|---|
| [installation-router-wildcard](shared-patches/installation-router-wildcard/manifest.json) | Um arquivo: remove somente o registro exato redundante; preserva handler, Host/origem, sinal, 403/404/503 | `c8a32901dd900eab75afefe20e18cb1991595a8b404c8f6144be7dbc5b4c86dd` |
| [review-discussion-binding](shared-patches/review-discussion-binding/manifest.json) | Quatro arquivos: verificação e eco do binding, propagação de denial no histórico, probe de mudança de acesso | `23d799f3bbf7df3d293fb41c714edab5ec92d569486dd383c7a0492f2e700ce8` |
| [reports-e2e-check](shared-patches/reports-e2e-check/manifest.json) | Etapa `bun typecheck:e2e` no workflow cirúrgico existente da fonte, com log preservado | `70935d0df9561473236890d3b6441b5aca3ac968fd7a8ca57033e2435a93c199` |

O loader C6 tem blob `30ffcb8353cdf478808fbb8d6bc67b48b10a6109`. O patch propõe `edc4d574854a39583fb6847e4e8bb135ede93cc1`. A fonte fixada de Effect 4.0.0-beta.83, commit `cd7ab658994104bd6fe8f841f1440bea32c387f5`, HttpRouter blob `3a52c4acd7938674bc209059212efd745cff9715`, confirma que `/*` registra também a base exata. O handler permanece idêntico em bytes; o patch ainda não foi aplicado nem testado.

O grafo E2E já está incluído no C6. O workflow de check da fonte não existe no C6; seu bundle identifica esse fato e exige reconciliação/import explícito pelo owner. Não deve ser aplicado como se tivesse um preimage inexistente nem autoriza copiar o restante da branch de fonte.

## Recursos externos e critérios

[CRITERIA.json](CRITERIA.json) preserva os **86 IDs/textos/proof bindings, oráculos e mapas históricos**. Os 86 têm um registro do bloqueio comum de setup e **zero aprovação**. Isso não transforma cenários sem cobertura direta em cobertos; seus gaps específicos continuam no mapa.

Os recursos pendentes do C6 permanecem precisos:

- **Destinatário legítimo distinto:** a instalação local autentica um único principal. Directory/enroll não estabelecem uma segunda pessoa. `reviewRecipientAuthority` precisa de um provider real para caller, recipient, pin imutável e todas as fontes/campos/períodos, com `checkAtCommit` síncrono. Nova sessão do mesmo operador atende ao teste de revogação de sessão, não ao requisito de outra pessoa.
- **C05 não simples:** a lease local cobre somente revisões de registros Dashboard cuja autoridade reside nos snapshots protegidos. Comentários capturados, outcomes externos, decisões, sensibilidade, cálculos/documentos e outras fontes requerem leases atuais dos produtores reais.
- **Demais critérios:** comparação, Talent seletivo, visualização de documentos, paridade UI/native/MCP e tempos humanos continuam abertos conforme o mapa. Bundle verde e extração OOXML não os substituem.

Não foram fabricados principal, provider, ACL, credencial ou witness nativo. Credenciais, storageState, banco privado e códigos de admissão não foram incluídos nos recibos.

## Retomada exata pela sessão33

1. Reconciliar o head atual da PR27 e o candidato do integrador com este handoff terminal e o CONSUMER-RELEASE. Conferir preimages e preservar o histórico via GitHub MCP CAS, sem force.
2. Consumir os dez postimages próprios e os patches compartilhados necessários como um candidato coerente. Client/view e verificação/eco de binding formam uma fronteira compatível. A correção do router só remove o impedimento específico de startup.
3. Registrar separadamente os recursos reais de destinatário e C05, sem substituí-los por fixtures positivas. Publicar **novo W/tree/mapa de blobs e ACK** conforme [ACK-REQUEST.json](ACK-REQUEST.json).
4. Após o ACK, o dispatcher WP07 já autorizado verifica o candidato/config/fixtures, deduplica e cria S somente de request para [requests/reports-nominal.json](requests/reports-nominal.json). Executar novamente os quatro cenários preservados; nenhum rerun do mesmo router bloqueado é útil.
5. Executar os checks hospedados admitidos, inclusive o typecheck E2E ainda faltante, e manter os resultados reais. S0 continua responsável pela aceitação final.

A missão36 entrega código, testes e execução nominal real com falha identificada, patches consumíveis e limites explícitos. **Não entrega quatro jornadas verdes nem reprodução UI concluída.** A sessão33 recebe uma liberação de implementação com dependências conhecidas; nenhum consumo ou ACK posterior foi presumido.

