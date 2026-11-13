# Rodada 3 — rechecagem de evidência

**Veredicto: APPROVED_FOR_EXECUTION.** Mantida a aprovação focal para o candidato corrigido `9a1812f360fa245fa2fac9aacf4938ddf8f21381`, parent `10a99bf06c5578ec02dab590a680ab18766c7ff4`, root tree `39adba24caf2e217cf51ef40f68724fc2d7b6d67`.

Revisor: `/root/review_evidence`. Data: 2026-11-13. **Nenhum achado P0, P1 ou P2; nenhuma disposição pendente.**

## Escopo e conclusão

Rechequei o efeito do compilador de contexto corrigido sobre CI, evidências de rotas MCP, proveniência, C/D e autoridade de execução. O delta amplia as definições disponíveis para leitura; não transfere tarefas, permissões, leases ou a responsabilidade pelas provas. O parecer inicial continua intacto.

Na fonte canônica, somente `execution_workflow` mudou: alinhamento da topologia de eventos com o protocolo existente e correção do path do recibo de medição baseline. As seções `execution`, `ci_plan`, `evidence`, `proof_assignments`, `execution_proofs`, `review_assignments`, axiomas, WPs, contratos, ownership, cronograma, manifesto residente e handoffs são idênticas ao candidato inicial.

Portanto, permanecem as mesmas regras já aprovadas neste escopo: dispatcher único; dedupe completo; invalidadores; oito seleções CI e suites adicionais; AM01–AM06 no mesmo C; sf2-control separado; envelope D, retries e paths exatos; guias normativos antes do freeze; guard de C/G7 e guard de D/G8.

## Verificações proporcionais

| Verificação | Resultado |
| --- | --- |
| Atribuição remota de arquivos do escopo | 39 Git blobs calculados independentemente; zero divergências |
| Renderização documental | 100 artefatos; zero drift |
| Packs examinados | 23 |
| Referências de rotas conferidas nos packs | 645 referências, correspondentes às 39 operações canônicas |
| Skill/perfil/prova/evidência faltante ou alterada | Nenhum caso |
| Prova anterior removida do pack | Nenhuma |
| Mudança de atribuição ou autoridade | Nenhuma |
| Fonte e COMMON nos hashes de proveniência | Atuais em todos os 23 packs |

Após ler o delta do compilador sobre a versão já examinada, executei:

```text
python -B /workspace/scratch/b5296ae7597d/sf2h-corrected/tools/render_plan.py --check
exit_code: 0
artifacts: 100
drift: []
```

Para cada rota selecionada, comparei o objeto canônico e conferi a skill, o perfil e o proof_id nas coleções de provas de execução e residentes. Para cada prova, comparei o objeto integral e todos os pacotes de evidência referenciados. A expansão preserva seus critérios, status e responsáveis.

Nos 23 packs, `assignment`, `branch_provenance`, `write_authority`, alocação, slot, WPs, `proof_bindings`, `criterion_ids`, atribuição de review, fontes e regra de conclusão permanecem iguais ao inicial. Os objetos de prova também preservam seu `execution_actor`. A nova `reference_context_rule` torna explícito que contexto de contrato/rota/skill/prova não concede execução nem escrita.

Os seis consumidores de CI — S0, S0-C, S2 e os três reviewers — continuam com `ci_plan` integral e idêntico à fonte. Acrescentar pacotes de evidência ao contexto não acrescenta critérios atribuídos nem dá PASS a uma prova.

## Eventos, medição e proveniência

A lista de eventos da topologia agora coincide com o protocolo canônico, e sua chave é `execution_instance + event_id`. O protocolo existente e a chave completa de dedupe de requests de CI não mudam. Não se confunde dedupe de mensagem com identidade de execução ou prova.

Os 23 packs somam **9.516.800 bytes**, iguais ao total do manifesto. Os totais das cinco leituras de coordenadoras também coincidem com os tamanhos dos arquivos declarados. A medição está vinculada ao hash atual e declara bytes UTF-8; não promete redução de tokens, tempo ou implementação.

Li o recibo do guard do candidato corrigido: **78 regras, 205 paths, zero gates, zero errors, um WARN e exit code 0**, com working tree limpa. Não repeti o gate. Os hashes dos arquivos examinados, dos recibos e do parecer inicial estão no JSON desta rechecagem.

## Limites

Produto, testes, Actions e AM01–AM06 continuam **NOT_RUN** por este revisor. A rechecagem avalia o delta documental e não certifica execução futura, capacidade real ou meta de 120 minutos. Não li os outros rechecks atuais nem alterei o candidato. Este veredicto focal não substitui as rechecagens independentes de supervisor e contexto.

**Achados: nenhum.** O parecer inicial é preservado e a aprovação deste escopo passa a estar explicitamente vinculada a `9a1812f360fa245fa2fac9aacf4938ddf8f21381`.

