# Handoff — finish-decisions-20261119

SHA: checkpoint da branch a partir de03d2a11f3b8ffe51888601c5ad50ae0b16058dea; código é o commit que contém este documento
Data: 2026-11-19
Estado: partial

## Feito

- Preservados intent/index.tsx, intent/sources.tsx e sf-u16 do WP2@7fe991b0ec6679d97bfa795eac5f45998591521f.
- UI34 agora permite revisar objetivo, horizonte, moeda e descrições dos critérios originais, além das fontes inspecionadas. IDs/required, CAS, principal e evidências vêm do produtor; o comando original decisions.decision-edit continua único.
- A revisão mostra todos os campos enviados. Estado incerto continua bloqueado, sem retry automático ou payload novo. A leitura original do caso permanece o reconhecimento final.
- UI34 mostra estados vazios reais de alternativas/alterações e quantidade de referências/recibos no histórico para conservar as provas de criação/edição.

## Pendente

- packages/app-shell/e2e/sucafina/decisions-support/journey.ts:79 — helpers ainda têm controles/URLs do Workbench legado e serão portados; este checkpoint ainda não altera o spec.
- packages/app-shell/e2e/sucafina/decisions.spec.ts:39 — migrar create/edit/reopen/lost-response aos controles nativos reais e qualificar em Actions.
- packages/app-shell/e2e/sucafina/decisions-support/initial-alternatives.ts:14 — UI35 não produz a primeira alternativa a partir de cobertura pendente; precisa conectar os produtores originais sem seed de fixture.
- packages/app-shell/e2e/sucafina/decisions-support/choice-history.ts:42 — retry humano de mesmo corpo/key após resposta perdida precisa do contrato F02 estrito e prova do produtor C08.
- packages/app-shell/e2e/sucafina/decisions-support/procurement-closure.ts:10 — sequência financeira C12 completa ainda não portata/qualificada.
- packages/app-shell/src/orchestra/chapters/sucafina/decisions/intent/sources.tsx:62 — novo editor ainda sem typecheck/gate composto; não é evidência de execução.

## Decisões e justificativas

- Asserções removidas: nenhuma. Specs antigos permanecem ativos durante a migração; nenhum skip/timeout/fixture de resultado foi introduzido.
- Fonte e criação usam projeções/operações já existentes; não se insere case/alternative/choice/receipt na fixture.
- Retry explícito de Decisions precisa usar mesmo owner/operação/key/corpo canônico; o produtor confirma replayMutation antes do CAS e rejeita conteúdo diferente. Não usar nova instância de transporte para contornar pending.

## Como retomar

1. Continuar nesta branch a partir deste checkpoint e compor só os arquivos alterados sobre a integração atual.
2. Portar as duas jornadas básicas e usar um spec estreito que execute as mesmas funções do spec principal.
3. Qualificar tipos e navegação/GET/POST/reload reais em Actions antes de estender alternativas/escolha/C12.
4. Atualizar SHA, runs e pendências file:line em cada entrega ao integrador.

## Comandos e resultados

- Nenhum teste local, shell, browser local ou edição de runtime/application.ts.
- Nenhum gate desta fatia foi executado neste checkpoint.
- Não houve merge ou sf-ci por este agente.
