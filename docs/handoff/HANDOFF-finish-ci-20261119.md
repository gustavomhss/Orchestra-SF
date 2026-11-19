# Handoff — finish-ci-20261119

SHA: ff1088a6add9ff9431a4959323d7f730362120c6 (código); c39781c3c70dce9c15abd8d432a6120b442f5571 (snapshot de verificação).
Data: 2026-11-19
Estado: partial

## Feito

- Corrigidas as declarações duplicadas de `name` em Decisions e `detail` em Operations; corrigido TS2367 em Reports sem alterar as condições nem asserções.
- `test-ci` executa o typecheck real dos E2E Sucafina nas seleções Playwright de produção desse produto.
- Selecionar `e2e/sucafina/operations.spec.ts` passa a qualificar o ClamD real pelo mesmo script do sf-ci, exportando a porta somente depois do PING e da prova INSTREAM.
- Gate 44561871689: SUCCESS; job 135693050100, typecheck:sf-e2e SUCCESS, sourcing-controller.spec.ts 2 passed; cleanup 135695220887 SUCCESS.
- As correções de compilação reproduzem exatamente 8375685071b5b2603fa0391e4c4b5ec862330d5c (Reports), 6dd5257b87023263380a3baf56947f9b06791f4e (Decisions), 307976a44c74d7a6284772d9811b7f368a51ae1c (Operations).

## Pendente

- .github/workflows/test-ci.yml:171 — o passo ClamD aguarda a execução de operations.spec.ts; a seleção estreita de sourcing-controller não exige scanner e não o executou.
- packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:21 — ingresso nativo e os demais contratos de Reports continuam em fechamento na frente Reports/ingress.
- packages/app-shell/e2e/sucafina/operations.spec.ts:1 — fluxo nativo de Operations depende da composição legítima da instalação, em trabalho separado.

## Decisões e justificativas

- O pedido de continuidade autoriza novos gates necessários. Não se alterou seleção, timeout, retries, autoridade ou qualquer asserção de negócio.
- Nenhuma asserção removida. O controle ClamD usa imagem/script existentes e não concede aceitação sintética de bytes.
- O resultado estreito comprova compilação e dois testes do controller; não comprova Reports, Operations completo, pacote final ou qualificação de release.

## Como retomar

- Integrar este commit após o gate registrado e usar sua infraestrutura nas branches finish-ingress, finish-operations e finish-units.
- Executar Operations com o scanner real; fechar os consumidores nativos; só então rodar sf-ci completo e empacotar o SHA integrado exato.

## Comandos e resultados

- Solicitação .ci-run.json: {"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/wp04/sourcing-controller.spec.ts"]}
- Branch efêmera ci-run-linux-finish-compilation-20261119; parent do snapshot = código acima.
- https://github.com/gustavomhss/Orchestra-SF/actions/runs/44561871689 — SUCCESS, 2 passed, typecheck sem diagnósticos.
