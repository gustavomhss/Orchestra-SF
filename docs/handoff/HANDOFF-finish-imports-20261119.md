# Handoff — finish-imports-20261119

SHA de código: 6e36f0d443e4d578b8e3b6f2600b1797d4431b51
Base: sf-join-four @ 8eb6c37106e12ac9e79644872e70c717df3db875
Data: 2026-11-19
Estado: partial

## Feito

- operations-support/imports.ts: o fluxo usa UI55 /orchestra/sf-imports/new, seleção pelo selectionRef real, Generate preview, referência/detail do produtor e regiões nativas. Mantém admissão real XLSX/ClamD, SHA-256 dos bytes, baseIdentity, comandos, before/after, origem F2, exportações completas, versões e um único POST Apply.
- imports/index.tsx: após perda de entrega do Apply, uma leitura import-reference sob o mesmo owner/generation consulta o resultado original. Não reenvia POST. Sem recibo mantém outcome-unknown; denied/session-expired apagam dados privados. A ação de retry de leitura usa essa mesma reconciliação.
- UI55/UI57 renderizam manifestId e principalRef/version do recibo original; não calculam resultado. Destination/source têm nomes acessíveis explícitos. Grupos de mudanças usam section/h3/h4; details/summary removidos sem remover campos.
- O helper separa o GET obrigatório anterior ao Apply do GET de recuperação posterior ao único POST; o primeiro não serve como prova de recuperação.

## Pendente

- packages/app-shell/e2e/sucafina/operations-support/imports.ts:165 — executar jornada no snapshot composto com os pré-requisitos reais de Operations. Último gate 44606780612 parou em :167 no data-import-workbench legado, após criar/renomear a versão e semear o domínio original.
- packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx:354 — reconciliação de entrega desconhecida e revogação ainda não qualificadas no navegador neste SHA.
- Nenhum resultado completo de WP5, pacote ou sf-ci é alegado.

## Decisões e justificativas

- Asserções de negócio removidas: nenhuma. Todos os valores financeiros, células/formulas restantes, identidade do recibo, source versions, imutabilidade do preview e número de POSTs permanecem.
- O capítulo retorna detail no GET import-reference após preview; asserta-se o mesmo detail original, além de igualdade do manifesto, sem exigir um GET import-detail que o consumidor nativo não faz.
- O console guardava a última referência implicitamente. A rota nativa requer referência explícita e escolha do produtor: o helper obtém o link View result real, usa o /review definido no registro de rotas, recarrega e pede Refresh receipt. Não se introduziu cache de autorização nem manifesto sintético.
- Controles legados ausentes: operations-support/imports.ts antigo :166 data-import-workbench; :168 status direto; :243 data-receipt; :285 data-context/data-impact/data-changes. Substituídos pelas regiões nativas, estado/phase, fatos do recibo original e provas equivalentes de ocultação privada.
- Após 403, SfStatePanel remove conteúdo e ações: asserções exigem denied+alerta, ausência dos dois blocos de impacto, mudanças, recibo/ID e Apply, um único POST e exportação igual pelo viewer. Não se adicionou um botão legado desabilitado ao painel privado.
- Status positivos antigos passam a ser phase/read-state mais headings e recibo real. A instrução de revisão já existente em sf-u23 agora é renderizada.
- Nenhum console legado, timeout, skip, runtime/application.ts, baseline/coverage/digest ou resultado GO alterado.

## Como retomar

1. Partir de finish-imports-20261119 @ 6e36f0d443e4d578b8e3b6f2600b1797d4431b51; compor estes três arquivos sobre Assembly25 dbe6e348367d8e1f915dac918a23bc5028f8a408 com o patch observado de Operations.
2. Criar ci-run-linux-... no SHA composto e .ci-run.json com package app, runner playwright, config e2e/playwright.production.config.ts e o spec Operations mais estreito que contém importJourney.
3. Ler resultado/artefatos reais; corrigir só a causa observada, atualizar este handoff e mergear o conjunto qualificado em sf-join-four.

## Comandos e resultados

- bun run typecheck (app-shell/SF E2E): ainda não executado para este patch; o gate anterior 44606780612 aprovou os três checks antes dos testes.
- bun run check:guards --base origin/dev: não rodado neste patch.
- test-ci 44606780612 / snapshot e74f0d5c4871d1b11c417a7be56283d5d74e95fd: FAILURE, 1 passou/4 falharam; Import encontrou controle legado antes da admissão XLSX. https://github.com/gustavomhss/Orchestra-SF/actions/runs/44606780612
- Nenhuma verificação local ou shell. Próximo gate exclusivamente GitHub Actions.
