---
name: sf-user-journey-qa-e2e-e2e001-009-006
description: "QA manutenção SF: executar story SF-E2E-006 (O documento diz 6 dias; a extração sugere 60) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-006 ou o caso específico O documento diz 6 dias; a extração sugere 60"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-006"
---
# SF-E2E-006 — O documento diz 6 dias; a extração sugere 60

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** LEADER · **Outros atores:** CIO, FINANCE · **Superfícies:** UI58, UI59, UI60, UI33, UI36, UI42 · **Jornadas:** J05, J07.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Relatório DOC-EDI-01 contém prazo atrasado 6 dias; extrator sintetiza erroneamente 60.

**Resultado de negócio:** Como LEADER, com apoio de CIO, FINANCE, diante da situação descrita, preciso confrontar dado extraído com documento de origem antes de aprovar o uso em um cenário, para impedir que erro de IA vire valor oficial.

## Pré-condições específicas

- Relatório DOC-EDI-01 contém prazo atrasado 6 dias; extrator sintetiza erroneamente 60.

## Passos a executar na interface

1. Caio envia documento sintético classificado
2. Inspeciona candidato de extração 60 e rejeita citando a página
3. Confirma apenas trecho correto “6 dias”
4. Vincula evidência confirmada ao risco R-07
5. CIO cria CASE-EDI-01 usando a evidência
6. Finance verifica fonte e competências antes da comparação
7. CIO executa cenário com rastreabilidade ao docRef
8. Auditor consulta histórico de rejeição, sem deletar evidência de erro

## Oráculos observáveis (não reescrever para passar)

- Candidato 60 permanece rejeitado e não vira fato
- Evidência 6 contém documento, trecho, revisão e humano
- Nenhuma quote/PO é alterada pelo texto do documento
- Cenário mostra evidência confirmada e fonte
- Revogação da fonte impede releitura mesmo por links antigos

## Contraprovas

- Repetir extração com output que omita página: permanece candidato não confirmado
- Usar documento de outro tenant: nenhuma leitura cruzada

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
