# HANDOFF — sf-reports-audit

## SHA e estado

- Estado: **PARTIAL — leitor preparado; qualificação por Actions pendente**.
- Branch: `sf-reports-audit`.
- Código deste leitor: `a0246ca32fc45c87ec9762813bf8e97b954b78cc`.
- Tree do código: `9e02e60c19909ac130845f3137c6955afc2e0419`.
- Pai: `e94758b9ffef236cee7ef7ca8d5638f3ea800a18`, handoff do leitor anterior.
- Parser herdado e já exercitado: `e15713126fc6a75c5d15bfaf43c7ea46904751c3`; aceita os atributos repetidos do snapshot AI de Playwright 1.59.1.
- Nenhum gate, PR, merge ou replay de produto foi executado por este agente. Commits usam `[skip ci]`; root centraliza Actions.

## Evidência original fixada

| Campo | Valor confirmado |
| --- | --- |
| Repositório | `gustavomhss/Orchestra-SF` |
| Run | [44668834875](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668834875) — failure, 0/4 Reports |
| Job de teste | `136064632432` |
| Job de limpeza | `136068663037` — success |
| Snapshot do gate | `cf75dc20a4e42b6945ef4beadffcfc903a323ab3` |
| Código pai do snapshot | `6b0af4a38e15d98b82d37c6479ca0695fe50292f` |
| Artefato | `14598804475`, `playwright-ubuntu-24.04-1` |
| Tamanho ZIP | `361100` bytes |
| Digest publicado pelo GitHub | `sha256:da103f3cb2af36383236a38fc21af5b169f7db049fc201276de6710bebd1c5fa` |
| Criação | `2026-11-20T03:47:22Z` |

A metadata foi consultada pelo conector GitHub e conferida antes da escrita. O digest acima é o digest real publicado, não um valor calculado ou promovido por este agente. A nova leitura por Actions ainda deverá registrar a verificação/download do ZIP. O snapshot difere do código pai somente pela requisição `app/playwright`, config `e2e/playwright.production.config.ts`, spec `e2e/sucafina/reports.spec.ts`.

## Falhas conhecidas antes da leitura

Os typechecks SF E2E passaram. Os quatro casos de produto falharam:

| Caso | Evidência nos logs originais | Limite |
| --- | --- | --- |
| RPT-01 | `reports-support/retained-response.ts:41:17` / `:77:62`: matching browser request failed or was cancelled, durante o step de preparação/preservação | O erro estático não identifica a operação nem a ordem de captura/cancelamento |
| RPT-02 | `reports-support/review-flow.ts:109:29`: UI48 ausente após a navegação original à revisão preservada | O contexto de erro deve discriminar fallback F01 versus montagem; o seletor existe na UI |
| RPT-03 | Timeout original de `180000ms`, seguido de cancelamento reportado pelo retainer | Cancelamento após o timeout não prova a causa inicial; não atribuir mensagens de teardown à falha |
| RPT-04 | `reports-support/retained-response.ts:41:17` / `:90`: matching protocol request failed or was cancelled | O erro estático não identifica qual operação foi cancelada |

Os caminhos de código da tabela têm prefixo `packages/app-shell/e2e/sucafina/`. Esses pontos permanecem **unbound** até existir causa suficientemente vinculada à evidência. Nenhuma asserção, timeout ou fence de cancelamento foi removida ou relaxada.

## Alterações e limites do leitor

1. `apps/cli/audit-reports-retained.node-smoke.mjs`: troca os pins para este artefato; inclui `retained-response.ts` na lista fechada de localização; classifica as mensagens estáticas de cancelamento; lê os quatro caminhos exatos de `error-context.md` registrados pelo job.
2. `.github/workflows/test-ci.yml`: troca somente os seis valores/pins nos passos já existentes de metadata e download do diagnóstico Reports. A seleção exata da requisição diagnóstica permanece igual.
3. Este handoff: registra fonte, limites, request e retomada.

A leitura de snapshots continua restrita ao fence **Page snapshot**. As partes Error details/Test source podem conter o seletor esperado e nunca são usadas para declarar uma UI presente. Nenhum DOM, label desconhecido, valor de campo, corpo, URL, credencial, identificador de registro ou mensagem de erro livre sai do parser.

As novas chaves de landmarks usam somente texto exato do código original:
- `packages/app-shell/src/i18n/orchestra-chapters/sf-u25.ts` e `reviews/agenda/index.tsx`: controles de descoberta, seleção, prévia e confirmação; mensagem de preservação confirmada.
- `packages/app-shell/src/i18n/orchestra-chapters/sf-u32.ts` e `reviews/preserved/index.tsx`: UI48, preparação de revisão, prévia, confirmação e sucessora disponível/bloqueada.
- Contexto/F01/SfStatePanel e relatório mantêm a whitelist do leitor já verde.

`markerCounts` conta somente coincidências exatas dos papéis e labels autorizados. Não é contagem de registros privados. A presença de `Sign out` indica o controle do provider, não prova admissão da rota. Ausência de landmark não prova ausência de componente. O leitor não cria um `data-phase` que o snapshot ARIA não gravou.

O relatório HTML com ZIP embutido permanece preferido quando contém um único relatório válido de quatro casos. O fallback é o JSON original `test-ci-evidence/playwright-runtime.json`, vinculado pelo `request.json` original ao snapshot, plataforma Linux/x64, pacote, diretório, runner, config e spec exatos. Casos, linhas do spec, projeto Chromium e retry0 são conferidos. Ausência de steps continua `not-recorded`.

Os steps emitidos mantêm somente fases, categorias, APIs e locais fechados, duração e classes de erro. O índice é a ordem de travessia da hierarquia gravada: **não prova cronologia de Network/Fetch nem se getResponseBody terminou antes de requestfailed**. Os erros do retainer não gravaram identificadores/etapas de captura; nenhuma ordem não observada será sintetizada.

## Revisão estática relacionada, sem correção presumida

No código `6b0af4a`, o transporte web JSON de Reviews passa o sinal do consumidor em `native/transport.ts:419`. `readJsonBounded:886–911` cancela o reader somente por excesso do limite de32MiB e executa apenas `releaseLock()` no finally; `execute:509` limpa a entrada de mutação. Não há `finally controller.abort()` nesse caminho. O abort incondicional do caminho desktop bytes não é executado neste gate web.

A Agenda aborta descoberta/comando ao substituir a operação, mudar seleção/geração ou desmontar. A revisão preservada aborta a leitura no cleanup de seu effect. Não foi demonstrado um loop causal de estado local a partir da leitura síncrona de `discover`. O elemento UI48 fica fora do SfStatePanel e a ausência pode ocorrer antes da montagem; somente os logs não distinguem esses motivos.

A comparação com `sf-ui-c02@edcda3b3eef5318e69bab9601dd63ace540469df` e a integração `124d5b5c7fbc4a7a57edc0fe1420d38496402a48` não encontrou mudança posterior em Agenda/preserved que feche por si só essas falhas. O handoff da UI também registra UI48 ausente depois das correções de origem privada. Não portar tip inteiro como alegação de fix sem causalidade.

Reports usa o CLI real com NodeHttpServer em4174. A correção `idleTimeout:0` do wrapper Bun de WP04 tem evidência própria em Operations, mas não é uma correção vinculada ao listener usado por este Reports.

## Verificação realizada

- Acesso somente GitHub; nenhuma execução local/shell/browser.
- Readback integral de parser e workflow publicado confere com o conteúdo proposto.
- Compare `e94758b9..a0246ca3`: exatamente dois paths de código; parser +60/-20, workflow +6/-6.
- Nenhum código de produto, retainer, spec, baseline, coverage, freeze, digest de campanha ou autorização foi alterado.
- Actions deste leitor: **não executado**.
- Resultado do produto: permanece **0/4** no run original, sem nova alegação de qualificação.

## Como retomar

Root deve revisar o diff e, se aprovado, criar seu snapshot diagnóstico contendo esta requisição:

```json
{
  "package": "cli",
  "directory": "apps/cli",
  "runner": "node",
  "args": ["audit-reports-retained.node-smoke.mjs"],
  "env": {"ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER": "1"}
}
```

Reter `AUDIT_REPORTS_RETAINED_SOURCE`, os quatro `RESULT`, os quatro `CASE_CONTEXT` e `SUMMARY`. A conclusão success significa somente que a evidência original foi lida com os fences declarados; não qualifica Reports, ingresso, produto, baseline ou pacote.

Se as classes/landmarks ainda não vincularem a causa, registrar o limite como unbound e não repetir gate idêntico. Qualquer futuro fix precisa preservar os quatro casos, os corpos originais, a identidade exata da resposta e os fences de cancelamento. Nenhum replay/refetch/mock, GO, deploy ou marcador de pacote verificado foi introduzido.
