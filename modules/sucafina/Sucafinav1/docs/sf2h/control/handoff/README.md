# Orchestra SF — handoff de continuidade

**Estado: PAUSADO POR SOLICITAÇÃO DO USUÁRIO. Produto incompleto.**

Não iniciar implementação, testes, provedores ou workers sem nova instrução explícita. A Goal nativa está pausada; não criar outra Goal, supervisor ou watchdog.

## Onde estamos

- Campanha: `sf2h-integral-20261112`; thread S0: `01a1d309-ba0e-7490-b044-0899d9fa008f`.
- T0 preservado: `2026-11-13T04:01:10Z`. A meta de 120 minutos foi excedida; isso não altera o escopo.
- Plano fixo: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; baseline: `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`.
- SHA-256 de campaign.json: `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`.
- Escopo intacto: **15 WPs, 74 tasks, 17 contratos, 1.610 critérios**.
- **0 WPs qualificados; C e D não existem; GLOBAL_RELEASE não demonstrado.** Há implementação parcial substancial, não medida como porcentagem.
- Os commits abaixo são checkpoints de continuidade, não PRs completas nem produto aprovado.
- As 15 coordenadoras estavam idle após a parada; os handoffs registram helpers terminais/interrompidos e leases revogados.

## Fonte aprovada

[START.md](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/START.md) · [missão S0](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/prompts/S0.md) · [WORKFLOW](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/WORKFLOW.md).

Na retomada leia AGENTS, COMMON, seu pack completo e anexos se for contexto novo; para uma sessão existente, use este handoff e o delta sem repetir toda a descoberta.

## Checkpoints publicados por WP

Todos os heads e trees foram consultados independentemente pelo S0 via GitHub MCP. [Verificação remota](remote-verification.json) · [manifesto completo](manifest.json).

| WP | Branch no GitHub | Commit remoto | Árvore inteira igual à local? | Handoff |
|---|---|---|---|---|
| WP00 | [sf2-compose](https://github.com/gustavomhss/Orchestra-SF/tree/sf2-compose) | [22756b300939](https://github.com/gustavomhss/Orchestra-SF/commit/22756b300939c50ca93403b48c6244dd7c179977) | não; snapshot de paths próprios | [WP00](WP00.json) |
| WP01 | [sf2-ui-ready](https://github.com/gustavomhss/Orchestra-SF/tree/sf2-ui-ready) | [4e50065f814e](https://github.com/gustavomhss/Orchestra-SF/commit/4e50065f814e33ec3b35cc8d178aba2601631e1a) | não; snapshot de paths próprios | [WP01](WP01.json) |
| WP02 | [sf2-dashboard-ready](https://github.com/gustavomhss/Orchestra-SF/tree/sf2-dashboard-ready) | [00f321006299](https://github.com/gustavomhss/Orchestra-SF/commit/00f321006299e229e7c4931724897a7209caa4ba) | sim | [WP02](WP02.json) |
| WP03 | [sf2-planner-ready](https://github.com/gustavomhss/Orchestra-SF/tree/sf2-planner-ready) | [e238f3d188d0](https://github.com/gustavomhss/Orchestra-SF/commit/e238f3d188d057d3cf571af5758a243e7e972344) | sim | [WP03](WP03.json) |
| WP04 | [sf2-procurement-ready](https://github.com/gustavomhss/Orchestra-SF/tree/sf2-procurement-ready) | [52206d08df62](https://github.com/gustavomhss/Orchestra-SF/commit/52206d08df62cbbb68c124177934293b0a81dd36) | não; snapshot de paths próprios | [WP04](WP04.json) |
| WP05 | [sf2-bi-ready](https://github.com/gustavomhss/Orchestra-SF/tree/sf2-bi-ready) | [d28380049072](https://github.com/gustavomhss/Orchestra-SF/commit/d2838004907291d5243a21ea6a7093e36fc5a30a) | sim | [WP05](WP05.json) |
| WP06 | [sf2-import-ready](https://github.com/gustavomhss/Orchestra-SF/tree/sf2-import-ready) | [faf67c434f2b](https://github.com/gustavomhss/Orchestra-SF/commit/faf67c434f2bab4ec9640068c60a676bca73c627) | não; snapshot de paths próprios | [WP06](WP06.json) |
| WP07 | [sf2-reports-ready](https://github.com/gustavomhss/Orchestra-SF/tree/sf2-reports-ready) | [4d7922ff9f8e](https://github.com/gustavomhss/Orchestra-SF/commit/4d7922ff9f8e3735d6853075a51e3c5a76466a28) | sim | [WP07](WP07.json) |
| WP08 | [sf2-collab-ready](https://github.com/gustavomhss/Orchestra-SF/tree/sf2-collab-ready) | [13285296acd0](https://github.com/gustavomhss/Orchestra-SF/commit/13285296acd05f777e31fc7867da1e3055e1e4af) | sim | [WP08](WP08.json) |
| WP09 | [sf2-relay-ready](https://github.com/gustavomhss/Orchestra-SF/tree/sf2-relay-ready) | [b58601f92f3b](https://github.com/gustavomhss/Orchestra-SF/commit/b58601f92f3bc8742e5a7c72a34d5ddf1fd87fe8) | não; snapshot de paths próprios | [WP09](WP09.json) |
| WP10 | [sf2-host-ready](https://github.com/gustavomhss/Orchestra-SF/tree/sf2-host-ready) | [dc6bf9e4e8f3](https://github.com/gustavomhss/Orchestra-SF/commit/dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f) | sim | [WP10](WP10.json) |
| WP11 | [sf2-decisions-ready](https://github.com/gustavomhss/Orchestra-SF/tree/sf2-decisions-ready) | [ba2822bb06a8](https://github.com/gustavomhss/Orchestra-SF/commit/ba2822bb06a8ad741ecbcf0d47654d1a86a3a95b) | não; snapshot de paths próprios | [WP11](WP11.json) |
| WP12 | [sf2-ai-ready](https://github.com/gustavomhss/Orchestra-SF/tree/sf2-ai-ready) | [574841e2409a](https://github.com/gustavomhss/Orchestra-SF/commit/574841e2409a9523000c4c1976c81804c9a86fde) | não; snapshot de paths próprios | [WP12](WP12.json) |
| WP13 | [sf2-portfolio-ready](https://github.com/gustavomhss/Orchestra-SF/tree/sf2-portfolio-ready) | [27375325788f](https://github.com/gustavomhss/Orchestra-SF/commit/27375325788fa571d39137728ec7f0666e89f22c) | não; snapshot de paths próprios | [WP13](WP13.json) |
| WP14 | [sf2-memory-ready](https://github.com/gustavomhss/Orchestra-SF/tree/sf2-memory-ready) | [02ac8172c17a](https://github.com/gustavomhss/Orchestra-SF/commit/02ac8172c17ad57e830bfb23d3ff1d1b1191852b) | não; snapshot de paths próprios | [WP14](WP14.json) |

**Os SHAs locais não foram publicados como os mesmos objetos Git.** As APIs MCP criaram commits de snapshot com outros SHAs. Seis trees completas coincidem; nove snapshots preservam os paths próprios sobre outra base e registram a verificação dos blobs pelos autores. O histórico local continua no checkout original. Não confundir esse mapeamento com push do histórico, merge aceito ou green de CI.

## Arquivos locais e dependências

- Worktrees e heads locais: [primary-worktrees.json](primary-worktrees.json). Não limpar/resetar os worktrees.
- Treze worktrees de WP estão limpos. WP08 conserva 11 cópias readonly; WP10 conserva 128 arquivos readonly/unknown. Esses arquivos não foram misturados ao commit de produto.
- Os **139 arquivos** foram preservados byte a byte em `input-blobs/`, como `.txt` inertes e deduplicados por Git blob SHA. [Manifesto de origem e SHA-256](input-archive-manifest.json).
- Para recuperar um input, conferir hashes, revisar proveniência/ownership e copiar o blob arquivado para o path de origem apenas no worktree correto. Não importar/executar a pasta de arquivo como produto.
- Não copiar indiscriminadamente esses inputs para um candidato: versões antigas ou desconhecidas exigem reconciliação com os produtores.
- O checkout original do usuário permanece separado; bases de Azure/deploy não devem ser incorporadas por conveniência.

## O que falta e bloqueios reais

Os handoffs de cada WP contêm tarefas parciais, comportamentos já produzidos, consumidores ausentes, dependências por SHA, findings, validações e a próxima ação. Pontos transversais conhecidos:

- Integração runtime/UI e consumidores reais das 18 skills, persistência/reload e encerramento dos fluxos completos.
- C07/Relay governado: não foi demonstrada uma rota pública suportada para admissão/índice/resultado imutável e vínculo SF autorizado. Schedule possui ocorrências/claims; não alegar ausência dessas capacidades nativas. Não modificar Maestro/Relay/Schedule nem usar API privada para contornar o escopo. Ver [relato da fronteira](operational/validation/external-c07-capability.json).
- Grok indisponível por HTTP 402 `Grok Build usage balance exhausted`. O usuário declarou indisponibilidade nesta semana. **Nenhuma nova tentativa**, conta alternativa, bypass ou nova sessão para contornar quota.
- A escrita direta do Grok foi de fato verificada com `--no-plan --permission-mode acceptEdits --allow Write(escopo)`. O diagnóstico anterior de incapacidade de escrita era uma configuração indevida do supervisor; não repetir esse erro. [Recibo](operational/capabilities/grok-write-capability.json).
- Censo de tasks: apenas 2 inteiras informadas, várias parciais e dois WPs sem contagem fechada. Isso não mede porcentagem de produto. A extrapolação de ETA de 36h não foi validada e não deve ser tratada como compromisso.

## Validação e epic preparado

- Os heads de parada não têm qualificação final de produto. Consultar cada handoff para execuções históricas; nunca reetiquetar green de outro SHA como prova atual.
- Epic proposto, **não publicado/ativado/disparado**: [sf2-epic.yml](prepared-final-bundle/sf2-epic.yml). [Manifesto](prepared-final-bundle/manifest.json), [revisão](prepared-final-bundle/root-review.json), [deduplicação](prepared-final-bundle/dedup-audit.json).
- O artefato teve revisão/correções e verificações estáticas (actionlint, shell/Node/jq). Isso não prova execução das suítes. Revalidar fontes/digests antes de incorporar à configuração normativa de C.
- Os três specs produção Operations/Decisions/Reports estavam ausentes no antigo stack; WP10 recebeu o lease e15. Conferir o estado real entregue no handoff WP10, sem presumir que eles estejam completos.
- Permanecem necessários no C aceito: oito seleções finais, suites adicionais do epic, AM01–AM06, três revisões independentes e correções, gates estáticos/geração/typechecks e C/G7. D só pode arquivar evidência admitida preservando C, com D/G8 separado.
- Snapshot integrado anterior: branch `sf2-stack`, remoto `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0`; local `46fcf031b4f420ccf3f46cdc6ab107c9b6c3f46d`; tree `acf3b722ad55c090bef8e9dc2b3fac2d9ad570af`. É draft parcial antigo, não C.

## Como retomar sem duplicar trabalho

1. Receber nova instrução explícita e retomar a **mesma thread/Goal**. O controle da Goal é nativo; não executar `/goal` no shell, criar Goal nova ou instalar watchdog.
2. Ler este índice, `STOP-STATE.json`, `manifest.json`, o handoff do WP e os critérios completos do plano fixado. Conferir refs remotas via GitHub MCP e heads/dirty locais antes de editar.
3. Confirmar estado real das sessões/jobs registrados. Todos os leases anteriores estão revogados; admitir uma nova época de escrita antes de reutilizar um worker. Ausência de resposta não prova morte; não duplicar um writer vivo.
4. Reutilizar sessões existentes e enviar delta compacto. Na API collaboration, `followup_task` acorda um agente completed; `send_message` não. Threads nativas têm seu próprio follow-up.
5. Tasks inteiras para os implementadores disponíveis; todos podem implementar. Terra implementa, consolida, é único escritor do índice Git e executa os testes cirúrgicos hospedados no final do WP. Helpers não executam testes.
6. Somente operações remotas por GitHub MCP. Nada de gh/git push/force push ou merge em dev. Manter `sf2-control` separado do produto/CI.
7. Receber PRs completas para bundle; root confere contra os WPs e devolve erros aos autores. Não exigir provas globais finais antes de construir o bundle que as executa; READY_FOR_BUNDLE não é DONE/GLOBAL_RELEASE.
8. Depois de integrar o candidato, executar a validação integral e o predicado original. Só então declarar entrega.

## Sessões, reviews e operação

- [Estado observado das sessões](native-session-stop-state.json); [revisão preliminar R2](S2-R2.json). Revisões preliminares não substituem três aprovações finais em C.
- Alocação das 74 tasks e regras atuais estão em `operational/teams/`; receipts de transferências em `operational/leases/`. São histórico operacional, não permissão para religar writers automaticamente.
- O hook de continuidade foi preparado e não foi comprovado como ativo/trusted. Nenhum novo supervisor/watchdog foi instalado. O checkpoint PAUSED faz o gate respeitar a parada.
- [Skill de gestão portátil](workflow-skill/SKILL.md); no Mac também existe em `/Users/gustavoschneiter/.codex/skills/run-efficient-agent-campaign/`. Não é skill residente de produto.

Este handoff registra uma parada segura e trabalho incompleto. A aprovação do planejamento e os snapshots publicados não equivalem a produto entregue.
