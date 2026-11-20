# Handoff — sf-ui-c02

SHA: 63c9a0d7fb26a244327b1f5b30ac8adae213760b (último código; o commit deste checkpoint de documentação é posterior)
Data: 2026-11-19T23:02:19-03:00
Estado: partial

Base: sf-join-four @ f7dd58e32bc834f1485df20b91adbf759b4c4ad0.
Template: docs/handoff/HANDOFF-TEMPLATE.md de sf-handoff-brief, blob725697cdae3a42133df81a42637ff70214a78cb3; o template não existe na base.
Retomada solicitada: “Preciso de tudo completo e verde irmao, sem excessoes.”
Este é um checkpoint durante a execução. As suítes de navegador ainda não estão verdes.

## Feito

### T1 — anchor C02 e jornada Requests

- O número da tabela Requests é um anchor com href exato `?request=<encoded>#<encoded>` e os três atributos de proveniência recebidos do produtor. Não há cálculo de digest C02 no componente.
- CAP25 agora publica evidence.refId/evidence.refDigest/version do membro correspondente da fila já preparada e validada. A autoridade, revalidação e emissão da fila continuam nos produtores existentes. Não foram criados scopes artificiais na fixture.
- sourceRef/sourceDigest/sourceVersion permanecem opcionais no schema. O DTO poFieldSources também é opcional e usa purchaseOrderFieldSources do domínio, com fontes/valores persistidos para a leitura do PO.
- Requests apresenta os fieldErrors reais de422 com aria-invalid/aria-describedby e foco; preserva entradas em409 e só adota a versão após releitura autorizada e escolha explícita.
- A edição depois de409, antes da releitura, mantém a comparação e impede envio com CAS antigo (f1e8aa1). A edição durante uma resposta pendente conserva o payload enviado e mantém entradas posteriores como dirty.
- O controlador compartilhado mantém o comportamento padrão e recebe allowPendingEdits somente nos drafts PR/PO. A regressão específica passou: run44652278683,7testes,53assertions.
- Aprovações preservam comentário em409 e recusam reviver ação cancelada. Sourcing publica qty/unitPrice e mostra seleção real. A fila mostra baseAmount/baseCurrency do produtor.
- Suppliers mantém editor parcial e autorização bancária, com projeção redigida do viewer. Settings conserva entradas após422 e executa save/reset reais mediante revisão, com defaults do produtor.

### T2 — origem e prova wp04

- O host serve a SPA construída na própria origem4174, compondo WebUi com as rotas embedded e mantendo guards de origem/autenticação/POST. O spec não força3000 e wp04 não usa4110.
- Os oito cenários foram ligados aos controles nativos de Requests, sourcing, approvals, suppliers, settings e filas. Continuam verificando versões, payloads, identidade, conteúdo, foco, FX congelado, redaction, ausência de escrita automática e emissão interna do PO.
- A prova de conflito usa dois atores reais; a perda de resposta retém a resposta de uma mutação que efetivamente chegou ao produtor.
- O filtro por teclado exige a opção src_pending pelo valor real. End também é verificado contra a última opção publicada; não se presume que a ordem dos registros coloque src_pending no fim.
- O perfil é selecionado pela UI existente Add project/Open project. No código63c9a0d, a seleção e o diretório são confirmados no Home antes de montar o capítulo. Depois são exigidos discovery200 da instalação única, owner ready e persistência após reload.
- Essa mudança estrutural evita iniciar o preparo com F01 sem diretório. Ainda não foi demonstrado que uma corrida de owners tenha causado o timeout anterior. As fases de bootstrap são registradas sem depender de page.evaluate após fechamento.
- O href C02 mantém o hash exigido; o teste de clique respeita a canonização de URL já existente no F01, mantendo query de request, owner ready e linha selecionada.

### T3 — Budget, Reports e C05

- Reports and backup permanece fora de SfStatePanel e de condicionais de dados, com href exato /orchestra/sf-reviews/agenda. CAP03 continua registrado em /orchestra/sf-dashboard/budget.
- Budget mostra os totais já produzidos somente quando o ano da seleção coincide com o ano exibido, sem calcular total na UI.
- A fixture Reports usa sua instalação CLI real na origem4110, separada do hostwp04. Lê a senha privada criada pelo daemon em XDG_STATE_HOME/orchestra/password e exige health401 anônimo e200/healthy/version com a credencial real antes de configurar a conexão pelo formulário nativo.
- A projeção da agenda usa o selector original com IDs de seção distintos, títulos canônicos e refs autorizados atuais. UI47 permite retirar exatamente um dos25registros sem alterar a fonte; a sucessora UI48 mantém os mesmos24IDs e previousReviewRef exato.
- UI48 usa dashboard-agenda/dashboard-review-preserve já publicados, com seleção e preview explícitos. Outcome desconhecido não dispara retry automático.
- C05 conserva no Intent a observação preparada e o payload/key originais. Retry same action exige marcador same-intent explícito; perda de leitura preserva drafts e intenção.
- A releitura por focus após reconciliação consulta ctx.context nativo antes de thread/answer, compara os6campos de stamp e descarta resposta se mudar owner, geração, transporte, review, intenção ou operação. O spec substitui o GET do documento legado por200/no-store/contrato/principal/tuple reais, conservando as provas de nenhuma nova escrita.
- 401/403 e estados autoritativos denied/unauthenticated retiram dados privados e invalidam o owner. O cenário de revogação usa F01 nativo e conserva controle positivo de uma nova sessão.

## Pendente

- T1/T2 — packages/app-shell/e2e/sucafina/native/select-profile.ts:41 — aguardar e analisar44657275046. O último wp04 completo atingiu60s em todos os8testes; o log não mostrou qual await primário ficou pendente. O novo helper altera a ordem de preparação e identifica sua fase.
- T3 — packages/app-shell/e2e/sucafina/reports-support/fixture.ts:7 — o run44654544465 atingiu180s no setup dos4testes. Os controles de health401/200 anteriores ao helper foram alcançados, mas a conclusão da conexão pela UI/perfil não foi comprovada.
- T3/C05 — packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/answer.tsx:176 — a correção de releitura3050a842 ainda precisa do gate Reports completo após comprovar o bootstrap compartilhado.
- Não há declaração de navegador verde. Typecheck geral do pacote e check:guards não foram executados separadamente; os resultados registrados são os gates específicos solicitados.

## Decisões e justificativas

- As dependências adicionais foram implementadas para atender à retomada das jornadas completas. A lista de arquivos abaixo deixa a ampliação explícita.
- Asserções de negócio removidas: nenhuma. A expectativa inicial de zero links foi trocada pelo contrato positivo C02. Os seletores do console antigo foram substituídos pelos controles nativos mantendo as verificações de negócio. Uma expectativa nova de hash persistido após clique foi retirada porque o F01 já canoniza o hash; o href exato com hash segue verificado.
- Não houve skip, xfail, aumento de timeout, comparação vazia ou fabricação de resposta de produto.
- Nenhum console morto foi recriado. O details/summary já existente em preserved/answer.tsx na base não foi introduzido por este diff. Não foram criados #content, data-surface, heading Decisions, sidebar, Homologação local ou section[id]-pr.
- Não foi editado modules/sucafina/Sucafinav1/runtime/application.ts, workflow ou branch proibida. Não houve merge, shell, teste local ou sf-ci.
- O workflow exige prefixo ci-run-linux-* e config Playwright explícita. package app-shell não existe no catálogo; os gates usam package app. Os guards não foram alterados.
- Cada snapshot CI é filho do SHA de código e acrescenta somente .ci-run.json. Esse arquivo não está na branch de trabalho.
- T1/T2 compartilham o gate do mesmo spec. Pico de concorrência:2. Não houve rerun idêntico sem alteração; após a falha Reports, aguarda-se primeiro a observação do bootstrap no wp04 para poupar CI.

## Como retomar

1. Partir de sf-ui-c02; o código deste checkpoint é63c9a0d7fb26a244327b1f5b30ac8adae213760b.
2. Ler a conclusão e o primeiro erro de44657275046. O helper registra a fase da espera; não repetir a mesma execução sem nova correção concreta.
3. Com o bootstrap comprovado, executar Reports completo no SHA que contém3050a842 e63c9a0d, usando o request abaixo e no máximo2gates simultâneos.
4. Corrigir apenas causas sustentadas e manter as assertions. Atualizar este handoff com SHAs, runs/conclusões e unbound(file:line), até o fechamento completo.
5. Se houver novo timeout, distinguir a fase observada da hipótese causal. Os ZIPs dos artifacts não foram extraídos pelo conector; não alegar inspeção de DOM/trace não realizada.

## Comandos e resultados

- bun typecheck (app-shell): não executado separadamente. Os gates Playwright concluídos passaram pelo typecheck SF E2E embutido.
- bun run check:guards --base origin/dev: não executado separadamente; não declarado verde.
- bun run test:ci: somente pelas branches de request em Actions, conforme tabela.
- Unidade de drafts: test/sucafina-native/procurement-draft-conflict.test.ts — 7pass,0fail,53expect no run44652278683.

| Run | SHA de código | Snapshot CI | Conclusão |
| --- | --- | --- | --- |
| [44646029764](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646029764) | 6efb113c755279654c306a6fe76c99bcbffb345f | 1748a50b7d8a62df89c383077429b8c303e09aca | failure — Read request: TEST_PACKAGE_NOT_FOUND:app-shell; nenhum teste executado; cleanup success |
| [44646129589](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646129589) | dddce89d6a6c2b1d4c0f52a97e0c321d3454f141 | 0d6e3a6a82d33895b6b7211b28a6fce9524816ea | failure — mesmo seletor inválido no request Reports; nenhum teste executado; cleanup success |
| [44646627443](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646627443) | 82c3047754cb5ca9b04a5ccdb22c9d0c510295c4 | 55d805d907e6dde33c6e3970eea148519bb4db01 | failure — 8/8 em procurement.spec.ts:37; heading Requests(:34) já alcançado; typecheck E2E e cleanup success |
| [44646379209](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646379209) | ffa13012bc0ac2bba113860946930355c0a9a37f | 47a498e47becb6a9b6ab551099a114fdd66df4fd | failure — 4/4 em reports-support/review-flow.ts:21, link ausente; typecheck/build success |
| [44652278683](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44652278683) | 496a115b8e6d541a7b2d7da27276225a7654e07e | 64af66e17c6b1a5389057095243554ade1c20869 | success — regressão de drafts: 7 pass, 0 fail, 53 expect; cleanup success |
| [44652437588](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44652437588) | 015c75a42f1fe32d776e9dbab944b4202d9d7e90 | c7fcea5707becab77b41cc3dd128a0181b59150c | failure — 8/8 atingiram 60000ms; erro secundário Playwright response GUID sem stack do await primário; typecheck/build e cleanup success |
| [44652818501](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44652818501) | f1e8aa1c8b622cb99e6ee5e49bb049fe77264de4 | 80cb157ff07b388cdf41c9f99a6f05bc94a644ce | failure — 4/4 em native/select-profile.ts:19 antes de aparecer o perfil; typecheck/build e cleanup success |
| [44654544465](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44654544465) | 7554bb4a476d2e693348462c0fed216ebec4200c | 8f306b3ca51038ce157e51e40a6ba14fe2b4c5d4 | failure — 4/4: fixture reports timeout 180000ms durante setup, reports-support/fixture.ts:7; helper registrou unavailable=true,pageErrors=[] após página fechada; typecheck/build e cleanup success |
| [44657275046](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657275046) | 63c9a0d7fb26a244327b1f5b30ac8adae213760b | 8a4a0dc763320d9b752434d79e997cc98735cdf2 | in_progress — wp04 completo, com seleção de perfil no Home, CAS reforçado e filtro por teclado corrigido |

Artifacts relevantes:14589477538 (wp04 antigo),14589541312 (Reports antigo),14592066071 (Reports sem Basic),14593360996 (wp04 timeout). Os logs foram lidos; nenhum ZIP foi extraído.

Requests:
```json
{"package":"app","runner":"bun","args":["test/sucafina-native/procurement-draft-conflict.test.ts"]}
{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/wp04/procurement.spec.ts"]}
{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/reports.spec.ts"]}
```

## Arquivos alterados

- apps/cli/src/sucafina-product/extended-review-cycle.ts
- apps/cli/src/sucafina-product/native-ui/procurement.ts
- apps/cli/src/sucafina-product/native-ui/reviews.ts
- apps/cli/src/sucafina-product/review-agenda-projection.ts
- docs/handoff/HANDOFF-sf-ui-c02.md
- modules/sucafina/Sucafinav1/product/reviews/selection.ts
- packages/app-shell/e2e/sucafina/native/select-profile.ts
- packages/app-shell/e2e/sucafina/reports-support/fixture.ts
- packages/app-shell/e2e/sucafina/reports-support/lost-created-thread-read.ts
- packages/app-shell/e2e/sucafina/reports-support/production-installation.ts
- packages/app-shell/e2e/sucafina/reports-support/review-flow.ts
- packages/app-shell/e2e/sucafina/reports-support/revocation.ts
- packages/app-shell/e2e/sucafina/reports.spec.ts
- packages/app-shell/e2e/sucafina/wp04/host.ts
- packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts
- packages/app-shell/src/i18n/orchestra-chapters/sf-u25.ts
- packages/app-shell/src/i18n/orchestra-chapters/sf-u32.ts
- packages/app-shell/src/orchestra/chapters/sucafina/dashboard/budget/index.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/approvals/pr/index.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/queues/panel.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/copy.ts
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/forms.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/requests.css
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/settings/index.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/settings/model.ts
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/index.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/suppliers/index.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/index.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/record-selection.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/answer.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/shared/draft/index.ts
- packages/app-shell/test/sucafina-native/procurement-draft-conflict.test.ts
- packages/schema/src/sucafina/procurement.ts
