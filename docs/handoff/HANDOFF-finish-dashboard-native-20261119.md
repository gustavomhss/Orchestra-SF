# Handoff — finish-dashboard-native-20261119

SHA: cc7c582b5fd5b4ad5b7fe843b6a816a5f83a6697 (código; este documento é o commit seguinte)
Data: 2026-11-19
Estado: partial

## Feito
- WP2 / CAP04–CAP05 — packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/surface.tsx:478 — preserva o fence por geração e transporte de 4d778b8. Depois do POST original confirmado, a releitura original identifica exatamente o owner/entry persistido, os valores enviados e o CAS numérico avançado. Só então confirma a projeção no contrato F03 existente; a intenção de criação limpa pode ser descartada pelo registro original, permitindo a próxima linha.
- Nenhuma alteração no registro global F03, revalidação F01, schema, retry ou application.ts. Ausência/ambiguidade da projeção mantém confirmed-without-projection; resultado desconhecido continua protegido.
- WP2 / records-signals-history.spec.ts:101 — mantém seleção de um registro, exclusão do unrelated e igualdade de todos os fatos/identidades. Valida observedAt como ISO e dentro da janela do POST de preservação, além de não anterior à prévia.
- Contrato conferido: modules/sucafina/Sucafinav1/product/reviews/port.ts:107 executa this.preview na preservação; apps/cli/src/sucafina-product/dashboard-services.ts:66–76 chama novamente agenda(selected, context). A preservação faz uma observação nova; não copia o relógio da prévia.

## Pendente
- Gate WP2 — packages/app-shell/e2e/sucafina/dashboard-installed/confirmation-access.spec.ts:38 e records-signals-history.spec.ts:12 — executar os dois specs no próximo snapshot composto da raiz. Este commit não foi qualificado por teste.
- records-signals-history.spec.ts:204 — abertura histórica nativa após preservar ainda não alcançada no run anterior; conferir eventual indisponibilidade original UI48 junto ao diagnóstico Reports da raiz.
- C12, BI e WP4 seguem em branches/checkpoints próprios; este branch não inclui seus deltas.

## Decisões e justificativas
- Asserções removidas: nenhuma asserção de valores, CAS, conflitos, exclusão, persistência, recarga ou autoridade foi removida. A igualdade do observedAt da prévia foi substituída por prova temporal do evento atual, porque o produtor seleciona novamente antes de gravar. Todos os demais campos da projeção continuam comparados.
- A causa observada de confirmation-access não era autorização revogada: run 44608420232 gravou a primeira linha (POST200, CAP04 readback200) e abriu a segunda intenção reutilizando o draft não ativo confirmado. O novo código não trata operações desconhecidas como confirmação.
- Sem aumento de timeout, skip, console legado, novo helper genérico ou projeção fabricada.
- Este branch parte de sf-join-four bd45b3135c2a0cfc0a3cc2f5bdc6ed7373caebb5 e contém os dois blobs Dashboard do assembly26 mais os deltas acima, para composição cirúrgica.

## Como retomar
1. Partir do código cc7c582b5fd5b4ad5b7fe843b6a816a5f83a6697; a raiz compõe apenas surface.tsx e records-signals-history.spec.ts com os demais deltas autorizados.
2. Criar ci-run-linux-dashboard7-20261119 no snapshot composto e .ci-run.json com package app, runner playwright, config e2e/playwright.production.config.ts, args dos dois specs dashboard-installed.
3. Ler o resultado real e atualizar este handoff com run id, SHA e unbound remanescente. Não executar sf-ci aqui e não declarar GO.

## Comandos e resultados
- Dashboard6: https://github.com/gustavomhss/Orchestra-SF/actions/runs/44608420232 — FAILURE, 2 testes falharam; tipos passaram; snapshot b47619abb5ba45f3d8e6eed25f8c787f24798344; job135858204134. As falhas e os fatos originais orientaram este delta.
- Auditoria de evidência original: https://github.com/gustavomhss/Orchestra-SF/actions/runs/44612788838 — SUCCESS apenas extração de JSON/DOM, não aprovação UI. Branch audit-dashboard6-bi4-20261119, docs/handoff/observed-dashboard6-bi4-20261119.md.
- bun typecheck (app-shell) neste commit: não rodado; somente GitHub Actions autorizado.
- bun run check:guards --base origin/dev neste commit: não rodado; gate final é da raiz.
- bun run test:ci neste commit: não rodado; aguardando composição e gate estreito da raiz.
