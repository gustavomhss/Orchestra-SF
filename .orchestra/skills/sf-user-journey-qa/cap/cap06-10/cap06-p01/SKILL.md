---
name: sf-user-journey-qa-cap-cap06-10-cap06-p01
description: "QA manutenção SF: executar story SF-CAP06-P01 (CAP06: Entender gap de headcount e a proveniência do dado) pela UI; ator HR, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP06-P01 ou o caso específico CAP06: Entender gap de headcount e a proveniência do dado"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP06-P01"
---
# SF-CAP06-P01 — CAP06: Entender gap de headcount e a proveniência do dado

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** HR · **Superfícies:** CAP06 · **Jornadas:** J02, J08.

**Entrada UI indicada:** `/orchestra/sf-people/overview` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** HC-SEP-26 · 42 FTE plan · 40 ocupados · 2 vagas

**Resultado de negócio:** Como HR sintética HR-01, quero entender gap de headcount e a proveniência do dado para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: HC-SEP-26 · 42 FTE plan · 40 ocupados · 2 vagas. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Headcount Overview e selecionar setembro/2026
3. Distinguir posição aprovada de pessoa atual
4. Inspecionar variância por departamento e custo
5. Abrir Team Structure e retornar
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- 42/40/2 reconciliam sem contar contractor duas vezes
- Dados sensíveis aparecem conforme grant de HR
- Competência e unidade FTE ficam visíveis
- Navegação não modifica roster
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u03. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
