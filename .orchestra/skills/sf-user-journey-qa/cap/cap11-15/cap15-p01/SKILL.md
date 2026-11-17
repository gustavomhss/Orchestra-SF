---
name: sf-user-journey-qa-cap-cap11-15-cap15-p01
description: "QA manutenção SF: executar story SF-CAP15-P01 (CAP15: Acompanhar stakeholders internos e externos em tópico sensí) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP15-P01 ou o caso específico CAP15: Acompanhar stakeholders internos e externos em tópico sens"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP15-P01"
---
# SF-CAP15-P01 — CAP15: Acompanhar stakeholders internos e externos em tópico sensível

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** LEADER · **Superfícies:** CAP15 · **Jornadas:** J08.

**Entrada UI indicada:** `/orchestra/sf-operations/stakeholders` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** STK-011 · parceiro fictício Maritime Labs · owner P-003

**Resultado de negócio:** Como Caio, líder/contribuidor de TI, quero acompanhar stakeholders internos e externos em tópico sensível para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: STK-011 · parceiro fictício Maritime Labs · owner P-003. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Stakeholder Management
3. Registrar novo relacionamento com stakeholder STK-011
4. Vincular HOT-EDI-07 e atualizar próxima ação
5. Verificar que apenas papel autorizado pode ler notas restritas
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Relação vincula IDs imutáveis e prazo
- Próxima ação aparece na fila do responsável quando admitida
- Notas não vazam em pesquisa geral
- Export exige entitlement atual
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u30. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
