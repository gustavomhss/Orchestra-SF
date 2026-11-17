---
name: sf-user-journey-qa-cap-cap06-10-cap10-p01
description: "QA manutenção SF: executar story SF-CAP10-P01 (CAP10: Gerenciar execução de projeto e milestones verificáveis) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP10-P01 ou o caso específico CAP10: Gerenciar execução de projeto e milestones verificáveis"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP10-P01"
---
# SF-CAP10-P01 — CAP10: Gerenciar execução de projeto e milestones verificáveis

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** LEADER · **Superfícies:** CAP10 · **Jornadas:** J02, J08.

**Entrada UI indicada:** `/orchestra/sf-portfolio/projects` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** P-004 · EDI Logistics · milestone MS-04 due 2026-12-15

**Resultado de negócio:** Como Caio, líder/contribuidor de TI, quero gerenciar execução de projeto e milestones verificáveis para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: P-004 · EDI Logistics · milestone MS-04 due 2026-12-15. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Criar projeto P-004 ou abrir o seed existente
3. **[READ_ONLY_WITNESS]** Registrar milestone MS-04 e responsável funcional
4. **[UI_ACTION]** Alterar status com nota explicando dependência de fornecedor
5. **[UI_ACTION]** Voltar ao portfolio e abrir histórico
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Milestone aparece sob P-004, com prazo e dono corretos
- Alteração é visível em listagem e trilha
- Risco R-07 permanece referenciado
- Sem duplicação de milestone ao repetir leitura
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u05. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
