# Critérios de aceite executivo — Sucafina / Orchestra-SF

**Responsabilidade:** dono do release; QA lead; responsável por identidade; representante Finance/Procurement; CIO patrocinador. O CIO não deve ser levado a aprovar com base em screenshots de demonstração, tool registry, PR verde isolado ou planilhas de stories preenchidas com `PASS` sintético.

## Condições necessárias para GO (conjuntivas)

- [ ] **C imutável:** SHA, tree, pacote, schema, runtime instalado e fixture revision coincidem com o que foi testado; sem troca de base após as evidências.
- [ ] **CI:** os 12 jobs obrigatórios de sf-ci e as provas do release exigidas pelo pipeline são SUCCESS no **mesmo C**, com logs e hash preservados. A factory extraída fora checkout e ingress health validado não substituem autenticação real.
- [ ] **Inventário:** 70 superfícies mapeadas têm resultado explícito (`PASS`, `FAIL`, `BLOCKED`, exceção justificada), 165 rotas com autorização e ref/sintaxe verificadas, além das novas superfícies incluídas no release sem inflar o manifesto histórico.
- [ ] **P0:** todos os casos de prioridade P0 aplicáveis estão `PASSED_WITH_EVIDENCE`; não existem failures ou bloqueios críticos com upgrade informal para sucesso.
- [ ] **Jornadas J01–J08:** verificadas com grupos/atores reais de teste, versões, before/after e recibos onde apropriado. CIO/Finance/HR/Buyer/Approver/Zico e revogação são provas distintas.
- [ ] **Entra:** login OIDC real, consent delegated efetivo, árvore Graph completa, supreme admin allow/deny, duas amarrações role/grant, CAS 409 e auditoria, anti-escalation, perda de acesso, sem Graph writes. Se feature admin não estiver no candidato, **NO-GO do release que a exige**.
- [ ] **Dados:** 590000/602000/596000, FX 28000×1.08=30240, CAPEX 91827, 42/40/2 FTE e 25 projetos reconciliados, null/zero/missing distintos, sem mutações cruzadas por UI/read.
- [ ] **Transações:** 1 apply/1 receipt em import, PR→SRC→PO com holder por etapa, idempotency após resposta perdida, CAS stale e separação de autorização.
- [ ] **Relatórios:** review imutável com 25 projetos, DOCX e PPTX reais, reabertura após alteração de fonte e negação após revogação de acesso.
- [ ] **Agentes:** admissões, execution/verifier, estados terminal/failed/cancelled e schedules quando instalados; `started` não apresentado como `completed`.
- [ ] **DR:** backup/restore/restart/rollback em instalação de QA e política de segredos, com receipt original preservado; nenhum arquivo de token em Git/logs.
- [ ] **UAT CIO:** reunião guiada com três decisões exemplares (forecast, compra, risco operacional), pausa para contraprovas, evidência assinada de que o sistema não tomou decisão por conta própria.

## Regras de exceção

Um `NOT_APPLICABLE_APPROVED` só é legítimo se a feature realmente estiver fora do release, houver decisão do dono e prova de que nenhuma dependência P0 ficou descoberta. Uma feature declarada **obrigatória** (ex.: Supreme Admin se assim for mantido) não admite `N/A` para converter NO-GO em GO. `BLOCKED_CAPABILITY` indica porta/codec/Graph/provider não instalado; não é defeito de QA nem sucesso. Não modificar asserts, skips, roles ou fixtures para obter verde sem registrar revisão do contrato.

## Assinatura (preencher somente após executar)

| Papel | Pessoa designada | Data UTC | SHA C | Resultado / evidência |
| --- | --- | --- | --- | --- |
| Dono do release | PENDING | — | — | NOT_SIGNED |
| QA Lead | PENDING | — | — | NOT_SIGNED |
| Responsável Entra/Security | PENDING | — | — | NOT_SIGNED |
| Finance/Procurement | PENDING | — | — | NOT_SIGNED |
| Patrocinador CIO | PENDING | — | — | NOT_SIGNED |

**Estado inicial deste pacote: `NO_ATTESTATION_PERFORMED`.**
