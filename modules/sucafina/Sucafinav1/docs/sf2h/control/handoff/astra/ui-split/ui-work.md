# ui-work — G03/C03: Meu Trabalho e respostas

Você é Astra em uma sessão nova para uma única fatia de Orchestra SF. Execute implementação/consumo e provas, não outro plano. Repositório gustavomhss/Orchestra-SF. Base fixa desta fatia: 2ee71fc90055814912654ae198f7a1dcf9583943 (PR43/interface-resume). Sua branch própria já foi criada. Não modificar a origem ou outras branches.

Fonte normativa imutável: https://github.com/gustavomhss/Orchestra-SF/tree/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan . SHA256 campaign.json 703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba. Leia AGENTS, COMMON, as partes integrais de WP01/WP02 e os critérios vinculados aos findings; esta fatia não reduz os 153 critérios desses WPs ou os gates globais. Packs WP01/WP02 e CI.md em https://github.com/gustavomhss/Orchestra-SF/tree/a3d29d011ba3607a57914701300f09117a3e2de9/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra . Leia o handoff final da PR43 e findings completos: https://github.com/gustavomhss/Orchestra-SF/blob/2ee71fc90055814912654ae198f7a1dcf9583943/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP01/interface-resume/owner-findings.json .

Há quatro fatias paralelas. Um writer por path. Somente os arquivos enumerados na sua missão são editáveis; testes/fixtures/recibos novos ficam em seu namespace exclusivo. Shared components.ts, shell-state.ts, html.ts, http.ts, drivers e fixtures compartilhados ficam readonly. Use APIs reais existentes. Se precisar alterar esses arquivos ou host/contratos/produtores alheios, entregue patch proposto sob seus recibos e reprodução para compose-resume/WP10 ou collab-resume, sem aplicar na fonte alheia. Continue o trabalho independente. Não invente helpers/produção substituta só para satisfazer o teste. Consuma inputs publicados registrando heads/blobs e preserve os checks fortes anteriores.

Produto testado somente em GitHub Actions, cirúrgico conforme CI.md; sem testes locais, suite epic, relaxar assertions/deadlines ou repetir runs equivalentes. Typecheck bun typecheck do package e guards conforme AGENTS; diagnósticos externos não viram PASS. Registrar W/S e igualdade dos blobs pertinentes, seleção, run/job IDs e resultado real. Use somente GitHub MCP nas operações remotas, sem gh/git push/outro login.

Publique uma PR da sua branch contra interface-resume para delta pequeno e revisável. Não mergear nem fechar PRs. S0/composição consumirão os incrementos no candidato. Preserve todas as branches/recibos/arquivos dirty; sem force push, reset/clean destrutivo ou snapshot integral. Não alterar plano, engines, Azure/deploy/identidade/políticas financeiras, não reiniciar desktop/server e não spawnar outros agentes.

Tome decisões rotineiras autonomamente. Retorne PR/head/tree, paths, findings/criterion_ids afetados, comportamento obtido, checks/SHAs/run IDs, dependências e próxima ação. Pronto significa aceito no escopo executado; prova do componente não é GLOBAL_RELEASE. Se faltar porta externa, preserve a entrega e publique o finding reproduzível em vez de simular sucesso.

## Sua missão

Branch: **ui-work**.

Concluir consumidores UI de seleção do primeiro ciclo, respostas e reuso. Consumir fixes pinados do collab-resume, mapear conflito real sem resposta sintética e manter seleção/caso/período/fontes. ACK deve identificar a mutação exata mesmo com mensagens de autor/corpo iguais; não inventar confirmação quando o produtor não oferece identidade inequívoca. Provar retry/reload e perda de resposta sem duplicação. Não editar produtores de colaboração/C05 nem work-review-context.ts.

Findings: G03, C03-HOST, C03-REPLY-ACK, G03_FIRST_CYCLE_SELECTION.

Aceite: Jornadas reais de seleção/conflito, resposta/reuso, retry após perda de resposta e reautorização com destinatário distinto, confirmação exata e zero duplicação.

Write paths exclusivos:
- modules/sucafina/Sucafinav1/product/ui/case-work-selection.ts
- modules/sucafina/Sucafinav1/product/ui/work-collaboration.ts
- modules/sucafina/Sucafinav1/test/product/ui-split/ui-work/
- modules/sucafina/Sucafinav1/docs/sf2h/receipts/ui-split/ui-work/

Qualquer patch para owner externo deve ficar em modules/sucafina/Sucafinav1/docs/sf2h/receipts/ui-split/ui-work/patches/, claramente NOT_APPLIED até integração real. Não roubar ownership para declarar gate verde. Não rerodar testes verdes de ACK/Escape/revogação sem mudança que os afete. Entregue um incremento delimitado e termine com handoff explícito.
