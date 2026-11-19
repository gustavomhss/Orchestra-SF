# Handoff — finish-proposaldraft-20261119

SHA: 350dfc1bf332fcf1806813231c4aec8a3a45440f (base; este commit contém o primeiro checkpoint de contratos)
Data: 2026-11-19
Estado: partial

## Feito
- Expostos os dois leitores originais de proposta privada: `dashboard.dashboard-draft-read` e `dashboard.dashboard-hot-topic-draft-outcome`.
- Inputs fechados correspondem a `dashboard-http.ts:133-139` e `:88-89`; respostas conservam o envelope original SfDomainDashboardOutput.
- Ambos são POST de leitura em /dashboard; os IDs são extensões, sem alteração do catálogo congelado de 305 operações.
- O código de produtor e runtime/application.ts permanecem intocados.

## Pendente
- UI54: `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/hot-topics/proposals/index.tsx:127` precisa ligar a criação/edição privada, revalidação atual e comparação base/current/local; em andamento.
- F02: `packages/client/src/sucafina/transport.ts:238` ainda recusa chave em POST de leitura. A recuperação de primeiro save requer somente no novo ID a chave original; WP5 prepara a exceção estrita com negativos. Até lá, resultado desconhecido permanece bloqueado.
- Disponibilidade: `apps/cli/src/sucafina-product/native-ui/live-context.ts:54` precisa indexar os leitores e observar o handler/C08 original; root cuida do health e nativeReadBinding, sem readiness inventada.
- Fixture/browser: `test/product/wp02/host-workbench.test.ts:147` e `test/product/dashboard-installed-closure/consumer-read.test.ts:64` ainda navegam no console404. Migrar para instalação nativa3000 conservando todos os fatos e negativos.
- Contratos ainda sem gate. Não há qualificação de UI ou integração afirmada.

## Decisões e justificativas
- Asserções removidas: nenhuma. Os testes legados não foram apagados ou enfraquecidos.
- O produtor privado existe (`dashboard-decisions.ts:119-208`), inclusive revalidação com leitura retirada, fonte histórica, active draft e fences. A falta está na ligação/consumidor UI54, não em dados de negócio.
- CAP02 CRUD de Hot Topics não substitui proposta privada C08. Os fluxos permanecem distintos.
- `hot-topic-draft.ts:133-186` encontra o primeiro save somente pela operação original e valida seu recibo/digest contra o draft protegido. Não basta selecionar um item semelhante de uma lista.
- Registry/common nesta branch têm base sf-join-four. Ao compor com a branch retry, aplicar apenas os dois novos IDs, preservando os overrides de rotas e a construção SfFrozenOperationRoutes daquela branch.

## Como retomar
1. Partir desta branch e acrescentar UI54/fixture nos caminhos acima.
2. Compor as disponibilidades reais do root e a exceção F02 do WP5.
3. Rodar o menor gate de navegador com os cenários originais; registrar SHA/run/resultado antes de merge.

## Comandos e resultados
- `bun run typecheck`: não rodado neste checkpoint.
- `bun run check:guards --base origin/dev`: não rodado neste checkpoint.
- test-ci: não rodado neste checkpoint. Auditoria original [44585817131](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44585817131) falhou nos redirects do console descomissionado; essa evidência não é um gate da alteração atual.
