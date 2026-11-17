---
name: sf-user-journey-qa-cap-cap01-05-cap02-p01
description: "QA manutenção SF: executar story SF-CAP02-P01 (CAP02: Registrar e conduzir um assunto crítico que atravessa áreas) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP02-P01 ou o caso específico CAP02: Registrar e conduzir um assunto crítico que atravessa área"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP02-P01"
---
# SF-CAP02-P01 — CAP02: Registrar e conduzir um assunto crítico que atravessa áreas

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** LEADER · **Superfícies:** CAP02 · **Jornadas:** J01, J05.

**Entrada UI indicada:** `/orchestra/sf-dashboard/hot-topics` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** HOT-EDI-07 · atraso fictício 6 dias · responsável LEADER-Caio

**Resultado de negócio:** Como Caio, líder/contribuidor de TI, quero registrar e conduzir um assunto crítico que atravessa áreas para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: HOT-EDI-07 · atraso fictício 6 dias · responsável LEADER-Caio. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir Hot Topics e localizar HOT-EDI-07
3. **[UI_ACTION]** Criar tópico “Integração EDI Porto Santos” com prazo e owner de domínio
4. **[UI_ACTION]** Anexar projeto P-004 e nota M-002 usando referências selecionadas
5. **[READ_ONLY_WITNESS]** Encaminhar para revisão de Finance e verificar fila do responsável
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Tópico tem identificador estável e uma única entrada
- Referências são IDs distintos e corretos, não títulos homônimos
- O encaminhamento aparece em Meu trabalho apenas para o autorizado
- Abrir o tópico não produz aprovação financeira
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u38. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
