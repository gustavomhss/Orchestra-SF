---
name: sf-user-journey-qa-ui-ui49-53-ui52-p01
description: "QA manutenção SF: executar story SF-UI52-P01 (UI52: Registrar discussão sobre bloqueio técnico sem aprovar orçam) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI52-P01 ou o caso específico UI52: Registrar discussão sobre bloqueio técnico sem aprovar orça"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI52-P01"
---
# SF-UI52-P01 — UI52: Registrar discussão sobre bloqueio técnico sem aprovar orçamento

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** LEADER · **Superfícies:** UI52 · **Jornadas:** J01, J06.

**Entrada UI indicada:** `/orchestra/sf-work/threads/:threadRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** THREAD-EDI-01 · HOT-EDI-07 · comentário de Caio

**Resultado de negócio:** Como Caio, líder/contribuidor de TI, quero registrar discussão sobre bloqueio técnico sem aprovar orçamento para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: THREAD-EDI-01 · HOT-EDI-07 · comentário de Caio. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir thread do HOT-EDI-07
3. **[UI_ACTION]** Enviar comentário documentando atraso de fornecedor
4. **[UI_ACTION]** Responder como Sofie com dado financeiro autorizado
5. **[UI_ACTION]** Consultar histórico e links em nova sessão
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Mensagens têm autor e horário, sem edição retroativa invisível
- Thread vincula um registro correto
- Resposta não é aprovação Finance
- Leitor sem acesso ao caso não recebe conteúdo da thread
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u44. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
