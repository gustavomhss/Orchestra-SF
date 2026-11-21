# Handoff — finish-proposals-native-20261119

SHA: ca4f43a91719331b0cfd620bbc9b0b21c6e27d41 (código; o commit seguinte contém este handoff)
Data: 2026-11-19
Estado: partial

## Feito
- UI54/CAP02 — onze folhas de app-shell transplantadas sem alteração de bytes do código qualificado `1a8b23cef45c721b012078ed71f17460bc59ccf6` sobre `sf-join-four@2682f82da2650314e3437ab48b5c65e52c5b3fe4`.
- UI54: proposta privada ligada aos leitores/saves originais; valores locais, CAS e comparação base/current/local/source preservados; recuperação do primeiro resultado usa somente a identidade/chave original, sem replay.
- F03: a confirmação do save original sobrevive à admissão da rota somente por portador do owner e releitura privada autorizada, com draftRef/case/target/source/versão exatos. DTOs JSON são comparados por todas as chaves/valores e arrays ordenados, sem confundir ordem de propriedades com mudança de conteúdo.
- CAP02: entrada nativa de proposta e captura/histórico reais com source identity, incarnation, versão, valores, períodos e evidenceState. Não substitui a preservação de pauta.
- Apply: consome o CommandReceipt original e exige `result.ok === true`; apresenta id/version/at reais sob owner/generation/transport/changeId atuais, bloqueia novo Apply e oferece releitura explícita. A releitura limpa o acknowledgement antes de consultar o produtor. Nenhuma falha de deadlock foi alegada ou corrigida no produtor.
- E2E: cinco jornadas nativas com SQLite/C08/identidade/autoridade originais e browser3000. A fixture retém bytes/status da mesma resposta HTTP para contornar indisponibilidade de corpo no CDP, sem resposta inventada ou nova requisição de mutação.
- [Run44630358847](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44630358847): **SUCCESS, 5 passed / 0 failed, 3.3m**. CLI/host, app-shell e SF E2E typechecks SUCCESS. Job135935026633 e cleanup135941507545 SUCCESS.
- Snapshot executado `1db9f18a623cc1331e07f582d989e5150d636da3`. Todos221 expects, timeouts originais, um Apply/recibo e leitura independente final de C08 passaram.
- Os dois arquivos compartilhados recebem somente os hunks qualificados: Hot Topics importa/renderiza capture e abre UI54; dispatcher F03 importa/despacha o revalidador específico. Main2682 e o ancestral350df têm esses dois arquivos idênticos, portanto não houve sobrescrita de mudança alheia.
- Arquivos: `dashboard-installed/proposals.spec.ts`; `proposals-support/{host,installation,protocol}.ts`; `sf-u38.ts`; `dashboard/hot-topics/{index,capture}.tsx`; `dashboard/hot-topics/proposals/{index,draft}.tsx`; `host/{draft-revalidation.ts,draft-revalidation-proposal.ts}`.

## Pendente
- Dependências qualificadas presentes no gate9, ainda ausentes de main2682: `apps/cli/src/sucafina-product/host-context.ts:969` (observar saúde UI54/capture/history pelos produtores reais) e `native-ui/dashboard-proposal-health.ts:1`, mais os recursos/união tipada correspondentes. Root compõe somente esses hunks; esta branch não copia o host completo.
- `packages/app-shell/e2e/sucafina/operations-support/installation.ts:29`: extensão original grants?/services vem do PR391. O host da proposta usa grants em:69 e services em:79; não é correto qualificar o recorte sobre main sem essa dependência. Root coordenará integração de391 e atualização da base.
- `sf/ci/suites.json:1`, `script/sf-ci/gate.mjs:192,263,383` e `.github/workflows/sf-ci.yml:441-513`: cadastro permanente aprovado para as mesmas três suítes UI com specFiles fechados, exatos e não vazios, sem mudar IDs/diretórios/autoridade da seleção. WP7 ainda será implementado.
- `modules/sucafina/Sucafinav1/test/product/wp02/host-workbench.test.ts:139,241,461` e `.../dashboard-installed-closure/consumer-read.test.ts:53,168`: cinco corpos UI legados mantidos até registro permanente e equivalência serem compostos atomicamente. Os units puros de descoberta:406/:430 continuam integralmente.
- Integração/PR ainda não qualificados sobre main com todas as dependências. O run citado prova o snapshot composto indicado, não uma combinação diferente.
- Baselines completas e único sf-ci final permanecem com o root; inventário precisa vir do Actions real e revisão independente.

## Decisões e justificativas
- Asserções removidas: nenhuma. As211 originais foram mantidas;4 verificações da releitura e6 do recibo elevaram o spec para221.
- Não recriar console legado; somente capítulos nativos `/orchestra/...` e endpoints JSON originais. Nenhuma edição em `runtime/application.ts`, F01 global, withCase, caches ou transações.
- Não inferir receipt/applied de proposta ou leitura. Um resultado desconhecido não autoriza replay ou nova chave.
- Não reduzir cobertura silenciosamente: remover cinco testes Bun depende de cadastro permanente das jornadas; os dois units puros foram conferidos byte a byte e serão preservados.
- Histórico detalhado e runs anteriores: [handoff do desenvolvimento](https://github.com/gustavomhss/Orchestra-SF/blob/cec8d7a4a731921d9fff88bb5d793280db93dc4c/docs/handoff/HANDOFF-finish-proposaldraft-20261119.md).
- Nenhuma baseline, coverage, digest ou GO forjado.

## Como retomar
1. Partir de `finish-proposals-native-20261119@ca4f43a91719331b0cfd620bbc9b0b21c6e27d41`.
2. Compor dependências reais qualificadas pelo run44630358847, incluindo factory/selector do PR391; preservar main C12/Report health e demais adapters.
3. Revisar o PR e qualificar o recorte composto se houver diferença material; integrar somente a versão concreta revisada.
4. Completar WP7 com a lista explícita aprovada pelo root, executar o guard estreito e preparar inventário CI-SF-only fiel aos8 shards originais, sem disparar workflow420530405.
5. Migrar os cinco corpos UI Bun no mesmo conjunto do cadastro permanente; derivar baseline apenas de inventário real aprovado e deixar o único sf-ci final para root.

## Comandos e resultados
- `bun typecheck` (CLI/host, app-shell e SF E2E): SUCCESS no run44630358847.
- `bun run check:guards --base origin/dev`: não rodado nesta frente; reservado ao WP7/root.
- `test-ci` via `ci-run-linux-proposals9-20261119`: SUCCESS,5/5. Pedido app/Playwright/configprodução restrito a `e2e/sucafina/dashboard-installed/proposals.spec.ts`.
- Nenhum sf-ci completo, pacote, baseline ou execução local nesta frente.
