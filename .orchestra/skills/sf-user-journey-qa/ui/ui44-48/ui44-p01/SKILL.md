---
name: sf-user-journey-qa-ui-ui44-48-ui44-p01
description: "QA manutenção SF: executar story SF-UI44-P01 (UI44: Medir sensibilidade sem apresentar certeza artificial) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI44-P01 ou o caso específico UI44: Medir sensibilidade sem apresentar certeza artificial"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI44-P01"
---
# SF-UI44-P01 — UI44: Medir sensibilidade sem apresentar certeza artificial

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** FINANCE · **Superfícies:** UI44 · **Jornadas:** J02, J08.

**Entrada UI indicada:** `/orchestra/sf-portfolio/sensitivity/:caseRef/:resultRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** SENS-EDI-01 · EURUSD 1.08 ±0.05

**Resultado de negócio:** Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero medir sensibilidade sem apresentar certeza artificial para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: SENS-EDI-01 · EURUSD 1.08 ±0.05. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir sensibilidade do cenário R-001
3. **[UI_ACTION]** Definir mudança de FX 1.03/1.13 com unidade
4. **[UI_ACTION]** Recalcular impacto da cotação B sobre decisão
5. **[READ_ONLY_WITNESS]** Comparar intervalos e restrições
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- B=28840 USD em 1.03 e 31640 USD em 1.13
- Limites e moeda são visíveis
- Mudança de sensibilidade não altera FX oficial
- Limite não suportado é reportado como não calculável
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u19. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
