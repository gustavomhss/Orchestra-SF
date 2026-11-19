# Handoff — finish-proposaldraft-20261119

SHA: 6bc409c0e2731cbfbe43009ab106ed672c730043 (editor; este checkpoint acrescenta instalação nativa e ajustes de retenção)
Data: 2026-11-19
Estado: partial

## Feito
- Expostos os dois leitores originais de proposta privada: `dashboard.dashboard-draft-read` e `dashboard.dashboard-hot-topic-draft-outcome`.
- Inputs fechados correspondem a `dashboard-http.ts:133-139` e `:88-89`; respostas conservam o envelope original SfDomainDashboardOutput.
- Ambos são POST de leitura em /dashboard; os IDs são extensões, sem alteração do catálogo congelado de 305 operações.
- UI54 agora tem editor da proposta privada: seleção humana de caso/fonte reais, save via C08 original, revalidação histórica e comparação base/current/local mais origem atual. A confirmação da nova base começa desmarcada; valores locais continuam intactos até revisão explícita.
- Falha transitória pausa a escrita e preserva valores; negação real apaga valores. Alteração de identidade do dono limpa o estado; mudança da geração exige nova leitura.
- A recuperação do primeiro save usa somente seu idempotencyKey original e a rota original de outcome, sem replay. O botão permanece dependente da ligação F02 estrita e da disponibilidade real.
- CAP02 oferece entrada para uma nova proposta privada; esse botão navega para UI54 e não escreve o registro CAP02.
- Instalação de testes em `proposals-support/host.ts` usa o factory original Operations, C08 e SQLite reais, sessão cifrada e rotas nativas. Os controles privados apenas retiram autoridade ou observam estado original.
- Releitura da mesma base não exige nova confirmação; mudança de fonte/proposta exige confirmação. Retirada de escrita desabilita campos sem descartar valores.
- O código de produtor e runtime/application.ts permanecem intocados.

## Pendente
- UI54: `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/hot-topics/proposals/draft.tsx:1` implementado, ainda sem typecheck/gate; revisar tipos e comportamento no composto com o health original.
- Composição F02: WP5 publicou `f5760ad992f59d258406aa52679e469c512294e5`, com exceção fechada para a chave original de outcome. Copiar seu common/registry composto, preservando os adapters; os 4 blobs domain/client são idênticos aos desta branch.
- Composição de disponibilidade: root publicou `56de64aba20f85804c4ae584e3940e187e011c47` com health original e os 2 IDs em 3 resources. Seu selector de namespace precisa incluir preferences/receipts; root coordena esse ajuste e os bindings C12.
- Fixture/browser: `test/product/wp02/host-workbench.test.ts:147` e `test/product/dashboard-installed-closure/consumer-read.test.ts:64` ainda navegam no console404. Migrar para instalação nativa3000 conservando todos os fatos e negativos.
- `packages/app-shell/e2e/sucafina/proposals-support/host.ts:1` e `installation.ts:1`: fixture publicada; faltam os 2 cenários consumer-read e gate Playwright3000. Portar também o assert de preservar registro para o controle nativo real, sem substituí-lo por permissões JSON.
- UI ainda sem gate. Não há qualificação de UI ou integração afirmada.

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
- Fronteira F02/codec: [44604361124](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44604361124) SUCCESS, 19 pass / 0 fail / 380 expect. Snapshot `9a541ff36821c6952aa2f5b7d0a26fef260f3ccd`, parent `f5760ad992f59d258406aa52679e469c512294e5`; essa prova cobre transporte/codec, não C08/UI.
- Gate de navegador: não rodado neste checkpoint. Auditoria original [44585817131](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44585817131) falhou nos redirects do console descomissionado; essa evidência não é um gate da alteração atual.
