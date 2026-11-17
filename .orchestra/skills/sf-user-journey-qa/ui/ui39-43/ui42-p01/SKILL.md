---
name: sf-user-journey-qa-ui-ui39-43-ui42-p01
description: "QA manutenção SF: executar story SF-UI42-P01 (UI42: Avaliar combinações de projetos com restrições financeiras) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI42-P01 ou o caso específico UI42: Avaliar combinações de projetos com restrições financeiras"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI42-P01"
---
# SF-UI42-P01 — UI42: Avaliar combinações de projetos com restrições financeiras

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** CIO · **Superfícies:** UI42 · **Jornadas:** J02, J08.

**Entrada UI indicada:** `/orchestra/sf-portfolio/scenarios/:caseRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** SCN-PORT-01 · 25 candidatos · teto sintético 200000 USD

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero avaliar combinações de projetos com restrições financeiras para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: SCN-PORT-01 · 25 candidatos · teto sintético 200000 USD. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir campanha de cenários e configurar escopo
3. Selecionar candidatos P-001…P-025 com limites
4. Executar avaliação admitida pela fonte
5. Inspecionar escolhas candidatas e salvar versão do resultado
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Resultado reporta restrições, custos e fontes
- Projetos não são duplicados em um conjunto
- Salvar cenário não altera portfolio official
- Resultados têm IDs e revisões rastreáveis
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u19. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
