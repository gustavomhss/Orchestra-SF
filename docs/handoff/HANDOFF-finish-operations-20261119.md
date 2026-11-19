# Handoff — finish-operations-20261119

SHA: e53b49cd23c3af5d72a761d2a46f9658940847a0 (código; este documento é um checkpoint posterior)
Data: 2026-11-19
Estado: partial

## Feito

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

- packages/app-shell/e2e/sucafina/operations-support/runtime.ts:48 e :90: qualificar o ingresso completo até CAP25. O último run Operations chegou ao owner-runtime231/resolving; o defeito comum de receiver de fetch foi corrigido no WP de ingresso, mas ainda não está nesta branch.
- packages/app-shell/e2e/sucafina/wp04/native-ingress.spec.ts:6: repetir o gate estreito com o transporte compartilhado qualificado; OP-PROC-01 ainda não tem um run SUCCESS.
- packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:146, :214, :315, :401, :461, :627, :708, :799: a migração está commitada; os oito fluxos ainda precisam da verificação runtime no novo host/transporte. Não equivalem a cobertura executada.
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx:935: proveniência histórica de campo permanece unbound. O schema PurchaseOrder em packages/schema/src/sucafina/procurement.ts:126–150 não a transmite. O capítulo informa somente a comparação de valores atuais.
- packages/app-shell/e2e/sucafina/wp04/sourcing-controller.spec.ts:11: conserva dois testes isolados do controlador/shell legado com respostas controladas. O run 44561871689 passou nesses testes, mas isso não prova o controlador nativo nem execução de análise. Não foram recriados ou usados como evidência de produto. O capítulo nativo decisions/analyses/index.tsx:144–145 admite preparação somente para sf-enquadrar-decisao; não há nesse controle equivalência do start/status/cancel sourcing legado. Não substituir por runs ou receipts sintéticos.
- packages/app-shell/e2e/sucafina/operations.spec.ts:13, :18, :23, :28, :33: executar o full Operations só depois do ingresso alcançável. Inclui importação/documentos e ClamD real, preparado pela infraestrutura integrada.
- apps/web/vite.config.ts e packages/app-shell/e2e/playwright.production.config.ts: infraestrutura pertence ao WP de ingresso. Os quatro gates abaixo usaram exatamente os dois arquivos de 88c06fcee93719f8d4758db35a46328112c38bda em snapshots; não são alterações próprias desta branch.

## Decisões e justificativas

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

1. Continuar em finish-operations-20261119, código e53b49cd23c3af5d72a761d2a46f9658940847a0.
2. Obter do WP de ingresso o SHA qualificado para GET e POST/revogação. O run 44573615311 passou 1/1 para leitura CAP23/reload/year com receiver corrigido; a escrita ainda era um gate separado neste checkpoint.
3. Compor um snapshot com este código e a infraestrutura compartilhada qualificada, preservando a origem de cada arquivo. Executar .ci-run.json com package app, runner playwright, config e2e/playwright.production.config.ts e args [e2e/sucafina/wp04/native-ingress.spec.ts].
4. Depois do ingresso, executar procurement.spec.ts e operations.spec.ts em gates separados: o fixture usa códigos de enrollment de cenário de uso único; não misturar as suites no mesmo host.
5. Corrigir somente causas observadas nos logs Actions, mantendo as autoridades e as asserções. Tratar o controlador de análise nativo sem usar respostas sintéticas como prova de execução.
6. Atualizar este documento com SHA, resultados terminais e pendências file:line antes de entregar ao integrador. Este WP não faz merge nem dispara sf-ci.

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
