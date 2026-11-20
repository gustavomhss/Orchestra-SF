# Handoff — finish-legacytests-20261119

SHA: d8e8cdb54d7631d5d70a6b7a35d324a1a448137a (código; este handoff é um commit posterior)
Data: 2026-11-19
Estado: partial

## Feito

- Base exata: sf-join-four@d93d7c7687c2335cb89fd1e26bec562d07d9ec7f.
- full-module.test.ts mantém os quatro testes. O catálogo conserva a cardinalidade, unicidade e conjunto exato de páginas por domínio; GET e HEAD do console retirado agora comprovam o contrato404 e texto original.
- O ciclo HTTP de requisição, aprovação, sourcing, scores incompletos422 sem mutação, PO, emissão, download, versões e auditoria permanece intacto.
- As12requisições concorrentes continuam comprovando números únicos e isolamento entre superfícies.
- A seleção independente de períodos usa os produtores originais CAP01/CAP11/CAP12, com validação dos schemas, preferência dos filtros próprios, fallback de período e releitura do Executivo após leituras das outras páginas.
- A nova fixture local-native usa configuração privada, SQLite, createLocalInstallation, createSfHostRuntime, enrollment e cookie emitido pela autoridade real. Não abre browser ou listener.
- Reutilizado o grafo privado já qualificado de microsoft-login/native-host.ts. A única extensão permite que a origem do health venha de discovery.current.publicOrigin original quando não existe transport Microsoft. host/discovery/health/identity e isolamento permanecem exigidos; nenhuma identidade ou permissão é fabricada. Alteração coordenada com ci_read.

## Pendente

- modules/sucafina/Sucafinav1/test/fixture/local-browser.ts:62 — monta somente o domínio em localhost:4110 e não o capítulo com preview3000. Precisa composição nativa compartilhada qualificada; trocar apenas URL não corrige a causa.
- modules/sucafina/Sucafinav1/test/business-browser.test.ts:19 e:212 — CRUD/lifecycle e conflito entre sessões ainda usam forms e rotas retirados. Preservar valores, CAS e persistência ao migrar para controles nativos.
- modules/sucafina/Sucafinav1/test/io-browser.test.ts:26 e:115 — imports/exports e bytes reais ainda dependem de formulários legados. Preservar totais, fórmulas e bytes.
- modules/sucafina/Sucafinav1/test/parity-polling-browser.test.ts:9 — usa Settings legado e window.sucafinaRefresh. Qualificar concorrência e retenção de draft pelo contrato nativo efetivamente implementado.
- modules/sucafina/Sucafinav1/test/visual-layout.test.ts:30 — métricas, layouts e screenshots ainda miram console4110.
- modules/sucafina/Sucafinav1/test/form-layout.test.ts:17 — cria dados reais, mas mede DOM legado; falta fixture/seletores nativos.
- modules/sucafina/Sucafinav1/test/operator-browser.test.ts:29 — enrollment via arquivo espera dashboardHTML e sidebar antigos. Preservar enrollment real e navegação autorizada sem recriar console.
- modules/sucafina/Sucafinav1/test/local-controls-browser.test.ts:26 — backups, inbox, leitura e logout ainda dependem de DOM legado. Não recriar UI sem consumidor/produtor nativo verificável.
- Os sete arquivos de browser e a fixture compartilhada foram preservados, sem skip, remoção de testes ou aumento de timeout.

## Decisões e justificativas

- full-module.test.ts deixou de exigir HTML200, forms/tables/metric e sidebar para GETs que runtime/application.ts:58–60/94–95 descomissiona explicitamente. O teste agora verifica404/HEAD e o catálogo real. Isso não reivindica qualificação visual; a prova visual continua pendente nos arquivos acima.
- A antiga distinção de um seletor de sidebar foi substituída pelo contrato público de seleção da projeção: CAP01 usa execYear/executiveMonth; CAP11 usa opsYear/operationsMonth; CAP12 usa secYear/securityMonth, sem contaminar outras leituras. Os números2024/2025/2027 e meses7/3 foram preservados, com fallback2024/6 adicional.
- O endereço localhost:4110 é usado somente em Requests internos do teste de módulo, porque runtime/local-configuration.ts:46 impõe essa origem. Nenhum browser navega para4110.
- Não foram alterados produtores, runtime/application.ts, permissões, receipts, baselines, digest ou workflows. O fallback do grafo lê a origem original da descoberta, sem adaptador de autoridade.

## Como retomar

1. Partir de finish-legacytests-20261119 no SHA de código acima, com este handoff.
2. Integrar a composição de ingresso compartilhada somente depois do gate de escrita/contexto/logout do agente wp2.
3. Reutilizar esse host real na fixture de browser em3000; migrar cada grupo preservando suas asserções de negócio e geometria. Ausência de UI nativa permanece unbound até existir contrato verificável.
4. Fazer gates estreitos por causa corrigida; não executar sf-ci por esta branch.
5. Este subconjunto qualificado pode ser integrado separadamente dos browsers pendentes.

## Comandos e resultados

- Gate: {"package":"sucafina","runner":"bun","args":["Sucafinav1/test/full-module.test.ts"]}.
- Snapshot1c050bf6fb57bbb3f1ca214e197c4073a3043b10; branch temporária ci-run-linux-finish-legacy1-20261119, apagada pelo workflow.
- [Run44581021375](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44581021375), job135761357289: SUCCESS;4pass,0fail,195expect;4testes em1arquivo,6.91s. Todos os quatro testes listados acima passaram.
- Typecheck separado: não executado por esse gate Bun. Guards: não executados. Browsers restantes: não executados nesta rodada. sf-ci: nenhum dispatch/rerun/cancelamento por esta branch.
