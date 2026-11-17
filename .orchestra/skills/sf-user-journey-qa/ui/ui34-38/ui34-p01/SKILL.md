---
name: sf-user-journey-qa-ui-ui34-38-ui34-p01
description: "QA manutenção SF: executar story SF-UI34-P01 (UI34: Ver escopo, intenção e fontes antes de escolher) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI34-P01 ou o caso específico UI34: Ver escopo, intenção e fontes antes de escolher"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI34-P01"
---
# SF-UI34-P01 — UI34: Ver escopo, intenção e fontes antes de escolher

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI34 · **Jornadas:** J04, J06.

**Entrada UI indicada:** `/orchestra/sf-decisions/:caseRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** CASE-EDI-01 · intenção adjudicar integração EDI

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero ver escopo, intenção e fontes antes de escolher para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: CASE-EDI-01 · intenção adjudicar integração EDI. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir CASE-EDI-01 por ID
3. Inspecionar autor, fonte, moeda, data e estágio das decisões
4. Abrir alternativa B e retornar ao resumo
5. Registrar revisão sem executar mudança
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Resumo identifica o que está pendente de decisão humana
- Estado da fonte e da escolha não são confundidos
- Permissão atual é validada na releitura
- Nenhum efeito financeiro ocorre na leitura
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u01, u16. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
