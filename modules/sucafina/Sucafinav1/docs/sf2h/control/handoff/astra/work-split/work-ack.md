# ACK inequívoco de reply do destinatário

Você é Astra em contexto novo, com missão delimitada. Branch já preparada: work-ack. Repositório gustavomhss/Orchestra-SF. Input fixado da PR47: 79ebf5555eddaa4b5b8b57cbe1df7c5ad22b1244. Leia integralmente https://github.com/gustavomhss/Orchestra-SF/blob/79ebf5555eddaa4b5b8b57cbe1df7c5ad22b1244/modules/sucafina/Sucafinav1/docs/sf2h/receipts/ui-split/ui-work/README.md, seu validation.json, patches e findings antes de editar. Preserve todo o trabalho anterior e não repetir as três jornadas já aprovadas sem delta causal.

## Tarefa

Feche a distinção entre snapshot transacional de reply e projeção corrente RecipientThread.current. Leia o patch proposto c03-recipient-receipt.NOT_APPLIED.patch de UI Work e a versão atual de Colaboração antes de mudar código. Consuma um recibo durável realmente publicado, com identidade exata da mutação, corpo/chave da intenção e mensagem/incarnation/versão; não inferir sucesso por autor/texto/posição nem por boolean legado. Se o produtor ainda não oferecer o recibo, aperfeiçoe e publique um patch preciso ao owner Colaboração, com preimage e request de validação; preserve a UI inconclusiva/fail-closed. Não editar o produtor ativo. Acrescente contraprovas de mensagens idênticas, resposta perdida, retry/reload e revogação.

## Aceite

ACK do destinatário identifica a mutação exata e há um único append, ou dependência externa fica reproduzida e acompanhada por patch aplicável. Não chamar patch não aplicado de fluxo concluído.

## Escrita

Arquivos de produção próprios autorizados: `modules/sucafina/Sucafinav1/product/ui/work-collaboration.ts`.
Testes/fixtures novos exclusivos: modules/sucafina/Sucafinav1/test/product/work-split/work-ack/.
Recibos/patches: modules/sucafina/Sucafinav1/docs/sf2h/receipts/work-split/work-ack/.
Não escrever nos namespaces das outras duas fatias. Shared drivers/fixtures, host WP10, contratos e produtores Colaboração ficam readonly, salvo consumo verbatim explicitamente admitido na missão G03. Um patch proposto não altera a autoridade do owner.

## Regras

Leia AGENTS e COMMON. Fonte fixa https://github.com/gustavomhss/Orchestra-SF/tree/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan, SHA256 campaign.json703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba. Preserve os critérios WP01/WP02/C03/C06 relacionados; esta divisão não reduz o plano completo. Consulte heads atuais e registre as versões realmente consumidas. Não assumir ausência de produtor com base em recibo antigo.

Produto testado apenas em GitHub Actions, cirúrgico conforme https://github.com/gustavomhss/Orchestra-SF/blob/a3d29d011ba3607a57914701300f09117a3e2de9/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/CI.md. Sem teste local, epic ou duplicação de runs. Reanexe o que existe; novo diagnóstico requer hipótese e informação útil, sem aumentar deadlines/remover assertions/fences/revogações. Typecheck bun typecheck no package e guards conforme AGENTS. Se o patch exige edição de fonte alheia para provar, entregue request preparado e marque NOT_APPLIED/NOT_RUN até execução real do owner.

Operações remotas só GitHub MCP. Sem gh/git push, force push, reset/clean destrutivo, arquivos dirty sobrescritos, engines/Azure/deploy/identidade/políticas financeiras ou reinício de runtime. Não reativar workers nem enviar mensagens a terceiros. Não alterar branches/PRs anteriores ou sf2-stack.

Publique PR work-ack → ui-work, com delta pequeno. Não mergear. Termine com head/tree, implementação ou patch, provas com W/S/run IDs, critérios afetados, dependências e próxima ação para S0/owner. Decisões rotineiras autônomas; não entregar apenas plano nem fingir prova instalada/nativa/global.
