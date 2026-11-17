---
name: sf-user-journey-qa-ui-ui54-58-ui55-p01
description: "QA manutenção SF: executar story SF-UI55-P01 (UI55: Carregar workbook de TI com prévia segura e auditável) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI55-P01 ou o caso específico UI55: Carregar workbook de TI com prévia segura e auditável"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI55-P01"
---
# SF-UI55-P01 — UI55: Carregar workbook de TI com prévia segura e auditável

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** UI55 · **Jornadas:** J03.

**Entrada UI indicada:** `/orchestra/sf-imports/new` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** IMPORT-OPEX-SEP26.xlsx · 12 linhas · centro IT-BR

**Resultado de negócio:** Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero carregar workbook de TI com prévia segura e auditável para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: IMPORT-OPEX-SEP26.xlsx · 12 linhas · centro IT-BR. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Selecionar destino Dashboard/Planner admitido pelo produto
3. Enviar workbook IMPORT-OPEX-SEP26.xlsx com linhas válidas/invalidas
4. Solicitar preview antes de qualquer commit
5. Registrar quantidade, digest e origem
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Upload não grava transação financeira
- Retorno registra aceitação/rejeição por linha
- Preview preserva valores originais e revisões
- A operação usa sessão autorizada e formato realmente suportado
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u23. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
