---
name: sf-user-journey-qa-cap-cap11-15-cap14-p01
description: "QA manutenção SF: executar story SF-CAP14-P01 (CAP14: Ver contrato de fornecedor e a responsabilidade por renovaç) pela UI; ator BUYER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP14-P01 ou o caso específico CAP14: Ver contrato de fornecedor e a responsabilidade por renova"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP14-P01"
---
# SF-CAP14-P01 — CAP14: Ver contrato de fornecedor e a responsabilidade por renovação

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** BUYER · **Superfícies:** CAP14 · **Jornadas:** J04.

**Entrada UI indicada:** `/orchestra/sf-procurement/contracts` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** CON-042 · fornecedor SUP-003 · renovação 2027-02-01

**Resultado de negócio:** Como Pedro, buyer Procurement, quero ver contrato de fornecedor e a responsabilidade por renovação para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: CON-042 · fornecedor SUP-003 · renovação 2027-02-01. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir Vendor Contracts e localizar CON-042
3. **[READ_ONLY_WITNESS]** Registrar período/renovação e documento autorizado
4. **[UI_ACTION]** Relacionar contrato à solicitação PR-32000
5. **[READ_ONLY_WITNESS]** Verificar fornecedor vigente e link com sourcing
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Contrato tem supplierRef e datas explícitas
- Relação com requisição não altera estágio da PR
- Informações restritas do fornecedor são redigidas por grant
- Histórico de renovação permanece auditável
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u15. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
