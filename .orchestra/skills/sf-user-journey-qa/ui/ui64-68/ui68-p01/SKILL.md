---
name: sf-user-journey-qa-ui-ui64-68-ui68-p01
description: "QA manutenção SF: executar story SF-UI68-P01 (UI68: Exportar informação de compras preservando autorização e efe) pela UI; ator BUYER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI68-P01 ou o caso específico UI68: Exportar informação de compras preservando autorização e ef"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI68-P01"
---
# SF-UI68-P01 — UI68: Exportar informação de compras preservando autorização e efeito comprovado

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** BUYER · **Superfícies:** UI68 · **Jornadas:** J03.

**Entrada UI indicada:** `/orchestra/sf-imports/exports` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** EXPORT-PR-32000 · PO-EDI-01

**Resultado de negócio:** Como Pedro, buyer Procurement, quero exportar informação de compras preservando autorização e efeito comprovado para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: EXPORT-PR-32000 · PO-EDI-01. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Exports de dados/PO
3. Selecionar PO e formato admitido
4. Solicitar export, conferir status terminal e baixar
5. Abrir arquivo e comparar valores com fonte atual/autorizada
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Arquivo existe e mantém IDs, valores e moeda sem erro
- Export interno não comprova envio ao ERP
- Grants e redaction aplicados ao conteúdo
- Link revogado não permite download posterior
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u23. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
