---
name: sf-user-journey-qa-ui-ui54-58-ui56-p01
description: "QA manutenção SF: executar story SF-UI56-P01 (UI56: Decidir o impacto de um import antes de aplicar) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI56-P01 ou o caso específico UI56: Decidir o impacto de um import antes de aplicar"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI56-P01"
---
# SF-UI56-P01 — UI56: Decidir o impacto de um import antes de aplicar

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** UI56 · **Jornadas:** J03.

**Entrada UI indicada:** `/orchestra/sf-imports/:manifestId/preview` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** IMPORT-OPEX-SEP26 · 10 valid/1 duplicate/1 invalid synthetic

**Resultado de negócio:** Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero decidir o impacto de um import antes de aplicar para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: IMPORT-OPEX-SEP26 · 10 valid/1 duplicate/1 invalid synthetic. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir manifestId da prévia versionada
3. Conferir 10 linhas válidas, 1 duplicata e 1 inválida
4. Comparar inserts, updates e removals permitidos
5. Corrigir a fonte e pedir nova prévia antes de aplicar
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Prévias não alteram fonte
- Invalid/duplicate visíveis e não ignorados silenciosamente
- O digest mostra versão dos dados
- Revisão de fonte obriga novo manifesto
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u23. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
