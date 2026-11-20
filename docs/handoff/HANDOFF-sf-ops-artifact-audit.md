# Handoff — sf-ops-artifact-audit

SHA: a8e030290685ea7ff3b2cea56f6f238b6cf6af25 (código do diagnóstico; este documento é um commit posterior somente de documentação)
Base congelada: 392cecab68288d4b669828adc5d1aaa738693d80 (sf-join-four)
Branch: sf-ops-artifact-audit
Data: 2026-11-20T02:41:31.155Z
Estado: complete (somente diagnóstico de evidência; produto Operations não qualificado)
Escopo: diagnóstico isolado de evidência já produzida; não é gate 3 de Operations, não qualifica produto e não é candidato a integração.

## Feito

- Preparado leitor Node dos relatórios retidos de Operations2 (HTML embutido ou JSON original estritamente identificado), sem import de produto, Playwright/browser, rede no parser, processos filhos ou replay.
- Reutilizado o formato do leitor de evidência anterior em `8d42f7c8dd4c21f47b819fdd32e9bfa8fb00a649`, cujo run `44651646714` terminou success. A primeira versão deste parser falhou na seleção do arquivo HTML; a revisão atual foi executada com sucesso no diagnóstico 44662154584. O sucesso histórico não foi usado como substituto dessa execução.
- Preservado o workflow canônico da base, adicionando somente `actions: read`, um seletor derivado do request exato, uma verificação de metadata e o download pinned condicionado a esse seletor.
- Verificação de metadata exige igualdade de repositório de destino, artifact id, run id, snapshot, digest, nome e tamanho, além de artefato não expirado. Uma resposta ausente ou divergente interrompe o diagnóstico.
- O token de leitura do GitHub é restrito à etapa de metadata e ao action de download. Não é exportado para o parser.
- Download usa `actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093` e somente os IDs fixados abaixo.
- Não foi criado `.ci-run.json`, branch `ci-run-*`, PR, merge ou dispatch. Não houve execução local.
- Nenhum merge efetuado por esta entrega; ordem de merges: não se aplica.

## Evidência original e problema ainda aberto

- Run [44656358971](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656358971): failure.
- Job de produto [136023442295](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656358971/job/136023442295): failure, cinco casos falhos por limite global de 60000 ms. Cleanup `136029633924`: success.
- Snapshot original: `5f2867ccf7ac764e0e714cbe4914ce9300da3965`; código pai: `a235a2d5ff69638bd8463cfe08e549811424b9cd`.
- Typecheck dos E2E, ClamD real e preparação de build passaram. A correção `idleTimeout: 0` já estava no host desse snapshot; o aviso Bun de idle 10 segundos do primeiro gate não aparece no segundo.
- O log de texto não expõe a fase interna nem uma asserção de produto falha. `packages/app-shell/e2e/sucafina/operations.spec.ts:13:3` é a declaração do primeiro caso, não uma asserção.
- O erro posterior `Object with guid response@… was not bound in the connection` não é tratado como causa demonstrada.
- Estado causal após leitura: bloqueio delimitado ao passo de seleção do perfil (`operations-support/runtime.ts:92–94`); a ação ou asserção interna de `native/select-profile.ts` continua não identificada pelo JSON. Este leitor não altera timeouts, assertions, concessões, respostas ou o produto.

## Artefato fixado

- [Artifact 14594546715](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656358971/artifacts/14594546715)
- Nome: `playwright-ubuntu-24.04-1`
- Tamanho: `2075937` bytes
- Digest declarado pelo GitHub: `sha256:623d31906142b886aeb3401aed58bd2b9e5ed809a7709726366e13c17e59a2a1`
- O workflow compara esse digest à metadata atual antes do download. No diagnóstico 44661091906, o action pinned registrou o SHA256 calculado do download com exatamente esse valor. O parser recebe arquivos extraídos e não alega recalcular o SHA do ZIP original; isso não certifica produto ou pacote.
- Nenhum baseline é criado ou atualizado. Nenhum `sf-ci`, pacote, GO, deploy ou `SF_ORCHESTRA_WEB_PACKAGE_VERIFIED` está associado a este diagnóstico.

## Saída permitida e limites

O parser inventaria arquivos sem emitir nomes e considera HTMLs somente sob `packages/app-shell/e2e/playwright-report/`, fora de `data/`. Seleciona pelo ZIP Playwright embutido, não pela unicidade do basename `index.html`. Lê `report.json` e JSONs de arquivos com nomes hexadecimais; exige um único relatório HTML válido com os cinco casos.

Se não houver um relatório HTML válido, o caminho alternativo consome exclusivamente `test-ci-evidence/playwright-runtime.json` e seu `test-ci-evidence/request.json`. A fonte original prova a produção desse JSON em `.github/workflows/test-ci.yml:229–232` e o upload em `:349–352`; o log original registra 51 arquivos e a raiz do repositório como raiz comum do artefato. Isso é evidência de produção/publicação configurada, não uma afirmação de que o HTML esteja ausente.

Antes do fallback, o leitor exige no request original o SHA do snapshot, plataforma Linux/x64, package/directory, runner Playwright, config e o único spec selecionado. Exige cinco casos, arquivo/linhas de declaração correspondentes ao spec original, projeto Chromium e retry zero. Se o JSON não tiver `steps`, emite `stepEvidence: not-recorded`, lista vazia e contagem zero; nenhuma etapa é inferida.

Não abre attachments, error-context, screenshots ou traces. Corpos, stdout/stderr, DOM e campos não permitidos dos relatórios não são percorridos nem emitidos.

A saída aceita somente:

- IDs fixos `OP-PROC-01/02/03`, `OP-IMPORT-01`, `OP-DOC-01`.
- Status enumerado, duração numérica, retry zero e contagens.
- Cinco nomes fixos de `test.step` de Operations, categoria e apiName por allowlist.
- Posições de código apenas quando o caminho corresponde à allowlist de arquivos reais do E2E de Operations.
- Classes fixas de erro; nunca mensagens, GUIDs, títulos arbitrários, snippets, URLs/querystrings, corpos, parâmetros, cabeçalhos, cookies ou credenciais.
- Primeiro nó com erro registrado na ordem DFS, último nó anterior nessa ordem registrado sem erro e um recorte limitado das demais. `recorded-without-error` descreve o relatório, sem inventar uma prova de conclusão externa.

Tamanho de HTML/ZIP/JSON, quantidade de entradas, árvore, profundidade e quantidade de passos são limitados. Arquivos simbólicos são recusados. Erros internos inesperados viram uma mensagem fixa, evitando serialização de dados do artefato pelo reporter TAP. O leitor exige exatamente cinco resultados identificados. Múltiplos relatórios HTML válidos são recusados. Ausência de passos é declarada; ausência ou ambiguidade de um relatório admissível falha fechado. Não infere a fase.

## Validação e revisão

- Revisão estática do diff feita por GitHub: dois arquivos de código alterados na branch; esta revisão muda apenas o parser, sem mudança de workflow ou produto.
- Workflow: 49 linhas adicionadas; sem remoções do workflow canônico.
- Parser: `apps/cli/audit-operations-retained.node-smoke.mjs` (299 linhas na revisão atual).
- Revisão independente de `reports_failure`: sem bloqueio de vazamento ou contrato. Removida uma entrada inexistente da allowlist e corrigido o quinto nome fixo para `Operations Requests ready for the original operator`, exatamente como `operations-support/runtime.ts:95` no snapshot original; nenhuma ampliação de leitura.
- `firstRecordedError` e `lastBeforeFirstRecordedError` seguem a ordem DFS da árvore, não uma ordem temporal comprovada. O primeiro nó com erro pode ser um `test.step` pai que contém a falha.
- `file:line` é extraído do relatório após validar caminho permitido e limites numéricos. O leitor não compara o conteúdo dessa linha ao snapshot fonte; essa confirmação cabe à triagem posterior.
- Primeiro diagnóstico [44661091906](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44661091906), snapshot `3ba359484852e926a9532afed8e83a3d65231dc4`: FAILURE, 0 pass / 1 fail no leitor. Metadata e download SUCCESS. Falha original em `audit-operations-retained.node-smoke.mjs:165`, `EXACTLY_ONE_RETAINED_HTML_REQUIRED`; catch em `:206`. Nenhuma fase de produto foi emitida.
- Correção concreta: substituir a exigência de um único basename HTML pela identificação estrutural do relatório, emitir contagens numéricas antes das guardas e oferecer o JSON original comprovado pela fonte como fallback estrito.
- Actions da revisão atual: SUCCESS no run 44662154584, descrito abaixo. Revisão independente desta revisão (`reports_failure`): concluída sem bloqueio de segurança ou contrato por leitura; nenhuma execução pelo revisor. JSON sem passos não determinaria a fase causal; neste artefato, quatro passos reais por caso estavam presentes. Guards: não executados por esta entrega. A mudança temporária de workflow não é destinada a merge.
- `sf-ci` por job: não aplicável; este diagnóstico usa apenas o runner Node cirúrgico se o integrador autorizar sua execução.
- Pacote/sha256 de pacote: não aplicável. O digest acima pertence exclusivamente ao artefato Playwright original.

## Resultado do diagnóstico corrigido

- Run [44662154584](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662154584): SUCCESS, encerrado em 2026-11-20T02:39:00Z.
- Job `test (ubuntu-24.04)` [136042695847](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662154584/job/136042695847): SUCCESS. Cleanup `136043110713`: SUCCESS.
- Snapshot `7412b83b83a67b78b567214c5238978725ba43a1`, parent `902ddb61cb2fcefb68223a9848acf2525b9db7f8`; compare confirmado com único delta `.ci-run.json`.
- Inventário: 51 arquivos, quatro candidatos HTML, um ZIP embutido não aceito pelo parser; nenhum relatório HTML selecionado. Isso não demonstra corrupção do artefato.
- Formato efetivamente consumido: `original-playwright-runtime-json`, com request original validado.
- Cinco casos identificados, cinco com passos registrados, nenhum replay; saída `qualification: none`.
- Todos os cinco resultados originais permanecem `timedOut`. O sucesso deste diagnóstico comprova leitura da evidência, não sucesso dos testes de produto.

| Caso | Declaração no spec | Enrollment (ms) | Discovery (ms) | Native context admission (ms) | Native profile selection |
| --- | --- | ---: | ---: | ---: | --- |
| OP-PROC-01 | operations.spec.ts:13:3 | 16 | 12 | 296 | duração -1, conclusão não registrada |
| OP-PROC-02 | operations.spec.ts:18:3 | 18 | 17 | 202 | duração -1, conclusão não registrada |
| OP-PROC-03 | operations.spec.ts:23:3 | 16 | 13 | 210 | duração -1, conclusão não registrada |
| OP-IMPORT-01 | operations.spec.ts:28:3 | 17 | 16 | 204 | duração -1, conclusão não registrada |
| OP-DOC-01 | operations.spec.ts:33:3 | 18 | 16 | 203 | duração -1, conclusão não registrada |

As três primeiras etapas estão registradas sem erro. O quarto passo é `Operations native profile selection`; o quinto, `Operations Requests ready for the original operator`, está ausente nos cinco casos. Não há erro atribuído a um passo individual nem passos de API/locator nesse JSON: `firstRecordedError: null`.

Confronto realizado por leitura do snapshot original `5f2867ccf7ac764e0e714cbe4914ce9300da3965`:

- `packages/app-shell/e2e/sucafina/operations-support/runtime.ts:80–91` corresponde à última etapa encerrada; inclui GET do contexto, status 200, decode estrito, status ok e stamp do operador.
- `:92–94` aguarda `selectSfProfile`, cuja implementação original começa em `packages/app-shell/e2e/sucafina/native/select-profile.ts:11`.
- `:95–101` corresponde à etapa seguinte, não registrada.
- A sequência é confirmada pelos `await` no código, não inferida da ordem DFS de uma árvore com erros.
- O helper original navega ao capítulo em `native/select-profile.ts:16` antes de selecionar o perfil. A mudança existente `63c9a0d7fb26a244327b1f5b30ac8adae213760b` seleciona o perfil real na home antes de entrar no capítulo. Ela altera diretamente a função delimitada pela evidência; este diagnóstico não determina qual ação interna antiga ficou pendente nem comprova o resultado da mudança.

O integrador iniciou posteriormente o gate Operations3 [44662419134](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662419134), snapshot `9ea42e72f6aebed5685cd5b2b48df993a1e8f33d`, para a composição com a mudança de perfil. Na última observação desta entrega estava `in_progress`; nenhum resultado antecipado é atribuído a ele.

## Como retomar

1. Reutilize o run de diagnóstico 44662154584 e suas linhas sanitizadas; a extração está concluída. Não repita esse diagnóstico sem uma causa nova e concreta no leitor.
2. O integrador acompanha o gate Operations3 separadamente. Compare qualquer nova falha com seu snapshot exato e preserve a distinção entre a etapa pendente e uma asserção interna identificada.
3. A causa original está delimitada ao bootstrap de perfil, mas a linha interna ainda é `unbound`; não atribua o timeout a Requests, ClamD, grants ou uma operação posterior sem nova evidência.
4. Não mergeie esta branch nem inclua seus arquivos na composição ou no pacote final.

Request canônico:

```json
{"package":"cli","runner":"node","args":["audit-operations-retained.node-smoke.mjs"],"env":{"ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER":"1"}}
```
