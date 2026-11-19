# Handoff — finish-operations-20261119

SHA: e9d9b65c99c59db988d411149eb7ba797eef617c (código; este documento é um checkpoint posterior)
Data: 2026-11-19
Estado: partial

## Feito

- A identidade CAP25 agora usa a referência C02 original selada já preparada para o mesmo ator, em vez de procurar globalmente um scope individual que a coleção não emite. O lookup exige correspondência de incarnation/version, principal/accessRevision/policy, período, campos, projeção e registro; preserva inputDigest, refDigest e projectionDigest como conceitos distintos. Clones sem o selo original e referências ambíguas são recusados. Código e9d9b65c99c59db988d411149eb7ba797eef617c.
- O gate C02 44602731257 passou com 4 testes, 114 asserções e atores requester/buyer autorizados sobre o mesmo PR. O teste mantém SQLite, autoridade e projeção originais; não qualifica sozinho o browser CAP25.
- O filtro da linha pending-approval usa um locator relativo à linha com origem na página, corrigindo o encadeamento ancestral anterior. O assert do estado exato permanece. O login WP04 lê o CAP25 pelo APIRequestContext autenticado após a navegação real, evitando o erro DevTools NoData do corpo de uma resposta consumida. Mantém schema, principal, fonte/digest/versão e igualdade com a UI. Código 3f4c94ab071275c28f1c24b794f7a5b78b4aba62.

- Procurement draft leaf qualificado pelo run 44589603579 SUCCESS, job 135791702956, snapshot 9695d83949882cbcd5d1736ad231f4c9e61435c8. Wrapper 1 pass/1 expect, filho exit0; não se inferem contadores internos não impressos.
- Matrículas locais originais agora são emitidas por spec + cenário. Operations e WP04 podem compartilhar o host sem reutilizar o mesmo token de uso único; a exigência HTTP303 permanece.
- OP-PROC-01 verifica o texto exato do status nativo, cujo role=status não tem nome ARIA.
- O login WP04 decodifica o GET CAP25 original, exige fonte/digest/versão da comparação conhecida e compara exatamente esses três campos ao link renderizado. Isso distingue ausência na projeção de falha de montagem, mantendo a prova de proveniência.

- O snapshot de conflito de PR conserva o tipo público SfPublicDraftController; não usa quarantine/restoreSameAuthority/revoke internos. Correção 89f5097b54b5cfd05f9e2165bfe59250d7552b08.
- O teste procurement-draft-leaves agora verifica a revisão nativa de conflito: fieldset presente e disabled, descrição local exata preservada, revisão anterior removida e somente um POST. O descarte é selecionado pelo nome explícito, pois a primeira ação agora é Review current record. Timeout, casos e prova de conflito continuam intactos (4620b9fb93a2ec996c411e467aa02b841fe34366).
- Supplier edit omite somente propriedades opcionais undefined, como os demais builders, sem normalização global do codec (a910756151609a539f0fa3c76de062615e911490).

- Preservado o histórico da branch e integrado o ancestral sf-join-four@0a3c05fbc4175f9514a12036d43ff1e5cca51d56 por merge com dois parents, sem force.
- A redeclaração de detail em operations-support/imports.ts foi corrigida com versionDetail; todos os usos/asserts foram mantidos. Essa correção já está na integração.
- O host de WP04/Operations agora compõe createSfHostRuntime, contribuições do grafo, createEmbeddedRoutes, descoberta, contexto e projeções originais. As três identidades são emitidas por createOperatorIdentity; os grants preservam a política anterior e o papel viewer só reduz acesso.
- O processo Actions prepara banco core, config, credenciais e diretórios temporários privados antes dos imports. Global termina sua inicialização antes dos demais módulos do grafo. HttpRouter recebe os serviços reais da plataforma e do AppNodeBuilder.
- O browser usa http://127.0.0.1:3000 e o mount real /sucafina; o proxy preserva Request/Host/Origin. Sessão, descoberta e contexto são reais. O operador escolhe o projeto pelo controle do shell; observadores usam BrowserContext separado.
- Os oito cenários de wp04/procurement.spec.ts usam capítulos nativos: validação 422 e foco, W19 para título, conflito CAS entre dois operadores, recusa de aprovação após cancelamento, bloqueio durante POST e edição local posterior, ciclo PR/sourcing/PO/issue, comparação A/B/C e FX congelado, permissões de banco e revalidação, settings e reset.
- Requests renderiza os fieldErrors reais de PR/PO e oferece leitura explícita da versão remota antes da decisão de conservar entradas em um conflito. A versão nova não é adotada nem reenviada automaticamente. Aprovação cancelada mantém o comentário local sem reativar a ação.
- Sourcing mostra a seleção persistida e fatos recebidos; valores ausentes são Unavailable. A fila mostra baseAmount/baseCurrency da projeção, sem calcular conversão ou score. O seletor também preserva qty/unitPrice já declarados em Quote e gravados pelo produtor, que antes eram descartados.
- PO mostra campos reais inclusive após emissão e compara paymentTerms atuais do fornecedor/pedido com aviso explícito de que isso não prova proveniência histórica.
- Suppliers mostra campos bancários somente se a projeção autorizada os transmitiu. A revisão do comando não ecoa o valor secreto; viewer continua sem campos e sem comando de alteração, com prova negativa na resposta CAP27 e na UI.
- Suppliers agora liga o SfBoundAssets original ao kind supplier/page Suppliers que o cliente e produtor já suportam. CAP27 transporta somente metadados de attachments (sem key privado); upload mantém scanner, CAS e autorização originais. OP-DOC-01 usa Download (verify access), captura o GET assinado real, compara bytes exatos e conserva as provas de revogação.
- O helper de tokens Planner usa a linha data-sf-row e o botão Manage reais do CAP18, mantém Source revision e passa year lido do CAP23 junto de version.
- Settings envia domain.command.CAP28.reset original. A revisão informa o efeito conhecido e a ausência de valores futuros publicados; defaults só são verificados após resposta e nova leitura autorizada. Um 422 terminal libera a mesma intenção pendente, conserva entradas e não avança a versão.
- procurement-snapshot/refusal usam Add quotation real quando o produtor não trouxe cotações; esperam o reconhecimento do produtor antes de navegar após aprovação. queueIdentity verifica o drilldown nativo e conserva os asserts de identidade/digest/versão.
- wp04/native-ingress.spec.ts seleciona OP-PROC-01 reutilizando o helper integral; o runner aceita nomes exatos de spec, não --grep.

- Os builders de PR, PO e sourcing e o id opcional de Suppliers agora omitem somente os campos ausentes. Preservam null/0/false/strings e o codec original estrito; não há sanitização global.
- OP-IMP-01 não presume um ID em POST body.value: comprova exatamente um ID novo na projeção CAP23 original, igualdade da linha nativa e identidade no editor aberto pelo botão select real, além do nome/ano/reload já existentes.

## Pendente

- packages/app-shell/e2e/sucafina/operations-support/procurement-comparison.ts:48 — a correção do locator preserva pending-approval, mas ainda requer o gate nativo composto; o run Ops4 falhou antes deste patch.
- packages/app-shell/e2e/sucafina/operations-support/procurement-snapshot.ts:135, procurement-refusal.ts:156 e documents.ts:14 — Ops4 44594105701 esgotou a espera original pelo primeiro POST de criação. Os contextos publicados em docs/handoff/observed-native-screens-44594105701-v2.md na branch audit-logs-20261119 mostram revisão enviada seguida de outcome desconhecido. O extrato mínimo publicado pelo integrador em docs/handoff/observed-native-transport-20261119.md confirma zero POST nos três traces, somente GET200 de contexto/CAP25/CAP27; o mesmo parser capturou o POST Planner200 no trace de importação, como controle positivo. A causa está antes da rede; falta identificar codec/stamp/key/F02 exato. Não foram alterados matchers, timeouts ou fences por hipótese.
- packages/app-shell/e2e/sucafina/operations-support/imports.ts:136 — nome do CAP23 estava desabilitado no Ops4; o integrador é dono do fix comum de reatividade CAP23 e da próxima composição. Esta branch não modifica esse arquivo neste checkpoint.
- packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:27 e apps/cli/src/sucafina-product/native-ui/procurement.ts:223–267 — o readback autenticado substitui o consumo DevTools e a origem C02 está qualificada por unidade, mas os oito cenários nativos ainda precisam de execução após a composição. Pontos de entrada: :159, :227, :328, :414, :474, :640, :721 e :812.
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx:935 — proveniência histórica de campo permanece unbound. O schema PurchaseOrder em packages/schema/src/sucafina/procurement.ts:126–150 não a transmite. O capítulo informa somente a comparação de valores atuais.
- packages/app-shell/e2e/sucafina/wp04/sourcing-controller.spec.ts:11 — conserva dois testes isolados do controlador/shell legado com respostas controladas. Os passes não provam o controlador nativo nem execução de análise. O capítulo nativo decisions/analyses/index.tsx:144–145 admite preparação somente para sf-enquadrar-decisao; não há equivalência confirmada do start/status/cancel sourcing legado. Não substituir por runs ou receipts sintéticos.
- packages/app-shell/e2e/sucafina/operations.spec.ts:13, :18, :23, :28 e :33 — o conjunto continua não qualificado. Ops4 terminou com 13 falhas e somente os dois testes isolados de sourcing-controller passando. Próximo gate pertence ao integrador, com infraestrutura compartilhada e ClamD real.
- packages/app-shell/e2e/sucafina/operations-support/installation.ts — a extensão test-only para grants explícitos originais e runtime.services está sob posse do WP C12 (wp2_resume), preservando os defaults. Não sobrescrever esse delta ao transplantar os arquivos desta branch.
- apps/web/vite.config.ts e packages/app-shell/e2e/playwright.production.config.ts — infraestrutura compartilhada pertence ao WP de ingresso. O histórico abaixo conserva quais snapshots foram usados; não são arquivos próprios desta branch.

## Decisões e justificativas

- No teste de conflito, a asserção de ausência do fieldset foi substituída por bloqueio explícito e conteúdo local exato, com revisão removida e contagem de gravações mantida. Isso conserva a proibição de edição/envio com CAS antigo e permite ao operador comparar a cópia local com o registro atual. O descarte continua obrigatório para abandonar essa cópia.

- Nenhum teste foi excluído/pulado; nenhum timeout foi aumentado. As observações antigas substituídas estão explicitadas abaixo.
- O título existente é salvo pelo W19 e pelo comando real Requests/save com values.pr.title; não foi misturado no payload residual de PR.
- A edição durante pendingOperation é bloqueada pelo contrato nativo S03. A antiga tentativa de preencher um campo durante POST foi substituída por prova de campo desabilitado, payload exato, valor persistido visto por outro operador, entradas posteriores locais e contagem de um único POST. A edição não foi habilitada artificialmente.
- O legado tinha q/filter na URL de um form. A rota nativa aceita request e filtros imediatos locais (host/procurement-route.ts:22); os asserts de query do console foram substituídos por navegação/filtro nativos reais, mantendo teclado, conteúdo filtrado e o valor financeiro.
- Os rótulos de proveniência histórica do PO não são publicados no contrato atual. Os asserts correspondentes foram substituídos pela comparação honesta das fontes atuais, conservando os valores negociados após save/reload/issue. Não se infere que um valor atual foi a origem histórica de outro.
- SettingsData (packages/schema/src/sucafina/procurement.ts:288–290) não publica defaults antes do reset. A revisão marca esses valores como não fornecidos, sem fabricar baseline; o comando original e a leitura posterior decidem o resultado.
- CAP27 somente transmite banco quando o produtor autoriza admin/supplieradmin (apps/cli/src/sucafina-product/native-ui/procurement.ts:278–285). A UI não cria novos grants; o teste viewer verifica a omissão na resposta original.
- modules/sucafina/Sucafinav1/runtime/application.ts permanece sem edição. Não foram fabricados descriptor, contexto, Session, receipt, readiness, digest ou resultado de execução.
- Não há declaração de GO.

- A comparação de created.body.value com o ID do Planner foi substituída pela diferença exata dos IDs antes/depois no GET CAP23, linha nativa e identidade do editor. runtime/application.ts:367–371 responde somente ok/warnings; o campo anterior nunca foi transmitido. Nenhuma identidade é derivada do payload enviado.

## Como retomar

1. Continuar em finish-operations-20261119, código e9d9b65c99c59db988d411149eb7ba797eef617c. O integrador transpõe somente os deltas próprios, preservando a factory C12 e infraestrutura de ingresso mais recentes.
2. Usar o run 44602731257 e o teste product/wp04/queue-view.test.ts como prova da identidade C02, sem reinterpretá-los como sucesso do browser ou de Operations.
3. Ler docs/handoff/observed-native-transport-20261119.md na branch audit-logs-20261119: os três fluxos com outcome desconhecido não emitiram POST. Localizar o campo/codec/stamp/key/F02 que recusou antes da rede, preservando os fences.
4. Compor os fixes confirmados com o candidato atual e executar o spec nativo estreito que cobre a próxima causa. Não repetir gates sobre a branch antiga sem a infraestrutura compartilhada.
5. Preservar matrículas de uso único, atores reais, revisão humana, CAS, scanner e asserções de efeito. Não sintetizar fonte, recibo ou proveniência ausente.
6. Atualizar este documento com SHA, resultado terminal e pendências file:line antes de entregar ao integrador. Este WP não faz merge nem dispara sf-ci.

## Comandos e resultados

- Verificação local: não executada. Toda verificação ocorre no GitHub Actions.
- Base/infra: [44561871689](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44561871689) SUCCESS para typecheck:sf-e2e e dois testes isolados sourcing-controller; não qualifica o ingresso nativo.
- [44564777712](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44564777712), job 135703427279: FAILURE. Snapshot 7441184861a7573b993c6b4a065a968c583120ad. Typecheck TS2554 em wp04/host.ts:113/164, handler sem serviços de request. Corrigido em 5a421c8ab0f240ede291c5df92d6ae564a40a4a3.
- [44565798609](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44565798609), job 135707047742: FAILURE. Snapshot 6c63ceb6e8a9fc1b07dc6568747198b69ca3cca5. Typecheck/build passaram; startup ReferenceError no Global.node de core/util/effect-flock.ts:297. Corrigido em b5d0b53f91baa13d1c7a677a34009e11001f8f3d.
- [44566864715](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44566864715), job 135710895916: FAILURE, 1 teste falhou. Snapshot 037fd52d30704799719d2943a8ff9ca0446e2395. Typecheck/build passaram; health/enrollment303/discovery200/context200/Choose project passaram; CAP25 Requests ausente. Artifact 14552173829 é evidência do teste, não package digest.
- [44568624223](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44568624223), job 135717219345: FAILURE, 1 teste falhou. Snapshot 46c0c668c28b21efdecd2251b63e8d1446fcced3. Typecheck/build passaram. Diagnóstico real em /orchestra/sf-procurement/requests/new: data-sf-host=owner-runtime231, owner=resolving, serverUnavailable=0, Requests=0, status Resolving installed Sucafina.
- Os quatro gates usaram: {"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/wp04/native-ingress.spec.ts"]}.
- e53b49cd23c3af5d72a761d2a46f9658940847a0: ainda sem gate próprio neste checkpoint.
- Dependência compartilhada, sem qualificar Operations: ingresso [44573615311](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44573615311) SUCCESS 1/1 para CAP23/reload/year; ingresso [44575467126](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44575467126) FAILURE 2/2, com primeiro POST bloqueado pelo codec opcional undefined e waiter de logout a corrigir. O ingresso9 [44579042477](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44579042477) confirmou POST real200/ok, mas falhou em um assert body.value inexistente e no logout por perda do transporte original. O ingresso10 [44580949588](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44580949588) ainda estava em andamento neste checkpoint; nenhum gate Operations foi disparado sobre uma dependência sabidamente falha.
- guards: não executados nesta branch. sf-ci: nenhum novo dispatch, rerun ou cancelamento por este WP.

- Audit APP-BROWSER [44585817131](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44585817131), job 135778309143: 110 pass / 4 fail / 895 expect, 114 testes em 32 arquivos. Procurement wrapper terminou com exit137 após180s; primeira falha interna era a expectativa fieldset=null recebendo HTMLFieldSetElement. O dump enorme encobriu o restante. Não se aumentou timeout; corrigiu-se o contrato de UI e o seletor de descarte.
- Ingresso composto [44585650902](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44585650902): falhou no typecheck app, incluindo o tipo interno de draft em requests/page.tsx. [44587034870](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44587034870): CLI e app passaram, E2E typecheck falhou em decoder BI separado. Nenhum desses resultados qualifica execução de Operations no browser.

- [44589603579](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44589603579) SUCCESS, job 135791702956: procurement-draft-leaves, wrapper1 pass/1 expect, child exit0. Snapshot 9695d83949882cbcd5d1736ad231f4c9e61435c8.
- [44589439780](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44589439780) FAILURE, job 135791126209: três typechecks PASS; 13 failed / 2 passed em6,1min. Primeiro OP-PROC-01 falhou por lookup de nome ARIA; OP-PROC-02/03 e OP-DOC-01 aguardaram POST; OP-IMPORT-01 não montou o detalhe CAP23. WP04 teve cinco matrículas404 por reutilização dos tokens consumidos em Operations e três esperas por source-ref. Os dois passes são testes isolados de sourcing-controller, não prova nativa.

- [44594105701](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44594105701) FAILURE, job 135807645498: os três typechecks e ClamD real passaram; 13 failed / 2 passed em 5,9 min. OP-PROC-01 falhou no filtro pending-approval; OP-PROC-02/03 e OP-DOC-01 mostraram outcome desconhecido e aguardaram o primeiro POST; OP-IMPORT-01 encontrou o input desabilitado. WP04 teve quatro erros DevTools NoData e quatro fontes null. Os dois passes pertencem a sourcing-controller. O artifact 14565396740 é evidência do teste, não digest de pacote. A extração read-only publicada pelo integrador não constitui novo teste.
- [44602731257](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44602731257) SUCCESS, job 135838170460, cleanup 135839259625 SUCCESS. Código e9d9b65c99c59db988d411149eb7ba797eef617c, snapshot 3cdebb38b87e9a9f66b26259338066ee29b264b3. Requisição: {"package":"sucafina","runner":"bun","args":["Sucafinav1/test/product/wp04/queue-view.test.ts"]}. Resultado: 4 pass / 0 fail / 114 expect, 1,25 s. Nenhum gate E2E nativo foi executado sobre e9d9 neste checkpoint.
