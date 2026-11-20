# Handoff — sf-ui-c02

SHA: d62685670c27154c4a3f0f8cf0e84093d4c96d3f (último código; o commit deste checkpoint de documentação é posterior)
Data: 2026-11-20T02:38:33.970Z
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
- Foi adicionada regressão unitária de autenticação/origem com três casos em owner-server-fetch.test.ts; ainda não executada neste checkpoint.

## Pendente

- **unbound(packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:439)** — a asserção exige stored.status=cancelled em um 409. Ela já existe na base (:271), mas runtime/procurement.ts:551–556 remove stored quando não há ação atual autorizada; cancelled tem conjunto vazio (:157–193). A política foi adotada deliberadamente em 4387e9d/PR #290 e tem prova negativa de ausência de stored em microsoft-routes.test.ts:173–187 no head da PR. Não é permitido enriquecer o 409, criar ação artificial ou enfraquecer a asserção para ocultar o conflito. A leitura autorizada separada de cancelled existe, mas não muda esse contrato.
- **Contrato de UI a verificar no gate: packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:321** — o spec exige Submit requisition presente e disabled após submissão. requests/page.tsx:927 condiciona a presença à ação atual, que desaparece quando não há mais draft. Campos permanecem readonly. Nenhuma asserção ou regra de admissão foi alterada para contornar essa diferença.
- T1/T2 — aguardar run 44660962286, completo no SHA 9b51a7ab76668db203bacb07b82606649a62bfcb, após correções concretas de payload/Settings/Suppliers. CAP26 d6268567 foi corrigido depois desse snapshot e requer seu gate próprio.
- T3 — aguardar run 44662015168, completo no SHA d62685670c27154c4a3f0f8cf0e84093d4c96d3f, após correções de localhost/Basic/logout/C05/Budget e leitor DOCX. O run anterior 44659828913 parou em native/select-profile.ts:111: discovery ready, provider unavailable/host-unavailable.
- A regressão unitária owner-server-fetch.test.ts aguarda um slot, respeitando no máximo dois gates simultâneos.
- Não há declaração de navegador verde. Typecheck geral do pacote e check:guards não foram executados separadamente; os resultados registrados são os gates específicos solicitados.

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

1. Partir de sf-ui-c02; o código deste checkpoint é d62685670c27154c4a3f0f8cf0e84093d4c96d3f. Não usar as branches de snapshot que o workflow apaga.
2. Ler conclusões e primeiros erros dos runs 44660962286 (wp04) e 44662015168 (Reports). Registrar contagens e file:line; não repetir execução idêntica sem nova correção.
3. Validar CAP26 e a regressão da fronteira de autenticação quando houver slot. Preservar o limite de dois gates simultâneos.
4. Manter o unbound da asserção stored.cancelled até existir uma decisão explícita sobre a contradição entre o teste e a política protegida. Não remover o guard do produtor nem fabricar stored.
5. Corrigir somente causas sustentadas dentro dos controles/contratos existentes. Atualizar este handoff com SHAs e runs/conclusões antes de encerrar, mesmo parcial.
6. Os logs foram lidos; ZIPs de artifacts não foram extraídos pelo conector. Não alegar inspeção de DOM/trace não realizada.

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
| [44660962286](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660962286) | 9b51a7ab76668db203bacb07b82606649a62bfcb | bd5713a25031aa58c3168a56b01509d3c692e0d1 | in_progress — wp04 completo após payloads plain, ausência de undefined e ciclo Settings corrigido |
| [44662015168](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662015168) | d62685670c27154c4a3f0f8cf0e84093d4c96d3f | 178aa6af00f7fbefabff87601f77418fce4994a8 | in_progress — Reports completo após origem/auth/logout e snapshots plain |

Artifacts relevantes:14589477538 (wp04 antigo),14589541312 (Reports antigo),14592066071 (Reports sem Basic),14593360996 (wp04 timeout). Também: 14594512219 (wp04 run9), 14594530519 (Reports run8), 14594703844 (Reports run10). Os logs foram lidos; nenhum ZIP foi extraído.

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
- packages/app-shell/e2e/sucafina/reports-support/ooxml.ts
- packages/app-shell/e2e/sucafina/reports-support/production-installation.ts
- packages/app-shell/e2e/sucafina/reports-support/review-flow.ts
- packages/app-shell/e2e/sucafina/reports-support/revocation.ts
- packages/app-shell/e2e/sucafina/reports.spec.ts
- packages/app-shell/e2e/sucafina/wp04/host.ts
- packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts
- packages/app-shell/src/i18n/orchestra-chapters/sf-u25.ts
- packages/app-shell/src/i18n/orchestra-chapters/sf-u32.ts
- packages/app-shell/src/orchestra/chapters/sucafina/dashboard/budget/index.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/model.ts
- packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/surface.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/host/server-fetch.ts
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/approvals/pr/index.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/queues/panel.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/copy.ts
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/forms.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/model.ts
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/requests.css
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/settings/index.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/settings/model.ts
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/index.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/model.ts
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/suppliers/index.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/index.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/record-selection.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/answer.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/shared/draft/index.ts
- packages/app-shell/test/sucafina-native/owner-server-fetch.test.ts
- packages/app-shell/test/sucafina-native/procurement-draft-conflict.test.ts
- packages/client/src/sucafina/transport.ts
- packages/schema/src/sucafina/procurement.ts
