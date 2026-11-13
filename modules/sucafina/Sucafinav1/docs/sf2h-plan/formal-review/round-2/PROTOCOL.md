# Revisão adversarial formal — rodada 2

Esta rodada julga a reconciliação do plano após os dez achados originais. O candidato deve ser commitado e verificado antes de ser entregue aos três revisores. Cada relatório identifica o mesmo SHA exato; correções posteriores exigem novo candidato e rechecagem das áreas afetadas.

## Independência e método

Três agentes novos, sem autoria na correção e sem acesso às conclusões uns dos outros antes da entrega, examinam o candidato e as fontes primárias necessárias. O relatório da rodada 1 fornece as objeções a resolver; nenhuma conclusão do autor sobre fechamento é tomada como prova. Não há quota de achados nem obrigação de aprovar.

Os revisores leem os artefatos canônicos, consumidores e caminhos de falha. Podem consultar o código da baseline pelo GitHub MCP. Não implementam o produto, não alteram o candidato e não executam testes locais de produto. Os arquivos de parecer são escritos fora da cópia congelada.

| Revisor | Responsabilidade |
| --- | --- |
| Produto | Cobertura integral, resultados consumidos na UI, dezoito skills, confirmações por escopo, custos omitidos, colaboração e documentos. |
| Técnica | AgentV2/SkillV2, MCP com identidade por chamada, packaging e uso dos módulos reais Atlas, persistência, tipos, autorização e falhas. |
| Execução | Grafo, checkpoints, escritores, delegações, slots, revisão independente, orçamento condicionado de 120 minutos, receitas e proveniência das provas. |

## Cinco famílias de axiomas

**DoD:** o relatório identifica o SHA, os caminhos examinados, o estado de cada achado original pertinente, novos achados demonstráveis e um veredicto explícito.

**Invariants:** preservar escopo integral e limites de autoridade; não confundir presença de documento, count, stub, plano ou validação estrutural com implementação; não editar o candidato durante o julgamento; não aprovar o próprio trabalho.

**Quality standards:** cada achado contém requisito atingido, localização, evidência, contraexemplo, consequência, correção verificável e severidade proporcional. Um detalhe de implementação ainda não escrito não é por si só um defeito do plano; um contrato impossível ou contraditório é.

**Completeness criteria:** reexaminar os achados antigos pertinentes e as bordas alteradas; acompanhar perfil/skill/operação/saída/consumidor/prova, contexto confiável MCP, adaptação/persistência Atlas, materialidade de confirmação e cobertura econômica. No cronograma, contar autoria, coordenação, handoff, revisão e retomada dos autores sem slots adicionais implícitos.

**Success criteria:** a integradora consegue reproduzir o problema ou verificar seu fechamento em artefatos concretos. O resultado pode ser APPROVED_FOR_EXECUTION se não houver P0/P1 aberto; P2 deve ter disposição explícita. A aprovação do plano não aceita o produto nem demonstra a duração de duas horas.

## Saída

JSON e Markdown por revisor. Campos mínimos: review_id, reviewer, reviewed_commit, focus, examined_paths, original_findings, new_findings, verdict, residual_uncertainties e implementation_test_status=NOT_RUN. Em original_findings, usar CLOSED ou OPEN com fundamento. Em novos achados, usar as severidades do protocolo geral e IDs próprios da rodada.

Os pareceres originais ficam preservados. Após a integração das conclusões, o mapa de correções aponta o candidato avaliado, a evidência de cada fechamento e a localização da rechecagem. Nenhum estado PASS é propagado para critérios de implementação.
