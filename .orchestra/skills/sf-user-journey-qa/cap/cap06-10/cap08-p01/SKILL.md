---
name: sf-user-journey-qa-cap-cap06-10-cap08-p01
description: "QA manutenção SF: executar story SF-CAP08-P01 (CAP08: Conduzir review de talentos mantendo confidencialidade) pela UI; ator HR, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP08-P01 ou o caso específico CAP08: Conduzir review de talentos mantendo confidencialidade"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP08-P01"
---
# SF-CAP08-P01 — CAP08: Conduzir review de talentos mantendo confidencialidade

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** HR · **Superfícies:** CAP08 · **Jornadas:** J02, J08.

**Entrada UI indicada:** `/orchestra/sf-people/talent` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** TAL-014 · rating fictício 3/5 · ciclo 2026-H2

**Resultado de negócio:** Como HR sintética HR-01, quero conduzir review de talentos mantendo confidencialidade para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: TAL-014 · rating fictício 3/5 · ciclo 2026-H2. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Selecionar Talent Review do ciclo H2
3. Editar avaliação do membro sintético TAL-014 sob grant de HR
4. Salvar justificativa com revisão e conferir histórico
5. Exportar somente quando entitlement de RH for válido
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Rating 3/5 e ciclo persistem com ator e versão
- Dados pessoais seguem políticas de redação e exportação
- Leitores não autorizados não recebem arquivo antigo
- Review não concede mudança no quadro de aprovações
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u47. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
