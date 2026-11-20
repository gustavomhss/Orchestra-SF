# Handoff — sf-reports-artifact-audit

## SHA e estado

- Estado: **PARCIAL — duas leituras da evidência concluídas com success; correção causal do formato AI preparada, ainda não executada**.
- Branch: `sf-reports-artifact-audit`.
- Base do leitor já executado pela integração: `12dd4126441861fb62f9306a3fa7ff0a1b47c656`.
- Código inicial executado: `63ea031a5ed0771b0c2d0403b483154d0ed0dc2b`.
- Tree inicial: `a7669b98e0b37dbe2eb532a7bfc0123199a1e647`.
- Código da extensão autorizada: `4ed5cbfdc8952fa3d48367f43d2f9a1339d22ffb`.
- Tree da extensão: `3687ad05f7f4567c9101c81d130f3c7ea381276e`.
- Código da correção do formato AI: `e15713126fc6a75c5d15bfaf43c7ea46904751c3`.
- Tree da correção AI: `a257e7bce19ee1fa179087c346845e642c684dc3`.
- Parent da correção AI: `d5ab5f44414afb2853a1227861a90f5d10363379`.
- Parent da extensão: `4f1093aafcfd65c9720e265684b79af4aa86a157`, head anterior com handoff.
- O commit posterior acrescenta somente este handoff. Nenhum PR, merge ou gate foi criado por este agente.

## Evidência original congelada

| Campo | Valor confirmado pelo conector GitHub |
| --- | --- |
| Repositório | `gustavomhss/Orchestra-SF` |
| Run | `44660375065` |
| Job original | `136036842660` |
| Snapshot | `4cdba6118ff547d9ed23cd5cdb284e55e218d675` |
| Código pai do snapshot | `4ccf99576e6886b178c5502fc02bfa41bef6730c` |
| Artefato | `14596071954` |
| Nome | `playwright-ubuntu-24.04-1` |
| Tamanho | **365836 bytes** |
| SHA-256 declarado pelo GitHub | `2c1bb49b65772852b63c762a632ea6b12acfddf5bfd6c7088a9ae47d9a4eb488` |

A consulta `fetch_workflow_run_artifacts` confirmou também `expired: false` e a associação ao run/snapshot acima. O workflow confrontou novamente esses campos antes do download por ID, com a action fixada em SHA. Na execução diagnóstica abaixo, o download calculou o SHA-256 do ZIP e o log de 03:03:42.1014314Z confirmou exatamente `2c1bb49b65772852b63c762a632ea6b12acfddf5bfd6c7088a9ae47d9a4eb488`. Isso é a integridade do artefato original; não é baseline, digest de pacote nem qualificação do produto.

## Causa que motivou o diagnóstico

O run original terminou com quatro falhas. RPT-01 chegou à exportação depois da preservação e edição real de janeiro, mas `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:415:24` não encontrou `[data-sf-surface="UI50"]`. RPT-02 falhou ao obter o corpo original de preview em `review-flow.ts:140:38`; RPT-03 e RPT-04 falharam no corpo original de discovery em `review-flow.ts:40:37`, com `Network.getResponseBody` sem dados para o identificador.

A leitura estática do código congelado excluiu uma ausência simples de rota, formulário ou operation ID: `reviews-route.tsx:46–57` exige `dashboard.dashboard-review`, `reviews.report.prepare` e `files.export.review`, já observados por `report-health.ts`. `review-report` é o `fixedQuery.sf` do prepare. UI50 existe fora do painel de disponibilidade em `reviews/reports/index.tsx:211`; o frame insere seus children sem condição em `shared/frame/index.tsx:240–242`. Isso ainda não distingue uma recusa/resolução F01 de uma exceção de render no run real.

O `ECONNREFUSED` do proxy apareceu no encerramento do caso; não foi promovido a causa do desaparecimento de UI50. A primeira leitura usou o `error-context.md` original de RPT-01, já retido no artefato, sem repetir o produto. Seu limite e a extensão preparada estão registrados abaixo.

## Mudanças e fronteiras

1. `apps/cli/audit-reports-retained.node-smoke.mjs`: adaptação do leitor de Operations já existente. Lê somente o artefato baixado. Reconhece os quatro casos RPT-01..04 e, no fallback JSON, exige as linhas originais 26, 41, 107 e 123, Chromium, retry zero e resultado único.
2. `.github/workflows/test-ci.yml`: acrescenta seleção exata da requisição diagnóstica abaixo e dois passos condicionais: conferência de metadata e download fixado. Os passos do diagnóstico Operations permanecem intactos.
3. `docs/handoff/HANDOFF-sf-reports-artifact-audit.md`: este registro.

O leitor procura o relatório HTML com ZIP embutido e usa o JSON de runtime original se não houver um único relatório HTML válido. O fallback exige o `request.json` original com SHA, plataforma Linux/x64, pacote, diretório, runner, config e spec exatos. Ausência de steps permanece `not-recorded`.

A classificação de UI lê somente o fence `Page snapshot` do caminho original de RPT-01. O texto de `Test source` e `Error details` não é usado para afirmar que um controle esperado apareceu. A saída contém apenas códigos de labels conhecidas do F01, landmarks de Report/Agenda/meeting e da página de erro; categorias conhecidas de exceção; status/duração; nomes de `test.step`/API numa lista fechada; e `file:line:column` de paths do repositório permitidos. Ausência de um marcador não é prova de ausência do estado. Nenhum DOM, corpo de resposta, credencial, URL, identificador de review/principal/instalação ou erro bruto é impresso.

Este código não importa o produto, inicia browser/listener, faz request/replay de negócio, modifica dados, cria grants ou muda qualquer asserção. Nenhum uso do listener proibido. `reviews.export.docx/pptx` continuam `Schema.Never`; bytes de relatórios continuam vinculados ao GET original `?sf=review-download`. O fix CDP de retenção original pertence a outro recorte e não está neste branch.

## Merges, checks e pacote

- Ordem de merges deste recorte: nenhuma.
- PRs: nenhum; o diagnóstico temporário não qualifica merge de Reports.
- Verificação feita: leitura do diff inicial e da extensão, readback exato no GitHub, leitura dos logs do diagnóstico inicial e confirmação dos dois jobs por API.
- Actions: root executou os diagnósticos `44664962509` e `44666329606`, ambos com success. Nenhuma Action disparada por este agente. A correção causal do formato AI ainda não foi executada; root controla uma eventual leitura posterior do mesmo artefato.
- Guards: não executados neste recorte; nenhum resultado de guards é alegado.
- `sf-ci`: não executado; reserva de uma única corrida final continua com a integração.
- Baseline/coverage: nenhum alterado ou fabricado.
- Pacote/SHA-256 de pacote: não aplicável ao diagnóstico; nenhum pacote, GO, deploy ou marcador de verificação emitido.


## Execução diagnóstica inicial — concluída

- Run: [44664962509](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44664962509), **success**, concluído em 2026-11-20T03:03:54Z.
- Snapshot: `afcced9264525fa3ca98120c4040f4804f301544`; branch `ci-run-linux-sfc-reports-evidence`.
- Job `test (ubuntu-24.04)`: **136051899120 / success**; job `cleanup`: **136052376370 / success**.
- Leitor Node: **1 pass / 0 fail**. Nenhum cenário do produto foi executado novamente.
- Inventário: 13 arquivos; um HTML com ZIP embutido, nenhum relatório embutido válido para o contrato esperado; fallback para o JSON de runtime original e seu request original validado.
- Quatro casos originais reconhecidos; somente RPT-01 tinha `test.step` registrado. Ausência de steps nos outros casos não foi preenchida.

| Caso original | Resultado e duração | Evidência original |
| --- | --- | --- |
| RPT-01 | failed, 129115 ms | preservação 52697 ms e edição de janeiro 56050 ms concluídas sem erro registrado; fase DOCX 10317 ms com `expected-element-not-found`, `review-flow.ts:415:24` |
| RPT-02 | failed, 17673 ms | `response-body-unavailable`, `review-flow.ts:140:38`; sem steps |
| RPT-03 | failed, 13649 ms | `response-body-unavailable`, `review-flow.ts:40:37`; sem steps |
| RPT-04 | failed, 14403 ms | `response-body-unavailable`, `review-flow.ts:40:37`; sem steps |

O fence `Page snapshot` de RPT-01 existia. A whitelist inicial reconheceu somente `context-toolbar`; não reconheceu marcador de F01, Report ou erro de render. **Ausência de marcador não prova ausência do estado nem identifica a causa de UI50.** O resultado continua `qualification: none`, `productReplay: false`; não há promoção de Reports ou dos seus quatro cenários.

## Extensão da whitelist — executada no segundo diagnóstico

A revisão do código no snapshot original `4cdba6118ff547d9ed23cd5cdb284e55e218d675` identificou lacunas concretas no leitor inicial:

| Fonte congelada | Lacuna corrigida no leitor |
| --- | --- |
| `host/owner-runtime231.tsx:264–270` e `sf-context.ts:11–18,35–42` | controles `Refresh access` e `Sign out` e mensagem de falha de saída não estavam classificados |
| `shared/states/index.tsx:48–52` | a copy é conteúdo de parágrafo dentro de status/alert; nós de snapshot `text` eram descartados mesmo se contivessem exatamente uma copy conhecida |
| `reviews/reports/index.tsx:212–218,225–267` e `sf-u33.ts` | faltavam os estados oficiais sem review/origem indisponível/resultado desconhecido e os labels traduzidos dos controles Report |
| `reviews/preserved/index.tsx:230–245,308,397` e `sf-u32.ts` | faltavam o heading da review preservada, estados do produtor e navegação de origens autorizadas |
| `reviews/agenda/index.tsx:272–275,355–362` e `sf-u25.ts` | faltavam os estados oficiais de fonte indisponível, leitura sem preservação, vazio, filtro vazio e resultado desconhecido |

A extensão modifica somente `snapshotMarkers` (**+42/−17 linhas**). Amplia a lista fechada de tipos para 16 e emite suas contagens; os nomes são constantes e os valores são apenas números. As mensagens continuam comparadas por igualdade com literals EN/pt-BR provenientes das fontes acima. Nenhum texto livre, atributo de identidade, URL, DOM ou corpo é emitido. O fence, caminho exato, limites de leitura, binding do request, metadata, SHA-256, download e fallback permanecem idênticos.

`Sign out` é condicionado ao estado **ready do provider** no código congelado. Sua eventual presença, com o toolbar, só evidencia esse estado renderizado: **não prova que a rota Report foi admitida, que UI50 montou ou que o relatório é exportável**. `Refresh access` existe em todos os estados de MountedSurface e tem poder discriminante menor. Contagens de tipos e labels também não são prova de capability ou operação. A extensão não presumia que o snapshot original usasse nós `text`. O segundo diagnóstico registrou zero desses nós; portanto esse acréscimo não revelou a mensagem omitida. A investigação posterior encontrou o defeito distinto de atributos AI abaixo.


## Segundo diagnóstico — concluído, causa do produto ainda aberta

- Run: [44666329606](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44666329606), **success**, concluído em 2026-11-20T03:15:11Z.
- Snapshot: `e61c091f5985ac15389d9989339defd4370edcd7`; source `d5ab5f44414afb2853a1227861a90f5d10363379`.
- Job `test (ubuntu-24.04)`: **136056412433 / success**; job `cleanup`: **136056714173 / success**.
- Leitor Node: **1 pass / 0 fail**. Mesmo artefato **14596071954**, **365836 bytes**; SHA-256 calculado novamente no download às 03:15:00.3972927Z: `2c1bb49b65772852b63c762a632ea6b12acfddf5bfd6c7088a9ae47d9a4eb488`.
- Mesmo fallback JSON original, mesmos quatro resultados e localizações de erro; nenhum replay do produto.
- Marcadores classificados: somente `context-toolbar`; `renderErrors: []`.

Contagens fechadas do `Page snapshot`:

| Tipo | Quantidade |
| --- | ---: |
| generic | 59 |
| paragraph | 1 |
| status | 1 |
| toolbar | 1 |
| button | 44 |
| region | 1 |
| navigation | 1 |
| main | 1 |
| heading, alert, textbox, combobox, text, link, list, listitem | 0 em cada tipo |

Essas contagens não revelam rótulos, estado de autorização nem causa de UI50. Mesmo com 44 botões reconhecidos como nós, nenhum dos dois controles do contexto foi classificado pelo extrator anterior. Isso motivou revisar a gramática do formato usado pela versão real do Playwright, sem rodar produto.

## Defeito concreto do extrator AI — correção preparada

O catálogo em `package.json` no snapshot original fixa `@playwright/test` em **1.59.1**. Na fonte oficial dessa mesma versão:

- [playwright/src/index.ts](https://github.com/microsoft/playwright/blob/v1.59.1/packages/playwright/src/index.ts), linha719, produz o contexto de erro com `page.ariaSnapshot({ mode: 'ai', timeout: 5000 })`.
- [injected/src/ariaSnapshot.ts](https://github.com/microsoft/playwright/blob/v1.59.1/packages/injected/src/ariaSnapshot.ts), linhas593–625, acrescenta atributos de estado, `[ref=…]` e, quando cabível, `[cursor=pointer]` após o nome do nó.
- O mesmo serializer, linhas657–661, produz texto inline depois da chave completa, incluindo seus atributos.
- [playwright/src/errorContext.ts](https://github.com/microsoft/playwright/blob/v1.59.1/packages/playwright/src/errorContext.ts), linhas67–75, coloca essa saída no fence `Page snapshot` já selecionado corretamente pelo leitor.

Em `audit-reports-retained.node-smoke.mjs@d5ab5f44:139`, a expressão de nome admitia no máximo **um** atributo. Em `:140`, o texto inline só era reconhecido se o restante começasse imediatamente por dois-pontos; atributos anteriores impediam sua classificação. São incompatibilidades concretas com o serializer fixado. Elas demonstram uma lacuna do parser, **não demonstram qual mensagem está no artefato nem a causa de UI50**.

A correção `e1571312` altera somente essas duas extrações e acrescenta comentários: aceita atributos repetidos após o nome e remove somente os grupos de atributos iniciais antes de procurar texto inline. Whitelist, igualdade de literals, tipos emitidos, contagens, paths, metadata, tamanho/digest, limites, fallback e fronteira `Page snapshot` permanecem iguais. Nenhum atributo, nome desconhecido ou conteúdo bruto é impresso. Não houve execução local nem Action por este agente.

A fonte oficial também deixa explícito que o snapshot é capturado de `context.pages()[0]` durante o tratamento da falha (index.ts:705–721). Logo, mensagens eventualmente reconhecidas são evidência desse snapshot; não são uma captura instrumental garantida do instante exato da asserção.

## Contexto do dono e pontos ainda unbound

Foi lido `docs/handoff/HANDOFF-sf-ui-c02.md` em `sf-ui-c02@667cdefd62ddd482136f521f6e8cccdd32d3b1b2`, checkpoint de 2026-11-20T03:15:28.121Z, código declarado `1fbdfda8a710e2c92f3c7566e7971946a90a341f`, estado **partial**. O dono registra que seu run44664883769 preservou/releu em RPT-02 e parou antes de montar UI48, enquanto outros três casos falharam no corpo de discovery. Isso é contexto de outra fonte/corrida e não prova a causa de UI50 no artefato analisado. Nenhuma UI, fixture, porta, grant ou asserção desse dono foi portada neste diagnóstico.

- **unbound(packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:415:24)** no código original `4ccf99576e6886b178c5502fc02bfa41bef6730c`: UI50 não encontrada.
- A mesma asserção preservada está em **review-flow.ts:377** no código de retenção `18e995771879cb67c144c87b61e7d17c6df9e917`. Essa correspondência foi relida; não é um novo resultado de execução.
- Nenhum dos dois diagnósticos qualificou Reports, exportação Office ou resolveu a causa de montagem. Não há nova execução de produto autorizada por este handoff apenas para observar.

## Como retomar

Após revisar a correção concreta do formato AI, root pode criar um snapshot `ci-run-linux-*` do novo head desta branch, acrescentando somente `.ci-run.json` com:

```json
{
  "package": "cli",
  "directory": "apps/cli",
  "runner": "node",
  "args": [
    "audit-reports-retained.node-smoke.mjs"
  ],
  "env": {
    "ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER": "1"
  }
}
```

Reter as linhas `AUDIT_REPORTS_RETAINED_SOURCE`, `RESULT`, `RPT01_CONTEXT` e `SUMMARY`. A próxima leitura, se root a executar, tem a correção concreta do formato AI; lê o mesmo artefato original, sem novo Playwright ou inicialização do produto. Seu sucesso significa somente que o artefato foi lido sob as guardas declaradas. Interpretar controles e mensagens no escopo documentado; se ainda faltar informação suficiente, manter `unbound(review-flow.ts:415:24)` explícito.

Não repetir um gate idêntico de Reports por este diagnóstico. Integrar somente correções concretas com a qualificação correspondente, preservando os quatro cenários originais e a autoridade real.
