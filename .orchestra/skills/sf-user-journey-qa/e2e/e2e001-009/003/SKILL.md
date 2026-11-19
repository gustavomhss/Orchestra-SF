---
name: sf-user-journey-qa-e2e-e2e001-009-003
description: "QA manutenção SF: executar story SF-E2E-003 (A cotação mais barata não pode vencer quando é inelegível) pela UI; ator REQUESTER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-003 ou o caso específico A cotação mais barata não pode vencer quando é inelegível"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-003"
---
# SF-E2E-003 — A cotação mais barata não pode vencer quando é inelegível

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** REQUESTER · **Outros atores:** APPROVER, BUYER, SUPPLIER_ADMIN, CIO · **Superfícies:** CAP24, CAP25, CAP26, CAP27, CAP28, UI33, UI35, UI38, UI39, UI40 · **Jornadas:** J04, J06.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · PR-32000: integrar dados de embarques; três cotações A32400USD, B28000EUR×1.08=30240USD, C29000USD inelegível.

**Resultado de negócio:** Como REQUESTER, com apoio de APPROVER, BUYER, SUPPLIER_ADMIN, CIO, diante da situação descrita, preciso percorrer a compra com ofertas de moedas, elegibilidade técnica e autoridades distintas, para evitar escolha inválida ou aprovação por ator fora da etapa.

## Pré-condições específicas

- PR-32000: integrar dados de embarques; três cotações A32400USD, B28000EUR×1.08=30240USD, C29000USD inelegível.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Caio cria PR32000 em USD e submete justificativa
2. **[UI_ACTION]** Gabriel revisa pedido como holder atual e aprova etapa PR
3. **[UI_ACTION]** Pedro abre sourcing e associa fornecedores ativos
4. **[UI_ACTION]** Pedro registra A, B e C com suas elegibilidades
5. **[UI_ACTION]** Sofie confirma FX temporal 1.08 e moeda
6. **[READ_ONLY_WITNESS]** CIO abre CASE-EDI-01 para comparar A/B/C
7. **[UI_ACTION]** CIO escolhe B e registra justificativa
8. **[UI_ACTION]** Pedro avança sourcing, aprovação e PO por estados existentes
9. **[UI_ACTION]** Gabriel aprova somente estágio em que é holder
10. **[UI_ACTION]** Consultar recibo de emissão interna e não alegar transmissão a ERP

## Oráculos observáveis (não reescrever para passar)

- B equivale exatamente a USD30240
- C permanece inelegível mesmo custando menos
- Scores do oráculo, se expostos, mostram 87.9333 e 85 com decomposição
- Cada stage tem holder/versão/recibo específicos
- Buyer não aprova a própria etapa se não for holder
- Emissão interna não equivale a envio externo
- No máximo uma PO resultante do mesmo comando admitido

## Contraprovas

- Pedro tenta usar URL direta de Gabriel: 403, commit:false
- Marcar SUP-003 inactive durante sourcing: nova adjudicação deve falhar
- Alterar FX depois da comparação: escolha deve exigir revisão ou reavaliação

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
