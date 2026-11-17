---
name: sf-user-journey-qa-e2e-e2e028-036-032
description: "QA manutenção SF: executar story SF-E2E-032 (CTRM, SAP e Fabric não viram features por aparecer no menu) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-032 ou o caso específico CTRM, SAP e Fabric não viram features por aparecer no menu"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-032"
---
# SF-E2E-032 — CTRM, SAP e Fabric não viram features por aparecer no menu

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** FINANCE, BUYER · **Superfícies:** CAP03, CAP14, CAP25, UI45 · **Jornadas:** J02, J04, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Contexto Sucafina inclui CTRM/ERP/SAP/Microsoft Fabric como possíveis sistemas externos, sem conector comprovado.

**Resultado de negócio:** Como CIO, com apoio de FINANCE, BUYER, diante da situação descrita, preciso distinguir conector real de mock, link e hipótese de integração, para evitar prometer fluxo externo que não foi executado.

## Pré-condições específicas

- Contexto Sucafina inclui CTRM/ERP/SAP/Microsoft Fabric como possíveis sistemas externos, sem conector comprovado.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Abrir dashboard e identificar fonte interna efetiva
2. **[UI_ACTION]** QA registra se há conector externo instalado e sua versão
3. **[UI_ACTION]** Validar leitura de contrato e origem da métrica
4. **[CONTROLLED_FAULT]** Simular falha do sistema externo apenas quando integração existir — somente com harness de falha já existente e autorizado; senão BLOCKED_ENVIRONMENT
5. **[UI_ACTION]** Executar compra interna e ler receipt
6. **[READ_ONLY_WITNESS]** Verificar se existe comprovante independente de envio ao ERP
7. **[READ_ONLY_WITNESS]** Abrir BI e inspecionar linha de origem
8. **[UI_ACTION]** Apresentar resumo ao CIO distinguindo internal e external

## Oráculos observáveis (não reescrever para passar)

- Nenhuma operação interna é rotulada como “transmitida ao SAP” sem recibo externo
- Dashboard não inventa sincronização CTRM
- Origem de BI identifica produtor real
- Integração ausente é GAP/NOT_APPLICABLE documentado, não PASS inventado
- Timeout externo não resulta em transação interna duplicada

## Contraprovas

- Serviço Fabric indisponível mas cálculo interno disponível: não substituir número com zero
- Callback externo duplicado tem idempotência quando contrato existir

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
