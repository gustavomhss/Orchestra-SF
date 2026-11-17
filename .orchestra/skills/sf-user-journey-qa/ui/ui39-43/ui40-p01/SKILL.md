---
name: sf-user-journey-qa-ui-ui39-43-ui40-p01
description: "QA manutenção SF: executar story SF-UI40-P01 (UI40: Verificar qual mudança foi de fato persistida) pela UI; ator AUDITOR, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI40-P01 ou o caso específico UI40: Verificar qual mudança foi de fato persistida"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI40-P01"
---
# SF-UI40-P01 — UI40: Verificar qual mudança foi de fato persistida

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** AUDITOR · **Superfícies:** UI40 · **Jornadas:** J04, J06.

**Entrada UI indicada:** `/orchestra/sf-decisions/:caseRef/receipts/:receiptRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** RECEIPT-EDI-01 · attempt CHANGE-EDI-01

**Resultado de negócio:** Como Auditor sintético AUD-01, quero verificar qual mudança foi de fato persistida para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: RECEIPT-EDI-01 · attempt CHANGE-EDI-01. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir recibo pelo case/receiptRef
3. Conferir origem, ator, revisão e resultado de negócio
4. Comparar before/after com fonte relida
5. Verificar histórico mesmo após nova leitura sem reaplicar
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Recibo é estável, não calculado a partir do estado atual
- Apply effect não duplica em refresh
- Negado não expõe recibo de outro tenant
- Resultado tem estado terminal verificável
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u18. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
