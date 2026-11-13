# Rodada 3 — revisão independente de evidência

**Veredicto: APPROVED_FOR_EXECUTION, no escopo focal de evidência do delta de planejamento.**

Candidato: `10a99bf06c5578ec02dab590a680ab18766c7ff4`. Parent: `0aa2405bb3668314f60d6a674d2bd53fd5003091`. Root tree: `98e05ed55a5e69177ee5f21621c916d4685191cb`.

Revisor: `/root/review_evidence`. Data: 2026-11-13. Sem autoria no delta, sem edição do candidato e sem leitura das conclusões dos demais revisores atuais.

## Resultado e escopo

Não identifiquei achado P0, P1 ou P2. **Não há disposição P2 pendente.** A revisão acompanhou o fluxo de evidência desde a solicitação de validação, seleção e identidade do run até a aceitação de C e a entrega evidencial D. Conferi a fonte canônica, suas projeções, os prompts, as atribuições de CI e as tarefas afetadas do WP10.

Esta aprovação é documental. Produto, Actions, AM01–AM06 e execução do workflow continuam **NOT_RUN** por este revisor. Não certifica a meta de 120 minutos e não inicia a implementação. A aprovação focal também não substitui os pareceres de supervisor e contexto.

## Identidade e verificações executadas

O snapshot não contém `.git`. Consultei os metadados oficiais obtidos pela supervisora em `candidate-mcp.json` e calculei independentemente o Git blob SHA-1 de **26 arquivos do escopo**, sem divergência com o mapa remoto do candidato. O relatório JSON guarda os SHA-256 de todos esses arquivos, do adendo de reconciliação e dos insumos de atribuição.

Após ler `tools/render_plan.py` e `tools/render_fast_context.py`, executei apenas:

```text
python -B /workspace/scratch/b5296ae7597d/sf2h-resume/tools/render_plan.py --check
exit_code: 0
mode: check
artifacts: 100
drift: []
```

Fiz também comparações JSON independentes. Os espelhos de workflow, CI, evidência e WP10 coincidem com a fonte. Dedupe, invalidadores, validação incremental e revisão coincidem entre workflow e receitas CI. O envelope de entrega coincide com `campaign.execution.candidate_delivery`; COMMON contém integralmente `campaign.execution`; os corpos S0–S4 correspondem aos prompts canônicos; S0, S0-C, S2 e os três reviewers recebem o `ci_plan` completo.

| Preservação conferida | Resultado |
| --- | --- |
| WPs / tasks / contratos | 15 / 74 / 17 |
| IDs de critérios | Os mesmos 1.610 |
| Escopo, contratos e atribuições de provas | Sem alteração em relação ao parent |
| Receitas mínimas de CI | As mesmas oito, integralmente |
| Regra de suites adicionais | Preservada e obrigatória |
| Provas integradas | AM01–AM06, sem perda de conteúdo |
| Rotas AM02 | 39 |
| Estados no proof-map | Todos NOT_RUN |

Li o recibo do guard executado pela supervisora sobre o SHA exato: 78 regras, 190 paths alterados, exit code 0, zero gates, zero errors e um WARN. Não o reexecutei. Trata-se do guard do candidato de planejamento; não representa execução de produto.

## Fundamentos da aprovação

### Dispatcher, dedupe e transferência

`execution-workflow.validation.supervision`, `validation.deduplication`, `ci-recipes.dispatch_policy` e WP10.T04 convergem: existe um lease de dispatcher por vez. Os handoffs S0-C → S2 → S0-C transferem candidato, fila, request keys, run IDs, attempts, conclusões e ETA. Workers solicitam validação sem criar cópias da mesma execução.

A chave inclui SHA/árvore de produto, request normalizada, fonte do workflow/validator, runtime/configuração e fixtures/seleção. Reuso em voo exige identidade completa; reuso concluído exige seleção observada correta, controle omni, artefatos íntegros e ausência de invalidadores. Falha, cancelamento, seleção vazia, artefato faltante e dependência desconhecida não viram PASS. As fronteiras de ownership mantêm os destinos próprios de CI de S0-C e S2.

### Cobertura final e invalidadores

As oito receitas continuam sendo CI-SF, CI-CLI, CI-APP-SRC, CI-APP-BROWSER, CI-ATLAS-BUSINESS, CI-UI-OPERATIONS, CI-UI-DECISIONS e CI-UI-REPORTS. A regra de suites adicionais permanece obrigatória. `validation.final_acceptance`, os receipt_rules, G7 e WP10.T04 exigem todas as seleções finais e AM01–AM06 no mesmo C.

O streaming de AM02 é aditivo. Preserva as 39 rotas, a paridade por operação, o binding real, SkillLoadReceipt, autorização e consumidor. AM01 ainda exige cinco perfis, dezoito skills, fonte carregada e contribuição específica de cada skill, além do run independente do Revisor. A exceção de harness determinístico já existia no baseline e não dispensa AM01.

A matriz de invalidadores inclui contratos e consumidores transitivos; finanças; identidade, ACL, revogação e incarnation; perfis e skills; Atlas; UI; fixtures, oráculos e testes; runtime, compilador e workflow; e modelo, scanner ou política externa. A seleção incremental pode ser afetada ou conservadora, mas não revoga o conjunto final obrigatório de C.

### Produto C, entrega D e proveniência

O envelope está presente na fonte, workflow, COMMON, evidência, proof-map e WP10. C inclui código, testes, fixtures, configuração, manifests, skills/prompts, assets e conteúdo normativo. D apenas acrescenta evidência admitida; não recebe o SHA de execução de C.

D exige ancestralidade e diff Git completo sem truncamento, com status, path, tipo, modo e blob. Arquivos anteriores de C precisam permanecer intactos. As adições são restritas a recibos UTF-8 com extensões e modo definidos nos prefixes receipts enumerados ou nos paths control exatos alocados. Symlink, submodule, executável, traversal, extensão indevida e novos inputs de import/glob/build/test/runtime são recusados. Dependência desconhecida não é aceita como evidência inerte.

`sf2-control` guarda estado operacional separado, nunca serve de base CI e nunca é mergeada em C/D. S0 incorpora blobs evidenciais por source commit/path/blob hash, preservando a origem. O índice de D aponta C e as execuções originais. Seu próprio SHA/hash e um resultado de guard posterior ficam fora do receipt interno; o fechamento externo informa D e o guard.

### Retries e documentos antes do freeze

Cada tentativa de entrega recebe path completo novo, instância, inteiro positivo e parent esperado. A lista é finita e registrada em sf2-control antes de D, por SHA de alocação. O template não concede todo o prefixo control. D2 pode manter apenas adições de D1 que satisfaçam o envelope completo, sem editar receipts anteriores. Outro índice não cura alteração de produto ou arquivo proibido.

WP10.T01 produz guia por papel, roteiro e changelog no README de C. Há reserva S0 de 55–60 e ajustes de 60–75; T05 consome esse conteúdo e prepara evidência. Um ajuste normativo posterior cria novo C. Skills e prompts em Markdown não se tornam evidência descartável.

O guard de C pertence a T04/G7; T05/S0 executa o guard de D para G8 depois da conferência do envelope. G8 permanece bloqueado quando falta qualquer condição.

## Casos de borda examinados

| Caso | Regra que evita aceitação indevida |
| --- | --- |
| Solicitação repetida atravessa handoff do dispatcher | Chave completa e adoção do mesmo run/attempt; fila e proveniência transferidas |
| Correção de UI ou guia depois de green anterior | Novo C, identidade antiga preservada e cobertura final integral de C |
| Revogação/modelo/scanner muda sem mudar código | Invalidação de prova live; cache de código não certifica estado externo |
| D2 preserva D1 e publica nova tentativa | Path novo e diff completo C→D2, mantendo bytes anteriores |
| D1 contém produto ou input de build/test/runtime | O envelope continua recusado; novo receipt não sana o diff |
| Receipt tenta conter o próprio D/guard posterior | Fechamento externo, sem autorreferência e sem commit circular |

## Achados e limites

**Achados: nenhum. P0 = 0, P1 = 0, P2 = 0.**

Não auditei novamente o produto inalterado nem executei testes, Actions, deploy ou integrações. Não inferi capacidade de vinte slots ou oito runners. A execução futura precisa observar capacidade, latências e autoridades reais, além de verificar C e D concretos. O planejamento continua com critérios integrais, todos os estados de produto honestos e nenhuma autorização ampliada por esta revisão.

Os hashes completos, localizações por arquivo/campo, checks e disposições dos casos estão em `evidence-initial.json`.

