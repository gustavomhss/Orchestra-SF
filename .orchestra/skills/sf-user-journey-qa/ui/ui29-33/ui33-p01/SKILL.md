---
name: sf-user-journey-qa-ui-ui29-33-ui33-p01
description: "QA manutenção SF: executar story SF-UI33-P01 (UI33: Abrir caso de decisão que cite fatos e alternativas) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI33-P01 ou o caso específico UI33: Abrir caso de decisão que cite fatos e alternativas"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI33-P01"
---
# SF-UI33-P01 — UI33: Abrir caso de decisão que cite fatos e alternativas

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI33 · **Jornadas:** J04, J06.

**Entrada UI indicada:** `/orchestra/sf-decisions` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** CASE-EDI-01 · selecionar fornecedor + timeline de TI

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero abrir caso de decisão que cite fatos e alternativas para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: CASE-EDI-01 · selecionar fornecedor + timeline de TI. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir lista de decisões e criar CASE-EDI-01
3. Registrar pergunta, escopo de negócio e fontes P-004/PR-32000
4. Salvar draft e reabrir
5. Convidar papéis de leitura específicos, não aprovação implícita
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Caso tem caseRef e versão próprios
- Dados de fontes são referências autorizadas
- Novo caso não aplica compra
- Leitor restrito só vê campos admitidos
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u16. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
