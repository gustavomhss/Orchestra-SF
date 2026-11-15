# Missão53 — matriz dos efeitos e requisitos

Os estados abaixo qualificam somente a evidência indicada. Nenhum critério completo do plano é declarado encerrado por uma contribuição parcial PR-only. Os 15WPs,74tarefas,17contratos e1610critérios permanecem no pin original.

| Efeito ou requisito | Antes → depois | Autoridade e identidade | Entrega/prova | Estado |
| --- | --- | --- | --- | --- |
| Review/prepare determinístico | Estado do domínio idêntico | Request UI vivo, principal, scope, encarnação, versão, digests | Core; snapshots completos e contagem de writes iguais | PASS de origem |
| Escolha C08 e cenário | Escolha/resultado persistidos; PR permanece100 | Caso/choice/operação e sources exatos; provider C08 real | Teste usa escolha sintética construída pelo helper canônico e gravada no provider | PASS delimitado; não é jornada52 |
| Edição financeira de draft | draft100/v → draft140/v+1 | Creator/admin canônico; confirmação específica; CAS | HTTP existente, SQLite, auditoria uma vez | PASS de origem |
| Submissão do persistido | draft140/v → pending140/v+1 | Papel canônico; `values:{}`; congela snapshot | HTTP existente e snapshot submetido140USD | PASS de origem |
| Aprovação do submetido | pending140/v → sourcing140/v+1 no fixture de holder único | Holder Bob, valor/moeda e versão exatos; política atual | HTTP existente, auditoria e notices; nenhum save posterior | PASS de origem |
| Rejeição e ressubmissão | pr_pending100 → pr_rejected100 → pr_rejected140 → pr_pending140 | Motivo explícito; novo CAS e nova revisão; save preserva o estágio rejeitado | Comando antigo100 não aprova140 | PASS de origem |
| Repetição de efeito | Mesmo CAS após commit | Sem refresh automático |409, zero novos writes/auditorias; mesma prova após SQLite reopen | PASS de ausência de duplicação; não é replay C12 |
| Policy/moeda/roles mudam entre preparar e executar | Request CAS pode permanecer igual | Review completa refeita no snapshot autenticado | Predicado síncrono no harness HTTP recusa antes de execute | PASS do core/harness |
| Ativar admissão no HTTP instalado | Hook no Application + contexto UI real | Request exato e marker sem fallback | Patch completo, pre/postimages e wrapper | PROPOSED_NOT_APPLIED; integração NOT_RUN |
| Preview misto Planner + Procurement para52 | Planner2400/diferença1200; PR140 permanece hipótese externa | Fonte Planner e PR anexadas, caso/período/moeda atuais | Patch de nove caminhos,4testes adicionais inertes | PROPOSED_NOT_APPLIED; NOT_RUN |
| Aprovar100 e aplicar140 | Efeito incompatível | Snapshot aprovado não corresponde à substituição | Recusas originais intactas + novas recusas | Não permitido |
| Substituir a estimativa PR depois de aprovar | sourcing → tentativa de mudar pr.estAmount | O save de sourcing pode atender buyer/admin, mas não aplica essa substituição PR; lifecycle/C12 recusam a intenção | Gate C12 intacto; o caso HTTP de Alice/requester recebe403 | OPEN: requer decisão S0 |
| M31-FINANCIAL-APPROVAL, nominal52 | Preparação/approval/Apply e receipt recuperável conforme oracle original | Exige contrato próprio da substituição futura | Não substituído pelo ciclo canônico | OPEN |
| MI07 captura histórica original | prepare financeiro150 → captura original → mudança → recall/histórico | C08/C17 e autoridade histórica original | Consumidor51 auditado sem edição; falha antes de captura | OPEN |
| Recuperação de recibo financeiro após resposta perdida | Receipt + mutação no mesmo commit | Mesmo key/digest, autorização atual | Não existe no novo plano canônico; proposta separada | OPEN_C12 |
| Geração/typecheck/guards | W exato `179a766b` | Base dev real `a1d37698a7bb097c1578f827eba6a19b9917ef07` | Run43656868087;0gates/0errors/11warnings herdados | PASS com avisos |
| Prova integral e release | C/G7,D/G8,AM01–AM06, FINAL reviews |45/S0 e consumidores próprios | Não executados pela53 | OPEN; GLOBAL_RELEASE=false |

## Critérios relacionados e alcance exato

| Critério/contrato | Contribuição53 | O que continua exigido |
| --- | --- | --- |
| WP04.INV.01; WP04.T04.INV.01 | Não altera alçada/papel/holder/autoaprovação; ação explícita | Toda matriz de papéis e PR/sourcing/PO |
| WP04.INV.02; WP04.T04.CHK.04; WP04.T04.INV.02 | Snapshot/CAS retidos; stale não reaplicado; histórico preservado | UI instalada preservando comentário local e demais estados |
| WP04.T03.CHK.03; WP04.T03.INV.01/02 | Moeda submetida congelada; drift de settings recusado; ausência não vira zero | Ranking, sourcing, FX completo e demais oráculos originais |
| WP04.T04.CHK.03 | Wrong holder/admin e snapshot errado recusados pelo adapter e domínio | Matriz integral incluindo todas as combinações e estágios |
| WP04.T04.CHK.05; WP04.T04.DOD.02 | Preparação readonly separada das ações e repetível | Consumidor C07/rotina real e seus efeitos externos |
| WP04.DOD.03; WP04.SUC.10 | Handoff com consumidor, manifests, testes e limitações | Composição integrada pelo owner e prova instalada |
| C08 | Resultado/choice preservados pelo provider real; commands finais voltam ao domínio | Instalação compartilhada atual e demais BusinessPorts |
| C12; WP11 | Escolha não é aprovação; financeiro preparado antigo continua recusado | Efeito financeiro original e receipt/recovery originais permanecem abertos |
| C16 | UI lease real e Request mantidos; nenhum approve/apply MCP novo | Paridade de39operações/8packs, native ingress e AM02/AM03 |
| C17; MI07 | Identidade e fontes preservadas; nenhuma captura falsa | Jornada completa51/Memory, scanner/Atlas/restart/revogações originais |

`CRITERIA53.json` mantém os111 IDs WP04 do pacote. “Contribuição testada” não altera o status normativo original nem fecha as outras1499 obrigações da campanha.
