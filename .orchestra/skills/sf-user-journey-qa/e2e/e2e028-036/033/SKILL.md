---
name: sf-user-journey-qa-e2e-e2e028-036-033
description: "QA manutenção SF: executar story SF-E2E-033 (O servidor reiniciou, o recibo continua sendo o mesmo) pela UI; ator OPS, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-033 ou o caso específico O servidor reiniciou, o recibo continua sendo o mesmo"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-033"
---
# SF-E2E-033 — O servidor reiniciou, o recibo continua sendo o mesmo

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** OPS · **Outros atores:** AUDITOR, CIO · **Superfícies:** UI40, UI57, UI50, UI65, CAP25 · **Jornadas:** J03, J04, J05, J07, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Após import aplicado e PR aprovada, processo e store são reiniciados de forma controlada.

**Resultado de negócio:** Como OPS, com apoio de AUDITOR, CIO, diante da situação descrita, preciso persistir transações e provar recuperação após restart/rollback, para não duplicar compras, decisões ou importações.

## Pré-condições específicas

- Após import aplicado e PR aprovada, processo e store são reiniciados de forma controlada.

## Passos a executar na interface

1. Capturar source SHA, schema migration e backup com hash
2. Executar import com receipt válido A1
3. Avançar PR32000 uma etapa e capturar receipt B1
4. Preservar review R1 e gerar report C1
5. Reiniciar instalação/VM sob runbook autorizado
6. Reautenticar e consultar A1/B1/R1/C1
7. Repetir apenas leituras, nunca repostar Apply
8. Conferir SQLite/WAL, CAS revisions e audit intactos
9. Simular rollback em ambiente separado e comparar snapshot

## Oráculos observáveis (não reescrever para passar)

- Recibos são duráveis e no mesmo domínio após restart
- Releitura não duplica import/PO
- Review R1 ainda preservada e autorizada
- Rollback de código e dados é controlado e distinto
- Sem perda de audit ou grant durante restore

## Contraprovas

- Falha no restore tem parada segura e evidência, não abre instância parcialmente válida
- Se SHA do pacote não bate com origem/recibo, NO-GO

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
