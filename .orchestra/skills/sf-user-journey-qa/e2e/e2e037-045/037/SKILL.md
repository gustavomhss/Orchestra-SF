---
name: sf-user-journey-qa-e2e-e2e037-045-037
description: "QA manutenção SF: executar story SF-E2E-037 (O pedido foi rejeitado e precisa voltar à fila certa) pela UI; ator REQUESTER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-037 ou o caso específico O pedido foi rejeitado e precisa voltar à fila certa"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-037"
---
# SF-E2E-037 — O pedido foi rejeitado e precisa voltar à fila certa

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** REQUESTER · **Outros atores:** APPROVER, BUYER · **Superfícies:** CAP24, CAP25, CAP26, CAP28 · **Jornadas:** J04.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · PR32000 sofre rejeição no estágio PR; após correção segue sourcing, rejeição SRC e reenvio.

**Resultado de negócio:** Como REQUESTER, com apoio de APPROVER, BUYER, diante da situação descrita, preciso fazer a mesma compra percorrer rejeição, correção e nova submissão, para garantir histórico e segregação nas três etapas.

## Pré-condições específicas

- PR32000 sofre rejeição no estágio PR; após correção segue sourcing, rejeição SRC e reenvio.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Caio cria PR draft 32000
2. **[UI_ACTION]** Gabriel rejeita PR com motivo verificável
3. **[UI_ACTION]** Caio reabre e reenvia a mesma requisição com versão nova
4. **[UI_ACTION]** Gabriel aprova PR na nova revisão
5. **[UI_ACTION]** Pedro cria sourcing e submete para holder SRC
6. **[UI_ACTION]** Holder de SRC rejeita quote incompleta
7. **[UI_ACTION]** Pedro substitui quote e reenvia SRC
8. **[UI_ACTION]** Após aprovação válida, cria PO draft e pede aprovação
9. **[UI_ACTION]** Auditor inspeciona histórico de todos os estágios e receipts

## Oráculos observáveis (não reescrever para passar)

- Estados pr_rejected/src_rejected são distintos de draft
- Ressubmissão incrementa versão e mantém histórico de rejeição
- Holder de cada etapa é reavaliado, não copiado do estágio anterior
- Nenhum `po_issued` antes de `po_approved`
- Sem self approval implícita
- No máximo uma transição por attempt admitido

## Contraprovas

- Cancelar pedido em estágio não permitido: recusa sem commit
- Rejeição sem motivo obrigatório, se contrato exigir: 422

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
