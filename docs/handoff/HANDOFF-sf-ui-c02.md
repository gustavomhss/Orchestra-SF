# Handoff — sf-ui-c02

SHA: 82c3047754cb5ca9b04a5ccdb22c9d0c510295c4 (último commit de código; a documentação será posterior)
Data: 2026-11-19
Estado: partial

Base: sf-join-four @ f7dd58e32bc834f1485df20b91adbf759b4c4ad0.
Template: docs/handoff/HANDOFF-TEMPLATE.md de sf-handoff-brief, blob 725697cdae3a42133df81a42637ff70214a78cb3; o caminho não existe na base nem em sf-join-four consultada.

## Feito

- T1 — commit ffa13012bc0ac2bba113860946930355c0a9a37f: packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx:596-604 agora renderiza o anchor C02 na coluna number com o href exigido e sourceRef/sourceDigest/sourceVersion recebidos do produtor. A identidade ausente não gera href; versão null/undefined não vira texto. Os três campos já eram opcionais em packages/schema/src/sucafina/procurement.ts:170-172; schema não editado.
- T1 — packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:83-89 substitui a expectativa incompatível de zero links por exatamente um link com ID/nome, href exato, sourceRef não vazio, digest 64 hex e versão numérica. As assertions de entrada C02 em :36-40 permanecem.
- T2 — commit 6efb113c755279654c306a6fe76c99bcbffb345f: login, criação e abertura deixam de forçar porta 3000. A inspeção revelou que o host escutava 4174 mas publicava/aceitava 3000 e rejeitava rotas SPA; aplicou-se a contingência expressamente autorizada no briefing. wp04/host.ts usa server.url.origin, resolve o build real em apps/web/dist e compõe WebUi.layer com as rotas embedded, preservando autenticação/origin/POST guards.
- T2 — commit 82c3047754cb5ca9b04a5ccdb22c9d0c510295c4: a fixture publica projectId/installationId da identidade real obtida depois do health. O helper chapterUrl da spec preserva o triplet nativo server/project/installation nas três navegações. Os IDs são seletores, não grants; o runtime continua realizando discovery/context/admissão.
- T3 — commit dddce89d6a6c2b1d4c0f52a97e0c321d3454f141: packages/app-shell/src/orchestra/chapters/sucafina/dashboard/budget/index.tsx:133 move SfBudgetReportLink para fora de SfStatePanel. Texto e href /orchestra/sf-reviews/agenda permanecem exatos. A rota CAP03 foi confirmada em route-registry.ts:33-36.
- Revisão independente por leitura: anchor/schema/assertions, transporte/guards e Budget foram revistos por agentes separados; patch de owner recebeu segunda revisão do contrato. Isso não equivale a gate runtime verde.
- Readback via GitHub confirmou o conteúdo dos quatro arquivos publicados e compare confirmou somente esses quatro paths de código, com quatro commits lineares sobre a base. As comparações parent->snapshot de ambos os gates finais mostraram somente .ci-run.json, um commit à frente e zero atrás.

## Pendente

- T1 e T3 permanecem partial. T2 atingiu seu aceite específico: todos os oito casos do run 44646627443 passaram pelo heading Requests em procurement.spec.ts:34 e falharam somente depois em :37. A suíte inteira não ficou verde.
- T1 — unbound(packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:37): primeira falha observada, a[data-source-ref] ausente, nos oito casos; digest/versão não foram alcançados. A UI contém o anchor e preserva os campos opcionais. Não foi constatado erro de reader/schema que justifique outro patch.
- T1 — unbound(apps/cli/src/sucafina-product/native-ui/procurement.ts:225-230): lacuna de publicação C02 encontrada por leitura. publishedRequestBasis ignora a evidência por membro já preparada pela fila e consulta procurementRowSourceIdentity; essa função exige exatamente um scope individual procurement-request (modules/sucafina/Sucafinav1/product/procurement/sources.ts:267-274), enquanto createSelection publica scope de coleção procurement-request-selection (:182-206). Os membros da coleção já carregam evidência autorizada, consumida pelo contrato existente em runtime/procurement.ts:1031-1032 como evidence.refId/evidence.refDigest/version. A projeção CAP25 reconhece a fila em native-ui/procurement.ts:243-245, mas publica a base individual nullable em :261-265.
- T1 — não resolver criando scopes artificiais na fixture. initializeSources e a transação de seed sincronizam records (source-lifecycle.ts:164-178); synchronizeScopes só atualiza scopes existentes (:242-245). A emissão individual legítima existe em procurement/sources.ts:67-84, com autenticação e contexto; ela não deve ser simulada para fazer o teste passar. A retomada produtora deve projetar a evidência C02 já preparada e validada, mantendo sua autoridade/identidade. Esse arquivo está fora do escopo atribuído à sessão.
- Limite do diagnóstico T1: o log prova ausência do anchor e passagem pelo heading. Sem inspeção do DOM/payload no ZIP, ele sozinho não distingue leitura indisponível, conjunto vazio e proveniência null. A lacuna do produtor acima é evidência estática coerente com a falha, não alegação de que o payload runtime foi aberto. O único aviso Bun de idle timeout não informa URL; não se aumentou timeout nem se atribuiu esse aviso à leitura CAP25.
- Reports — unbound(packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:21): primeira asserção observada no run 44646379209, link Reports and backup ausente, timeout preservado de 10000ms. Os quatro casos falharam nesse ponto. Diagnóstico por leitura: a navegação em :19 fornece só year, sem perfil/diretório real selecionado; chapter-route.tsx:129-131 passa directory vazio e owner-runtime231.tsx:197-200 não descobre por localização vazia. O log comprova a ausência do link; a causa de seleção está fundamentada no código, não em inspeção do ZIP.
- Reports posterior: reports-support/review-flow.ts:27 já declara UNBOUND para remoção de um único registro; reviews/agenda/index.tsx:308-310 só remove seção. Não recriar controles.
- WP04 posterior: procurement.spec.ts:149 e :226 ainda exigem section[id]-pr e details/form do console legado. Se alcançados, parar e registrar a primeira falha observada; não reconstruir o DOM morto.
- Anchor C02: owner-runtime231.tsx:433-436 recusa a perda do triplet em navegação a partir de owner explícito. Este trabalho preserva o href exato solicitado; valida presença/metadata, sem alegar prova de clique do anchor em contexto explícito.
- Guards gerais e typecheck completo de app-shell permanecem para a integração. Os typechecks E2E embutidos nos dois gates passaram; isso não equivale ao typecheck geral do pacote. Não há execução local.

## Decisões e justificativas

- Asserções de negócio removidas: nenhuma. A expectativa de zero links foi substituída por contrato positivo mais estrito para refletir a T1. Não há skip, timeout maior, check vazio ou mudança de digest/proveniência.
- wp04/host.ts foi o único arquivo adicional à lista inicial: necessário pela contingência explícita da T2, confirmada no código. Não foram alterados packages/server/src/web-ui.ts, runtime/application.ts, workflow ou fronteiras de autorização.
- Não foram recriados #content, data-surface, heading Decisions, sidebar, Homologação local, details/summary ou formulários section[id]-pr.
- O runner existente exige ci-run-linux-* (.github/workflows/test-ci.yml:33-36) e config Playwright explícita (script/test-ci-request.ts:110-113). As branches de gate usam esse prefixo sem mudar o guard.
- O seletor app-shell do exemplo não existe no catálogo: as duas tentativas iniciais falharam antes de instalar/executar testes em script/test-ci-package.ts:35. O request foi corrigido para package app. O erro de configuração está registrado, não apresentado como falha de produto ou validação.
- T1 e T2 compartilham a execução final do mesmo procurement.spec.ts no SHA que contém ambas as correções; não se duplica a suíte idêntica para produzir dois recibos.
- Snapshots de CI foram criados atomicamente com .ci-run.json e parent no SHA de código. Nenhum .ci-run.json foi adicionado à branch de trabalho. Pico de concorrência desta sessão: dois gates. Nenhum sf-ci, merge, shell ou teste local.

## Como retomar

1. Partir da branch sf-ui-c02, código 82c3047754cb5ca9b04a5ccdb22c9d0c510295c4; ler este handoff e as conclusões finais.
2. Primeiro, o integrador/owner do produtor deve fechar C02 em apps/cli/src/sucafina-product/native-ui/procurement.ts usando a evidência autorizada já preparada pela fila. Inspecionar também o payload/trace do artifact 14589477538 quando houver leitor autorizado de ZIP; não atribuir causalidade a detalhes que não foram observados.
3. O owner da fixture Reports deve estabelecer o perfil/diretório real selecionado da shell antes de review-flow.ts:19. Apenas acrescentar triplet à primeira URL não comprova o clique subsequente no href exato sem triplet; a seleção precisa sobreviver à navegação pela agenda, preservando a admissão original.
4. Após fix concreto, usar GitHub/Actions com branch ci-run-linux-* e o request exato pertinente abaixo. Não repetir o gate apenas para ver como está. Integrar os quatro arquivos de código e este handoff; não tocar branches proibidas nem rodar sf-ci nesta sessão.

## Comandos e resultados

- bun typecheck (app-shell): não executado separadamente/localmente. A etapa Typecheck the installed SF E2E sources concluiu success nos runs 44646379209 e 44646627443.
- bun run check:guards --base origin/dev: não executado separadamente; não declarado verde.
- Tentativa T2: run 44646029764, snapshot 1748a50b7d8a62df89c383077429b8c303e09aca, parent 6efb113c755279654c306a6fe76c99bcbffb345f — failure em Read request, TEST_PACKAGE_NOT_FOUND:app-shell, script/test-ci-package.ts:35. Job 135988712663; nenhum teste executado; cleanup success.
- Tentativa T3: run 44646129589, snapshot 0d6e3a6a82d33895b6b7211b28a6fce9524816ea, parent dddce89d6a6c2b1d4c0f52a97e0c321d3454f141 — failure pelo mesmo seletor inválido em Read request. Job 135989055854; nenhum teste executado; cleanup success.
- Gate T1/T2: [run 44646627443](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646627443), snapshot 55d805d907e6dde33c6e3970eea148519bb4db01, parent 82c3047754cb5ca9b04a5ccdb22c9d0c510295c4 — failure; job 135990747207. Seleção e typecheck E2E success; build/host iniciaram; 8 testes executados com 1 worker, 8 failed / 0 passed, todos em procurement.spec.ts:37 depois do heading :34. Cleanup 135994350082 success. Artifact [14589477538](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646627443/artifacts/14589477538), 34359248 bytes, upload success. O download pelo conector retornou somente referência ZIP; nenhum membro/DOM/trace foi extraído sob a restrição somente GitHub.
- Gate T3: [run 44646379209](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646379209), snapshot 47a498e47becb6a9b6ab551099a114fdd66df4fd, parent ffa13012bc0ac2bba113860946930355c0a9a37f — failure; job 135989909108. Seleção e typecheck success; build completo; 4 testes executados com 1 worker, 4 failed / 0 passed, todos em reports-support/review-flow.ts:21. O blob Budget é idêntico ao do código final: 8e5e5b39efa18f0fe40c5e944a84f1ccad9ac022. Artifact [14589541312](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646379209/artifacts/14589541312), 239546 bytes, upload success; ZIP não inspecionado.

Request T1/T2:
```json
{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/wp04/procurement.spec.ts"]}
```

Request T3:
```json
{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/reports.spec.ts"]}
```
