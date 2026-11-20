# Handoff — sf-ops-current

SHA: 25bca572d434bf00322b0fc0ef1e4c834e15888d (último commit de código; o commit deste handoff é posterior)
Data: 2026-11-20T02:28:50Z
Estado: partial

## Feito

- Preparada uma composição de integração isolada, sem gate, PR ou merge. Nenhum produto, UI, helper ou assertion recebeu nova implementação neste recorte: os deltas autorizados foram reconciliados por ancestry e blobs do GitHub.
- Primeiro parent real: UI congelada `f34b80103f91cc9c075f9679cb9030e5258a1793`, tree `810493dc6ed55dfb86fe5c778bd12739ec7857ac`.
- Segundo parent real: shared integrado `392cecab68288d4b669828adc5d1aaa738693d80`, tree `9d9dd276263907dc86245842d3d495272be0f3ab`.
- Fonte do recorte Operations: `sf-ops-transport@a235a2d5ff69638bd8463cfe08e549811424b9cd`, código `d8c62c802bc420d0e01ed23938070f7f4c8b68de`, sobre base `fba289d484d0c0ff2463cbc26ab587777516a8db`.
- Código composto: `25bca572d434bf00322b0fc0ef1e4c834e15888d`, tree `36374520a1bd3c22ec37909154856ec9d495ea2b`.
- GitHub compare contra a UI congelada confirmou43paths:20de código Operations,17shared (incluindo a documentação de guard),5de infraestrutura preservada e1handoff de origem. Todos os43blobs coincidem integralmente com as fontes previstas. Este handoff é o único path adicional do commit documental.
- Compare contra392cecab confirmou merge-base392cecab e zero commits atrás. Readback de runtime.ts e do select-profile atual coincidiu exatamente com as respectivas fontes.

### Reconciliação de três vias

O ancestral comum da UI congelada e da base do recorte Operations é `f1e8aa1c8b622cb99e6ee5e49bb049fe77264de4`.

As comparações GitHub `f1e8aa1...f34b8010` e `f1e8aa1...fba289d` demonstraram que nenhum dos20paths Operations foi modificado em qualquer uma dessas duas evoluções. O delta exato `fba289d...a235a2d5` pôde, portanto, ser aplicado sem conflito, mantendo os20blobs de código de a235. Não se substituiu a árvore da UI pela árvore antiga de Operations.

Também não há sobreposição desses20paths com os17paths shared de `f7dd58e32bc834f1485df20b91adbf759b4c4ad0...392cecab`. Os shared foram preservados integralmente e aparecem na ancestry real do commit composto.

Permanecem os deltas posteriores do dono:

- `63c9a0d7fb26a244327b1f5b30ac8adae213760b`: seleção do perfil real no Home antes de montar o owner, com fases diagnósticas fixas e confirmação após reload.
- `24054686cb119f193738da11a28664bea7d88213`: isolamento da sincronização Settings e materialização dos dados.
- `f34b80103f91cc9c075f9679cb9030e5258a1793`: parser Word que valida rótulos de continuation antes de reconstruir os valores capturados.
- Requests/CAS de f1, incluindo preservação de drafts após409/422 e de edições realizadas durante save; C05, preserved/answer e lost-created-thread-read também permanecem da UI congelada.

A única reconciliação intencional com um arquivo posterior da UI é o ingresso Reports em production-installation.ts: fica a implementação4174 original de40f/fba, expressamente solicitada pela integração. A alternativa7554 da UI não reintroduz listener4110 nesta composição.

### Recorte Operations preservado

O porte mantém exatamente:

- Materialização plain de valores revisados com structuredClone(unwrap(...)), usando o mesmo conteúdo no digest e no codec de envio, além dos fences originais.
- Omissão de opcionais undefined, conversão numérica das estimativas e do total da cotação.
- Metadados de CAP26, seleção request e attachments publicados pelo produtor original; controles nativos de supplier assets e leitura de versões.
- Helpers Operations de importação, documentos, snapshot, recusas e comparação, com os oráculos e operações originais.
- CDP em response stage que captura os bytes da resposta original e a libera com os mesmos status/headers/bytes. Não se troca a requisição, não se repete comando e não se sintetiza resultado.
- `wp04/host.ts` com `idleTimeout: 0`, listener4174, autenticação/origem/lifecycle originais.
- Bootstrap com os cinco test.step estáticos da fonte. O último label exato é `Operations Requests ready for the original operator`.

Este recorte não conclui que o perfil antigo ou o idle timeout tenham sido a causa exclusiva dos cinco timeouts anteriores. A composição apenas preserva os fixes existentes e atualiza suas dependências de UI/shared para a revisão do integrador.

### Shared preservado e ordem existente

1. #399 — `a5b15b51b78469a054ba97b0e87fd1e36e31f73a`: autoridade original da fixture private-admission, incluindo operations-support/installation.ts.
2. #398 — `589adb7cae06c584e1e51eeac9db7cd24dc987ea`: observações Atlas.
3. #404 — `5efe5a3ff3a2c382a18b28f0d575825eafab5ede`: identidade de acesso estável em ready().
4. #401 — `18a913220a6805bef1c62a58a26a310f991d6a0a`: escopo BI.
5. #402 — `08854f14d83ab12d8665b0e3787881edbfaabd53`: contexto de guard da CI cirúrgica.
6. #400 — `392cecab68288d4b669828adc5d1aaa738693d80`: provas completas da resposta Planner e fixture de acesso.

Esta branch não efetuou nenhum desses merges; eles já estavam presentes no segundo parent.

### Infraestrutura mantida de fba289d

- playwright.production.config.ts: blob42f1dba08502a43e32e48ed76846bb6d2168f205.
- reports-support/fixture.ts: blobd930f147d9c2211a8598a8c276e5d83c5275329d.
- reports-support/production-installation.ts: blob49005d72dc095655a0418ebff6d003752a0e6959.
- wp03/installation-fixture.ts: blobbe901681fcb383a5e23227f822cee66befa6c192.
- reviews/agenda/index.tsx: blobe36ee6c71e1e612e0e81d0ee40eb694d5fc7b43e, com cancelamento do preview pendente.

Reports/Decisions/WP03 conservam seu ingresso real em4174, origem pública original e configuração unificada. O manifesto Operations também exige4174 e o host WP04 permanece nesse listener. Nenhuma execução foi realizada nesta branch, inclusive na porta proibida.

## Pendente

- Diagnóstico do artefato do segundo gate Operations, [run44656358971](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656358971), snapshot `5f2867ccf7ac764e0e714cbe4914ce9300da3965`: a integração relatou cinco timeouts de60000ms. O reader de evidência é trabalho separado; nenhum resultado dele é presumido aqui.
- `unbound(packages/app-shell/e2e/sucafina/operations.spec.ts:13:3)` e demais casos em18:3,23:3,28:3,33:3 continuam localizações do timeout de teste; não identificam a primeira assertion interna. Não é declarado que select-profile seja a causa até haver evidência correspondente.
- Novo gate Operations não autorizado por este recorte e não disparado. A raiz decide sobre gate3 somente após diagnóstico do artefato.
- Qualificação dos dois blobs de #393 deve respeitar a condição própria do PR. Esta composição não satisfaz essa condição por si.
- Guards, typecheck, sf-ci final e pacote permanecem sob coordenação da integração.

## Decisões e justificativas

- Asserções removidas ou alteradas por este porte: nenhuma. Não houve nova revisão de UI, esquema, domínio, fixture grant, timeout de teste ou baseline.
- A composição usa os20deltas Operations aprovados sobre a UI congelada; os dois conjuntos não conflitam. Os arquivos novos do dono permanecem na árvore original.
- Controles inexistentes: nenhum console legado foi recriado.
- Não foram editados runtime/application.ts, suites.json, Schema.Never dos exports, baseline, coverage ou digest.
- Nenhuma escrita em branches protegidas/proibidas. Os commits desta branch usam [skip ci]; não foi criado .ci-run.json.
- Sem GO, deploy ou SF_ORCHESTRA_WEB_PACKAGE_VERIFIED.

### Dependência explícita de teste: #393

Os dois blobs abaixo são incluídos apenas porque já faziam parte da composição de teste Operations:

| Path | Blob |
| --- | --- |
| packages/client/src/sucafina/bindings.ts | dcf4229af5745da305906a2c1f7ce42427fd62bd |
| packages/client/test/sucafina/files-transport226/source-codecs.test.ts | 072a58358f4057526a932d0a22981194e7786612 |

**Esta branch não pode ser usada para integrar #393 indiretamente.** Um eventual gate verde desta composição não substitui todos os checks success exigidos no PR. Até a condição própria estar cumprida, os dois blobs permanecem somente dependência de ensaio; não há autorização para merge em bloco desta branch na integração.

## Inventário dos20paths Operations

| Path | Blob portado de a235a2d5 |
| --- | --- |
| `apps/cli/src/sucafina-product/native-ui/procurement.ts` | `f7f9c9bbab4a1011b18a93fef5e9000270f6d3b7` |
| `packages/app-shell/e2e/sucafina/operations-support/documents.ts` | `40ecc44afc88201345dfbb342b1fc61ef9cb7b6c` |
| `packages/app-shell/e2e/sucafina/operations-support/imports.ts` | `9f50ba7e0386d10acd37d8ac7bf703b333be47ba` |
| `packages/app-shell/e2e/sucafina/operations-support/procurement-comparison.ts` | `fd6e1237736ce05dc2e70740d61b96dbad262998` |
| `packages/app-shell/e2e/sucafina/operations-support/procurement-refusal.ts` | `56cd9d2fde5d234b00879434b668051b7f586169` |
| `packages/app-shell/e2e/sucafina/operations-support/procurement-snapshot.ts` | `1ffe483fc7ba069f919f8cc278267feb5db99e72` |
| `packages/app-shell/e2e/sucafina/operations-support/procurement.ts` | `92a104398875e82a09a46b1e86016cbd783f6939` |
| `packages/app-shell/e2e/sucafina/operations-support/runtime.ts` | `aca4d41ece3c6c03b971c4cbf1b88a88a2f8f764` |
| `packages/app-shell/e2e/sucafina/wp04/host.ts` | `3587d5b44c4e94d2243de1b6e2fa0121468d60a4` |
| `packages/app-shell/src/i18n/orchestra-chapters/sf-u14.ts` | `1b5575458e1a521a3114a4b5dcfa0fff580e42e7` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/forms.tsx` | `e2d01c285bd60ac4a654007aec044bc0dabf54bc` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/model.ts` | `5907aee669ae44367cc61aa028ca135610e20dd3` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx` | `550574f4f4ff5e9aac9e75d93c7524e4709cb610` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/index.tsx` | `480ab4022424ccbf7c1924890ce5218ba040d2fe` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/model.ts` | `2007f544e5f77e5ccf6439589808a7b1a1bacce2` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/suppliers/index.tsx` | `b92d3b324e282a9511c349f79ae4f701cd1e8b2c` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/suppliers/model.ts` | `6536b7cf8bcb72b09a87a922f0168d38a9098017` |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/attachments/bound-assets.tsx` | `fcd382816615d1aeaf67585805903863fadb7e58` |
| `packages/client/src/sucafina/bindings.ts` | `dcf4229af5745da305906a2c1f7ce42427fd62bd` |
| `packages/client/test/sucafina/files-transport226/source-codecs.test.ts` | `072a58358f4057526a932d0a22981194e7786612` |

## Como retomar

1. Partir de sf-ops-current, código25bca572d434bf00322b0fc0ef1e4c834e15888d, seguido deste handoff.
2. Concluir a leitura do artefato14594546715 do run44656358971. Digest de referência do artefato original: sha256:623d31906142b886aeb3401aed58bd2b9e5ed809a7709726366e13c17e59a2a1. Esse digest identifica evidência diagnóstica, não pacote ou baseline.
3. A raiz deve confrontar a etapa observada com a diferença concreta da UI/shared congelados. Não repetir o gate anterior apenas porque a composição tem novo SHA.
4. Se a raiz determinar que o novo snapshot contém a correção causal pertinente, criar um único gate com o request abaixo, respeitando até dois gates simultâneos. Este handoff não inicia nem pré-aprova essa execução.

```json
{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/operations.spec.ts"]}
```

5. Registrar resultado real por caso, primeiro erro/etapa efetivamente observados e artefato. Manter partial até o gate correspondente success e a dependência #393 estar tratada sob sua própria condição.
6. O sf-ci único final, guards contra origin/dev e pacote congelado continuam no integrador.

## Comandos e resultados

- Leitura/composição/readback: somente GitHub.
- `bun typecheck` (app-shell): não executado.
- `bun run check:guards --base origin/dev`: não executado.
- `bun run test:ci` sobre este SHA: não executado.
- Verificação estrutural:43paths exatos;43blobs idênticos às fontes; parents reais [f34b8010,392cecab]; zero commits atrás do shared congelado; runtime e select-profile relidos e idênticos.
- CI/Actions novo: nenhum run, job ou artefato produzido por este recorte.
- sf-ci: não disparado; sem resultado por job para esta composição.
- Baseline: nenhum criado/editado.
- Pacote/sha256 de distribuição: nenhum.
- Ordem de merges efetuados por este recorte: nenhuma.
