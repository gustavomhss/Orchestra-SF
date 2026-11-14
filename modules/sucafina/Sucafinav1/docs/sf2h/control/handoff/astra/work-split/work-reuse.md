# Custo de confirmação/reuso e attachment

Você é Astra em contexto novo, com missão delimitada. Branch já preparada: work-reuse. Repositório gustavomhss/Orchestra-SF. Input fixado da PR47: 79ebf5555eddaa4b5b8b57cbe1df7c5ad22b1244. Leia integralmente https://github.com/gustavomhss/Orchestra-SF/blob/79ebf5555eddaa4b5b8b57cbe1df7c5ad22b1244/modules/sucafina/Sucafinav1/docs/sf2h/receipts/ui-split/ui-work/README.md, seu validation.json, patches e findings antes de editar. Preserve todo o trabalho anterior e não repetir as três jornadas já aprovadas sem delta causal.

## Tarefa

Investigue o prazo de5000ms excedido depois de prepare-message e answer-confirm200 nos runs43621603578/43622153636 de UI Work. Consulte primeiro o terminal do run43623257640, já em voo no W6 de Colaboração dc21cd389de67c2e7fac996b663d9c0aa7d8cae5, e os deltas posteriores. Não disparar cópia desse run nem aumentar deadline. Localize o caminho caro/espera e diferencie fixture/observação, UI e produtor. Entregue patch mínimo proposto ao owner pertinente e contraprova de confirmação→retry→reuso→attachment com destinatário distinto, preservando answer-read, fences, ACL e o caso real. Nenhuma fonte compartilhada ou work-collaboration.ts pode ser editada por esta fatia; patches propostos ficam sob recibos. Se o W6 já resolver parte do problema, demonstre isso e não refaça a correção.

## Aceite

Causa apoiada em medições existentes ou diagnóstico novo discriminante; proposta aplicável e request cirúrgico preparados. Attachment não montado no componente não pode ser declarado 404 do produto nem PASS instalado.

## Escrita

Arquivos de produção próprios autorizados: nenhum; diagnóstico e patches propostos apenas.
Testes/fixtures novos exclusivos: modules/sucafina/Sucafinav1/test/product/work-split/work-reuse/.
Recibos/patches: modules/sucafina/Sucafinav1/docs/sf2h/receipts/work-split/work-reuse/.
Não escrever nos namespaces das outras duas fatias. Shared drivers/fixtures, host WP10, contratos e produtores Colaboração ficam readonly, salvo consumo verbatim explicitamente admitido na missão G03. Um patch proposto não altera a autoridade do owner.

## Regras

Leia AGENTS e COMMON. Fonte fixa https://github.com/gustavomhss/Orchestra-SF/tree/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan, SHA256 campaign.json703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba. Preserve os critérios WP01/WP02/C03/C06 relacionados; esta divisão não reduz o plano completo. Consulte heads atuais e registre as versões realmente consumidas. Não assumir ausência de produtor com base em recibo antigo.

Produto testado apenas em GitHub Actions, cirúrgico conforme https://github.com/gustavomhss/Orchestra-SF/blob/a3d29d011ba3607a57914701300f09117a3e2de9/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/CI.md. Sem teste local, epic ou duplicação de runs. Reanexe o que existe; novo diagnóstico requer hipótese e informação útil, sem aumentar deadlines/remover assertions/fences/revogações. Typecheck bun typecheck no package e guards conforme AGENTS. Se o patch exige edição de fonte alheia para provar, entregue request preparado e marque NOT_APPLIED/NOT_RUN até execução real do owner.

Operações remotas só GitHub MCP. Sem gh/git push, force push, reset/clean destrutivo, arquivos dirty sobrescritos, engines/Azure/deploy/identidade/políticas financeiras ou reinício de runtime. Não reativar workers nem enviar mensagens a terceiros. Não alterar branches/PRs anteriores ou sf2-stack.

Publique PR work-reuse → ui-work, com delta pequeno. Não mergear. Termine com head/tree, implementação ou patch, provas com W/S/run IDs, critérios afetados, dependências e próxima ação para S0/owner. Decisões rotineiras autônomas; não entregar apenas plano nem fingir prova instalada/nativa/global.
