# W8c — revisão normativa do prazo de aquisição do browser

## Conclusão e escopo

Não foi encontrada uma obrigação que fixe a inicialização do Chromium em 10 segundos. O número é o limite escolhido pela fixture WP01 e o limiar de um alerta do guard, não um teto de aceitação presente no plano imutável. A revisão é documental e estática: nenhum teste, typecheck, guard, polling ou alteração de produto foi executado para esta conclusão.

Alinhar a aquisição compartilhada ao prazo de 15 segundos já publicado no driver independente, conservando cancelamento, cleanup aguardado, todos os asserts e a mesma folga de 5 segundos no teste nomeado, exige nova validação Actions. Essa decisão não autoriza alterar deadlines de comportamento dos consumidores, o envelope de 120000 ms, remover assertions, introduzir warmup/retry/skip ou declarar corrigida uma causa ainda não estabelecida.

## Fontes normativas lidas

| Fonte exata | Texto pertinente e interpretação |
|---|---|
| Handoff `a3d29d011ba3607a57914701300f09117a3e2de9`, `modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/CI.md`, protocolo itens 3 e 7 | Manda usar os validadores reais, seleções explícitas, registrar W/S e revalidar mudança material. Não define prazo de startup. |
| Mesmo CI.md, Typecheck e guards | `Corrija findings sem inventar aprovação Maestro.` A justificativa de prazo deve permanecer visível; não se alega aprovação nem se omite o alerta. |
| `AGENTS.md` no produto W8 `770ca62aa97f66deb70126a32d9819ddf7f32833`, blob `643ec9f8f960895b2e3294f7f2cc25db6f8488e4`, seção Guardrail | Exige `bun run check:guards --base origin/dev`, corrigir findings e seguir `guardrail-usage`. Não estipula 10 s para startup. Não há AGENTS mais específico nos diretórios ancestrais de `modules/sucafina/Sucafinav1/test/product/wp01` ou `wp02` nesse pin. |
| Mesmo W8, `script/guards/rules/test-timeout-raised.toml` | `severity = "warn"`, `on = "added-lines"`. Mensagem literal: `Test timeout raised to 10s or more. Find out why it is slow instead of waiting longer.` O comentário diz que 10 segundos é o sinal de lentidão; não estabelece teto de browser. |
| `.orchestra/skills/guardrail-usage/SKILL.md`, seção Read the output | `GATE fails the pull request. WARN is advice and never blocks.` Também manda seguir a explicação e corrigir o finding primeiro. Nenhuma aprovação/ignore foi aplicado por esta revisão. |
| Plano fixo `dbf9547211d9b0fade619790de7c19c0869b7c7d`, `campaign.json`, `axiom-index.json`, packs completos WP01/WP02 | WP01.T03.CMP.01 pede: `Cobrir sucesso, validação, perda de conexão, timeout, conflito, read-only e navegação com edição pendente.` É um critério de comportamento do consumidor, sem um prazo numérico de startup de testes. |
| Mesmo plano, `campaign.json` / entrada CI-ATLAS-BUSINESS | Os args `--timeout 30000` e a frase `Timeout por teste reproduz script test existente` referem-se à suíte Atlas. Não impõem 10 s para Chromium nem autorizam mudar outro gate global. |
| Mesmo plano, `campaign.json` / `ci_budget` | O timeout de 45 minutos é limite do job, não previsão. Exige medir fila/setup/run/coleta; não é limite de aquisição de browser. |

O SHA256 do `campaign.json` permanece `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. As buscas nos packs e anexos pertinentes não encontraram outra obrigação de startup em 10 s; as menções de timeout restantes tratam comportamento de UI, scanner e CI/global.

## Evidência observada que motivou a decisão

No run W8c `43585747922`, job `132419730244`, produto `770ca62aa97f66deb70126a32d9819ddf7f32833`, o driver Node PID 4096 já tinha um Chrome filho PID 4111. Entre 1 e 7 segundos e novamente aos 9.010 ms, os snapshots registram `D (disk sleep)` e `folio_wait_bit_common`; aos 8.009 ms registram `futex_do_wait`. A primeira mensagem `Browser.getVersion` foi enviada e nenhuma resposta chegou antes da aquisição cancelar em aproximadamente 10 s. Logo, há evidência nova de espera no filho/protocolo; já não se trata somente de stderr vazio sem identificação do processo.

O lançamento independente posterior no mesmo job, Node 4193/Chrome 4209, ficou pronto aos 337 ms e provou cleanup completo. Isso não prova que a primeira espera tenha uma causa única, que cache seja a causa, que a ampliação para 15 s resolva ou que o startup antigo esteja aprovado. O registro permite uma decisão explícita sobre um orçamento limitado de infraestrutura; o resultado de W9 continua pendente de Actions.

As instruções anteriores de manter 10 s eram uma decisão de implementação da sessão enquanto faltava diagnóstico, não um número imposto pelo usuário original ou pela fonte imutável. O parent reviu essa decisão depois de observar o novo diagnóstico. A presente revisão preserva a distinção entre essa decisão autorizada e a futura prova funcional.
