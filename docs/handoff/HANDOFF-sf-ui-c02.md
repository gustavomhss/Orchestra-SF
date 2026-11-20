# Handoff — sf-ui-c02

SHA: 1fbdfda8a710e2c92f3c7566e7971946a90a341f (último código; o commit deste checkpoint de documentação é posterior)
Data: 2026-11-20T03:15:28.121Z
Estado: partial

Base: sf-join-four @ f7dd58e32bc834f1485df20b91adbf759b4c4ad0.
Template: docs/handoff/HANDOFF-TEMPLATE.md de sf-handoff-brief, blob725697cdae3a42133df81a42637ff70214a78cb3; o template não existe na base.
Retomada solicitada: “Preciso de tudo completo e verde irmao, sem excessoes.”
Este é um checkpoint durante a execução. As suítes de navegador ainda não estão verdes; há uma contradição de contrato preexistente explicitamente registrada abaixo.

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

- Em 9b51a7ab, Requests e Sourcing capturam payloads plain com structuredClone(unwrap(...)), preservando a identidade da revisão, os fences e o mesmo snapshot no digest/POST. Os modelos omitem somente opcionais undefined; notas comerciais preenchem lacunas com null permitido, sem arrays esparsos. O codec continua estrito.
- Em 08bbe1a2, Suppliers captura a intenção plain e confirma a edição bancária pela versão da releitura autorizada, limpando o draft parcial para {}. Settings usa untrack na adoção da projeção e snapshots plain em 24054686, eliminando o ciclo reativo sem alterar o contrato.
- Em d6268567, CAP26 passa a admitir o seletor request já declarado no schema e usado pelos detalhes PR/remaining. Autenticação, visibleRequests, versões e ações atuais permanecem as do produtor.

- Em b87d48ea, os controles de threshold/FX/peso de Settings convertem os valores numéricos na fronteira de entrada existente; zero continua sujeito às recusas reais do produtor.
- Em 0debca85, o adaptador de Procurement aplica a mesma normalização já existente também às folhas dos objetos aninhados de pr/sourcing/po. As regras de campo, autorização, CAS e porta permanecem. O run44663540495 passou18testes/202assertions, incluindo strings numéricas, booleanfalse, recusas sem mutação e privacidade.
- Em 73458ff5, fila e editor passam a compartilhar o fluxo vertical da rota CAP25. A fila usa seu layout split existente quando a largura útil medida é >=801; single/voltar/Escape continuam nas larguras menores.
- Em 1fbdfda8, o botão Submit requisition existente continua visível e disabled em pr_pending, preservando stageAllowed/reviewAction/confirm e sem conceder ação nova. A interpretação anterior como passo inexistente foi revista: é somente apresentação do controle já implementado.
- Em d311e693, o diagnóstico wp04 registra apenas categorias fechadas de falha de rede, sequência local, estado/geração/contagens; captura a segunda página CAS antes do fechamento e relança o erro original. Não captura payload/credencial/ownerKey nem muda assertions, retries ou timeouts.

### T2 — origem e prova wp04

- O host serve a SPA construída na própria origem4174, compondo WebUi com as rotas embedded e mantendo guards de origem/autenticação/POST. O spec não força3000 e wp04 não usa4110.
- Os oito cenários foram ligados aos controles nativos de Requests, sourcing, approvals, suppliers, settings e filas. Continuam verificando versões, payloads, identidade, conteúdo, foco, FX congelado, redaction, ausência de escrita automática e emissão interna do PO.
- A prova de conflito usa dois atores reais; a perda de resposta retém a resposta de uma mutação que efetivamente chegou ao produtor.
- O filtro por teclado exige a opção src_pending pelo valor real. End também é verificado contra a última opção publicada; não se presume que a ordem dos registros coloque src_pending no fim.
- O perfil é selecionado pela UI existente Add project/Open project. No código63c9a0d, a seleção e o diretório são confirmados no Home antes de montar o capítulo. Depois são exigidos discovery200 da instalação única, owner ready e persistência após reload.
- O run 44657275046 comprovou a seleção no Home, discovery e owner ready em todos os oito cenários, além do heading Requests e dos atributos C02. Os bloqueios passaram a comandos/Settings. Isso não prova que uma corrida de owners tenha causado o timeout anterior.
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

- Em 343d2ecf, C05 captura a base aninhada plain uma vez para emissão da pin e thread-create. Budget copia o mapa numérico de versões antes de digest/pending e omite id ausente no comando; não muda fórmulas ou versões.
- Em f34b8010, o leitor DOCX reconhece e verifica os três rótulos exatos de continuação por célula antes de reconstruir as tuplas. Comparações de valores, períodos, fontes, identidades e cauda longa permanecem obrigatórias.
- Em 39f6f63c, o cliente aceita localhost exato, já admitido por sucafina-installations.ts:59–68 e local-configuration.ts:40–43. A igualdade de origem permanece; subdomínios continuam rejeitados. O fetch F01 aplica Basic somente na origem exata do servidor selecionado e bloqueia redirects.
- Sign out confirma o POST real, valida geração/transporte, invalida dados/drafts privados e navega uma vez ao handler canônico /auth/login. Não foi implementado login(returnRoute) nem ampliado o contrato de return-intent.
- A regressão unitária de autenticação/origem passou no run44662556234:3testes/31assertions.
- Em 66d40320, a disponibilidade de dashboard-agenda/dashboard-review-preserve é observada sobre os métodos e bindings reais registrados, com autorização C08/C14 e revalidação antes/depois; nenhuma seleção é executada e nenhuma persistência é feita pelo observador. O run44664485621 passou4testes/73assertions, inclusive ausência/revogação/troca de método e zero efeitos.
- No run44664883769, RPT-02 passou discovery, preview200, preservação200, confirmação e leitura exata do relatório salvo; parou na montagem UI48. Nos quatro casos o link Budget e a montagem UI47 passaram. Isso ainda não verifica exportação Office nem C05.

## Pendente

- **unbound(packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:502)** — exige stored.status=cancelled em409 (era439 antes do diagnóstico;271 na base). runtime/procurement.ts:552–558 omite stored se não há ação atual; cancelled não tem ações atuais. A política foi adotada em4387e9d75876cdb6acb4f365809c810c0fa4b44b/PR290, com prova negativa microsoft-routes.test.ts:173–187 no head7f26c6c56ee1d044fa366b2c68639db5c5bc3d4a. A releitura CAP25/CAP26 autorizada existe, mas não autoriza fabricar um corpo409. O ponto ainda não foi alcançado pelos gates recentes por falha anterior no submit.
- T1/T2 — aguardar run44666127535 no código1fbdfda8a710e2c92f3c7566e7971946a90a341f, snapshot a3c3de27fa900f296574dcf9f3e3642a91e8b833, após os fixes concretos de fluxo de layout/split e botão pending.
- **CAS: packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:411** (355 no gate14):409 real com CAS2 e stored.pr correto, mas region/heading de revisão ausentes. Causa ainda não demonstrada; o diagnóstico do gate18 registra a página secundária antes de fechar. Não foi relaxado o codec nem aplicada mudança especulativa.
- **Corpo de resposta: packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:287** (231 no gate14): submit_pr responde200, seguido de requestfailed e Network.getResponseBody sem dados em dois casos. O gate18 distingue aborto explícito de falha de conexão; não houve retry nem aumento de timeout.
- **unbound(packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:40)** — Reports17 falhou em RPT-01/03/04 ao ler o corpo do discovery200. O mesmo sintoma ocorreu em RPT-03 do run12. Nenhuma causa concreta foi demonstrada; não rodar novo gate apenas para observar.
- **unbound(packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:112)** — RPT-02 preservou e releu o relatório, mas UI48 não montou após goto110. Codec/registry/dispatcher existem e o markerUI48 é incondicional após montagem; investigar bootstrap/admissão anterior à superfície, sem inventar rota.
- Não há declaração de navegador verde. O último wp04 concluído passou3/8 (edição durante save, Suppliers, Settings); Reports17 passou0/4. Typecheck geral e check:guards não foram executados separadamente.

## Decisões e justificativas

- As dependências adicionais foram implementadas para atender à retomada das jornadas completas. A lista de arquivos abaixo deixa a ampliação explícita.
- Asserções de negócio removidas: nenhuma. A expectativa inicial de zero links foi trocada pelo contrato positivo C02. Os seletores do console antigo foram substituídos pelos controles nativos mantendo as verificações de negócio. Uma expectativa nova de hash persistido após clique foi retirada porque o F01 já canoniza o hash; o href exato com hash segue verificado.
- Não houve skip, xfail, aumento de timeout, comparação vazia ou fabricação de resposta de produto.
- Nenhum console morto foi recriado. O details/summary já existente em preserved/answer.tsx na base não foi introduzido por este diff. Não foram criados #content, data-surface, heading Decisions, sidebar, Homologação local ou section[id]-pr.
- Não foi editado modules/sucafina/Sucafinav1/runtime/application.ts, workflow ou branch proibida. Não houve merge, shell, teste local ou sf-ci.
- O workflow exige prefixo ci-run-linux-* e config Playwright explícita. package app-shell não existe no catálogo; os gates usam package app. Os guards não foram alterados.
- Cada snapshot CI é filho do SHA de código e acrescenta somente .ci-run.json. Esse arquivo não está na branch de trabalho.
- T1/T2 compartilham o gate do mesmo spec. Pico de concorrência: 2. Não houve rerun idêntico sem alteração; cada novo gate segue uma correção concreta. Contradições de contrato não serão contornadas para declarar verde.

## Como retomar

1. Partir de sf-ui-c02; código deste checkpoint: 1fbdfda8a710e2c92f3c7566e7971946a90a341f. As branches CI são descartáveis e o workflow as apaga.
2. Ler conclusão e diagnóstico do run44666127535. Comparar primeiroerro/estado com gate14; só executar outro gate após uma causa concretamente corrigida.
3. Para Reports, investigar review-flow.ts:40 e:112 com o código/artefatos do run44664883769. Não repetir por instrumentação isolada; nenhuma prova de exportação/C05 foi alcançada.
4. Resolver com o dono a contradição stored.cancelled em procurement.spec.ts:502 antes de poder prometer a suíte integral verde. Não remover o guard nem fabricar resposta ou enfraquecer a asserção.
5. Preservar máximo2gates, apenas GitHub/Actions, sem shell/sf-ci/application.ts/console morto. Atualizar este handoff com SHAs e conclusões mesmo se parcial.
6. Logs de Actions foram lidos. ZIPs de artifacts não foram extraídos; não alegar inspeção visual de screenshots/traces.

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
| [44657275046](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657275046) | 63c9a0d7fb26a244327b1f5b30ac8adae213760b | 8a4a0dc763320d9b752434d79e997cc98735cdf2 | failure — 8/8; bootstrap, heading e C02 passaram; 5 casos travaram no POST create, Supplier no POST change-bank e 2 em Settings; typecheck/build e cleanup success |
| [44659828913](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44659828913) | f34b80103f91cc9c075f9679cb9030e5258a1793 | 2857ba48ed110f9f8c66602a55154b4da4e2eb45 | failure — 4/4 em select-profile.ts:111, fase owner-ready, discovery ready/provider unavailable; typecheck/build e cleanup success |
| [44660962286](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660962286) | 9b51a7ab76668db203bacb07b82606649a62bfcb | bd5713a25031aa58c3168a56b01509d3c692e0d1 | failure —1pass/7fail; cinco create403 e Settings422; Supplier passou; corrigidos adaptador aninhado/campos numéricos no gate14; cleanup success |
| [44662015168](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662015168) | d62685670c27154c4a3f0f8cf0e84093d4c96d3f | 178aa6af00f7fbefabff87601f77418fce4994a8 | failure —0pass/4fail; três preview desabilitado e um discovery200 sem corpo; fix health observado no gate17; cleanup success |
| [44662556234](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662556234) | 59fc31224dda1a1419ca5cdbb8afbd99834ac708 | d975edafdd51bc3615d51ca0fcb4e4585acc8a33 | success —3pass/0fail/31expect, fronteira auth/origem; cleanup success |
| [44663537054](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663537054) | 0debca85555503d07edf8cc7855860f35a333ea4 | 77f093fdb47a2f6d4d51f98f3dd07805a61e68d3 | failure —3pass/5fail; late-edit/Suppliers/Settings verdes; botão ausente, CAS sem painel,2corpos submit200 indisponíveis,cliqueC02 interceptado; cleanup success |
| [44663540495](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663540495) | 0debca85555503d07edf8cc7855860f35a333ea4 | b0ea66503ece2b1c20f3771fe6b2698e89f7f7b9 | success —18pass/0fail/202expect, Procurement runtime/normalização/autoridade; cleanup success |
| [44664485621](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44664485621) | 66d40320017e64f90384ef8f94c44d6808580012 | 732023ad3ed6a6689e347abf1f5bc598ae0f0d7a | success —4pass/0fail/73expect, observadores reais de Reports/agenda; cleanup success |
| [44664883769](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44664883769) | 66d40320017e64f90384ef8f94c44d6808580012 | 4dfeac2574a5427fece7282ac4dab5ef56da040d | failure —0pass/4fail; RPT02 preservou/releu e parouUI48:112; outros3discovery:40; cleanup success |
| [44666127535](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44666127535) | 1fbdfda8a710e2c92f3c7566e7971946a90a341f | a3c3de27fa900f296574dcf9f3e3642a91e8b833 | in_progress —suite8casos após layout/split/botão pending; diagnóstico fechado de rede/CAS |

Artifacts relevantes:14589477538 (wp04 antigo),14589541312 (Reports antigo),14592066071 (Reports sem Basic),14593360996 (wp04 timeout). Também: 14594512219 (wp04 run9), 14594530519 (Reports run8), 14594703844 (Reports run10). Adicionais:14595313854 (wp04-11),14596013497 (Reports-12),14596827038 (wp04-14),14596334969 (Reports-17). Os logs foram lidos; nenhum ZIP foi extraído.

Requests:
```json
{"package":"app","runner":"bun","args":["test/sucafina-native/procurement-draft-conflict.test.ts"]}
{"package":"app","runner":"bun","args":["test/sucafina-native/owner-server-fetch.test.ts"]}
{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/procurement-runtime.test.ts"]}
{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/native-ui-contract/report-health.test.ts"]}
{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/wp04/procurement.spec.ts"]}
{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/reports.spec.ts"]}
```

## Arquivos alterados

- `apps/cli/src/sucafina-product/extended-review-cycle.ts`
- `apps/cli/src/sucafina-product/host-context.ts`
- `apps/cli/src/sucafina-product/native-ui/procurement.ts`
- `apps/cli/src/sucafina-product/native-ui/report-health.ts`
- `apps/cli/src/sucafina-product/native-ui/reviews.ts`
- `apps/cli/src/sucafina-product/review-agenda-projection.ts`
- `docs/handoff/HANDOFF-sf-ui-c02.md`
- `modules/sucafina/Sucafinav1/product/contracts/host-context.ts`
- `modules/sucafina/Sucafinav1/product/reviews/selection.ts`
- `modules/sucafina/Sucafinav1/runtime/procurement.ts`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/report-health.test.ts`
- `modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts`
- `packages/app-shell/e2e/sucafina/native/select-profile.ts`
- `packages/app-shell/e2e/sucafina/reports-support/fixture.ts`
- `packages/app-shell/e2e/sucafina/reports-support/lost-created-thread-read.ts`
- `packages/app-shell/e2e/sucafina/reports-support/ooxml.ts`
- `packages/app-shell/e2e/sucafina/reports-support/production-installation.ts`
- `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts`
- `packages/app-shell/e2e/sucafina/reports-support/revocation.ts`
- `packages/app-shell/e2e/sucafina/reports.spec.ts`
- `packages/app-shell/e2e/sucafina/wp04/host.ts`
- `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts`
- `packages/app-shell/src/i18n/orchestra-chapters/sf-u25.ts`
- `packages/app-shell/src/i18n/orchestra-chapters/sf-u32.ts`
- `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/budget/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/model.ts`
- `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/surface.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/host/extended-routes.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/host/server-fetch.ts`
- `packages/app-shell/src/orchestra/chapters/sucafina/procurement/approvals/pr/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/procurement/queues/panel.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/copy.ts`
- `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/forms.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/model.ts`
- `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/requests.css`
- `packages/app-shell/src/orchestra/chapters/sucafina/procurement/settings/fields.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/procurement/settings/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/procurement/settings/model.ts`
- `packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/model.ts`
- `packages/app-shell/src/orchestra/chapters/sucafina/procurement/suppliers/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/record-selection.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/answer.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/shared/draft/index.ts`
- `packages/app-shell/test/sucafina-native/owner-server-fetch.test.ts`
- `packages/app-shell/test/sucafina-native/procurement-draft-conflict.test.ts`
- `packages/client/src/sucafina/transport.ts`
- `packages/schema/src/sucafina/procurement.ts`
