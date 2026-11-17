---
name: sf-user-journey-qa-ui-ui34-38-ui37-p01
description: "QA manutenção SF: executar story SF-UI37-P01 (UI37: Encaminhar pergunta a responsável sem virar aprovador) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI37-P01 ou o caso específico UI37: Encaminhar pergunta a responsável sem virar aprovador"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI37-P01"
---
# SF-UI37-P01 — UI37: Encaminhar pergunta a responsável sem virar aprovador

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** LEADER · **Superfícies:** UI37 · **Jornadas:** J04, J06.

**Entrada UI indicada:** `/orchestra/sf-decisions/:caseRef/questions` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** Q-EDI-FX-01 · finance owner Sofie

**Resultado de negócio:** Como Caio, líder/contribuidor de TI, quero encaminhar pergunta a responsável sem virar aprovador para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: Q-EDI-FX-01 · finance owner Sofie. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir ciclo de perguntas de CASE-EDI-01
3. **[UI_ACTION]** Criar Q-EDI-FX-01 para Sofie como Finance
4. **[UI_ACTION]** Responder com fonte do FX e marcar dúvida resolvida
5. **[UI_ACTION]** Voltar ao histórico do caso
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Pergunta/resposta têm timestamp, principal e fonte
- Owner não é derivado de nome exibido
- Resposta não executa PO
- A conclusão aparece no caso sem excluir mensagens anteriores
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u17. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
