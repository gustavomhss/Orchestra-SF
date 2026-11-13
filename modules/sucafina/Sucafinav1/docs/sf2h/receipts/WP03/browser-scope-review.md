# WP03 — revisão da prova de navegador montado

Estado: **BLOCKED_EXTERNAL_BEFORE_UI**. A implementação da spec foi selada em W4 `84b5a08aedce2cfc5fae048d96b39863692a469e`. O [run 43520849840](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43520849840) falhou no boot real do CLI por registro duplicado da rota `/sucafina`, antes das ações de produto: 0 pass / 1 fail. A causa, a atribuição estática ao seed e o patch não aplicado estão em [wp10-installation-router-handoff.md](./wp10-installation-router-handoff.md). Este receipt descreve a prova pretendida e seus limites; não registra PASS. Nenhum teste local foi executado.

## Seleção explícita

Usar o workflow existente, package `app`, runner `playwright`, config `e2e/playwright.production.config.ts`, args somente `e2e/sucafina/wp03/planner-mounted.spec.ts`. O validador existente exige uma seleção real de arquivos, workers 1, retries 0 e uma repetição. A configuração comum e sua inicialização do shell permanecem intactas. A jornada usa URLs absolutas de `http://localhost:4110/sucafina`, servidas pelo módulo de produção.

Arquivos próprios:

- `packages/app-shell/e2e/sucafina/wp03/installation-setup.ts`
- `packages/app-shell/e2e/sucafina/wp03/installation-fixture.ts`
- `packages/app-shell/e2e/sucafina/wp03/planner-mounted.spec.ts`

## Instalação, identidade e ciclo de vida

O bootstrap executa `prepareLocalConfiguration` e `prepareOperatorAccess` de produção num diretório temporário privado. O processo que atende as rotas é o CLI real: `bun run apps/cli/src/index.ts serve --hostname localhost --port 4110 --installation modules/sucafina/Sucafinav1/local/entry.ts`. O factory real inicializa as superfícies, abre SQLite, cria o host e monta os handlers. A spec não fornece `page.route`, HTML substituto, handler de domínio alternativo nem dados de banco fabricados.

O ambiente usa banco, configuração, chave de credenciais, TMPDIR e diretórios XDG exclusivos. Desabilita herança de credenciais e configuração do projeto; não propaga senha/config de servidor nem credenciais de provedores. A porta local fixa é reservada e liberada antes do lançamento; a existência de um serviço alheio provoca recusa, sem tentar encerrá-lo.

O código de enrollment de uso único é lido do artefato privado produzido pelo código real e consumido por HTTP Node contra o handler real. A fixture exige 303 para Dashboard e o cookie canônico HttpOnly, SameSite=Lax, limitado a `/sucafina`. O browser recebe somente a sessão emitida por esse handler. Não são inventados principal, sessão, token ou papel. O operador local de produção autentica como **admin**; alterar `roleMap` não o transformaria em viewer/owner, por isso a spec não faz essa alegação.

No teardown, a fixture encerra somente o filho que iniciou, aguarda sua saída e comprova que `localhost:4110` voltou a aceitar bind/close antes de remover o diretório privado. Usa SIGTERM e, se necessário, SIGKILL somente no próprio filho; não procura nem mata processos por nome ou por porta. Uma porta ainda ocupada falha a prova de cleanup e impede apagar os dados de uma instalação potencialmente viva.

## Credenciais e artefatos

`test.use({ trace: "off" })` vale apenas para esta spec. A fixture consome o código fora das ações de Playwright; a spec não navega para a URL com código. O log anexado passa por redaction dos segredos de enrollment/sessão conhecidos, parâmetros de credenciais, cabeçalhos Cookie/Set-Cookie/Authorization e sequências hexadecimais longas. Erros de setup também são saneados. O receipt não afirma que uma sessão real deixa de usar cookies em rede; afirma que não será preservada uma trace de requests dessa sessão.

A prioridade de `test.use` sobre option overrides de configuração/CLI foi verificada no código primário de [Playwright v1.59.1 fixtures.ts](https://github.com/microsoft/playwright/blob/v1.59.1/packages/playwright/src/common/fixtures.ts), Git blob `30b144e6634650ba51d6880b1ce864f978f5e43a`. Isso é relevante porque o workflow acrescenta `--trace retain-on-failure`; o fixture pool aplica os overrides antes de `test.use`. Permanecem relatório, screenshot da UI e log saneado para diagnóstico.

## Ações e assertions previstas

| Jornada real | O que a spec observa |
| --- | --- |
| Login local e versão fiscal | Sessão de produção admite Dashboard, criação da primeira versão pela UI e persistência de nome/ano. |
| Grid mensal OPEX | Tab entre células; colagem de 2×2 valores; retenção de zero explícito e texto inválido; erro localizado, save bloqueado; correção, preview e apply de duas linhas. |
| Reload mensal | Valores 0, 125, 75 e 150 persistidos após reload; grade salva distingue zero explícito e forecast herdado do budget. |
| CAPEX | Projeto e linhas criados pela UI; owner herdado do projeto, classificação e busca normalizada alteram as linhas; ausência de resultados remove o editor mensal. |
| Comparação de grade | Colunas Budget FY e Outlook FY presentes no modo compare da tela montada. |
| Versões | Cópia conserva forecast; marcar oficial persiste após reload; versão oficial não permite delete/unlock/ano; budget fica desabilitado, forecast continua editável para admin. |
| Visitante anônimo | Outro contexto sem cookie recebe redirect no read e 403 no POST; a versão continua oficial na sessão autorizada. |
| Integridade da página e cleanup | Sem pageerrors, screenshot final, filho encerrado e listener liberado. |

As esperas usam assertions/readiness ou respostas registradas antes do clique. Não há sleeps arbitrários, retry de mutação ou selectors `.first()` para esconder ambiguidade. A revisão estática independente confrontou labels, dialogs, filtros, copy, locks e ações com `runtime/ui.ts`, `runtime/planner.ts` e `product/ui/planner-monthly.ts`.

## Regra de processos

O helper usa `node:child_process` apenas no harness e2e isolado. A regra existente [script/check-spawn-imports.ts em W3](https://github.com/gustavomhss/Orchestra-SF/blob/8f91131ad3357c94fa135392b6829908356d82e5/script/check-spawn-imports.ts), Git blob `2dbd447ee433f34bf4d0d02e6299bbb44357df86`, exclui explicitamente `e2e/` no regex `SKIPPED`, além de testes/fixtures. Nenhum allowlist ou guard foi alterado e não há import dinâmico, supressão ou tentativa de contornar a regra.

## Limites de aceitação

Esta seleção deve produzir uma prova própria da UI existente, com infraestrutura e autoridade reais. Até o run terminar e os artefatos serem inspecionados, os critérios correspondentes permanecem pendentes. Se houver falha de boot ou dependência externa, registrar a falha observada e seu owner; não substituir a aplicação por um harness que passe.

Ela não cobre a matriz de finance/HR/budget owner/viewer, cenário Headcount completo, import/export, os novos renderers Overview/Versions ainda sem montagem pelo owner WP01, nem SessionV2.prompt, SkillLoadReceipt e GNATIVE. Inicializar um host real não equivale a executar uma sessão residente. As pendências próprias de interação devem continuar `PENDING_UI_PROOF`; falta de teste próprio não deve ser rotulada automaticamente como bloqueio externo.
