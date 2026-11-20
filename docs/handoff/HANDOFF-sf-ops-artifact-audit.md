# Handoff — sf-ops-artifact-audit

SHA: fdd865713166454c46250e9066380aef2bc52879 (código do diagnóstico; este documento é um commit posterior somente de documentação)
Base congelada: 392cecab68288d4b669828adc5d1aaa738693d80 (sf-join-four)
Branch: sf-ops-artifact-audit
Data: 2026-11-20T02:27:00.511Z
Estado: partial
Escopo: diagnóstico isolado de evidência já produzida; não é gate 3 de Operations, não qualifica produto e não é candidato a integração.

## Feito

- Preparado leitor Node do relatório HTML retido de Operations2, sem import de produto, Playwright/browser, rede no parser, processos filhos ou replay.
- Reutilizado o formato do leitor de evidência anterior em `8d42f7c8dd4c21f47b819fdd32e9bfa8fb00a649`, cujo run `44651646714` terminou success. O novo parser ainda não foi executado; esse sucesso histórico não o qualifica.
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
- Estado causal: `unbound` até inspecionar as etapas já retidas. Este leitor não altera timeouts, assertions, concessões, respostas ou o produto.

## Artefato fixado

- [Artifact 14594546715](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656358971/artifacts/14594546715)
- Nome: `playwright-ubuntu-24.04-1`
- Tamanho: `2075937` bytes
- Digest declarado pelo GitHub: `sha256:623d31906142b886aeb3401aed58bd2b9e5ed809a7709726366e13c17e59a2a1`
- O workflow compara esse digest à metadata atual antes do download. O action pinned faz o download e sua validação própria; o parser recebe arquivos extraídos e não alega recalcular o SHA do ZIP original.
- Nenhum baseline é criado ou atualizado. Nenhum `sf-ci`, pacote, GO, deploy ou `SF_ORCHESTRA_WEB_PACKAGE_VERIFIED` está associado a este diagnóstico.

## Saída permitida e limites

O parser abre somente o `index.html` retido e o ZIP de relatório embutido. Lê `report.json` e JSONs de arquivos com nomes hexadecimais. Não abre attachments, DOM, error-context, screenshots, stdout/stderr ou traces.

A saída aceita somente:

- IDs fixos `OP-PROC-01/02/03`, `OP-IMPORT-01`, `OP-DOC-01`.
- Status enumerado, duração numérica, retry zero e contagens.
- Cinco nomes fixos de `test.step` de Operations, categoria e apiName por allowlist.
- Posições de código apenas quando o caminho corresponde à allowlist de arquivos reais do E2E de Operations.
- Classes fixas de erro; nunca mensagens, GUIDs, títulos arbitrários, snippets, URLs/querystrings, corpos, parâmetros, cabeçalhos, cookies ou credenciais.
- Primeiro nó com erro registrado na ordem DFS, último nó anterior nessa ordem registrado sem erro e um recorte limitado das demais. `recorded-without-error` descreve o relatório, sem inventar uma prova de conclusão externa.

Tamanho de HTML/ZIP/JSON, quantidade de entradas, árvore, profundidade e quantidade de passos são limitados. Arquivos simbólicos são recusados. Erros internos inesperados viram uma mensagem fixa, evitando serialização de dados do artefato pelo reporter TAP. O leitor exige exatamente cinco árvores detalhadas; se o formato não corresponder, falha fechado e não infere a fase.

## Validação e revisão

- Revisão estática do diff feita por GitHub: dois arquivos de código alterados, sem alteração de produto.
- Workflow: 49 linhas adicionadas; sem remoções do workflow canônico.
- Parser: `apps/cli/audit-operations-retained.node-smoke.mjs`.
- Revisão independente de `reports_failure`: sem bloqueio de vazamento ou contrato. Removida uma entrada inexistente da allowlist; nenhuma ampliação de leitura.
- `firstRecordedError` e `lastBeforeFirstRecordedError` seguem a ordem DFS da árvore, não uma ordem temporal comprovada. O primeiro nó com erro pode ser um `test.step` pai que contém a falha.
- `file:line` é extraído do relatório após validar caminho permitido e limites numéricos. O leitor não compara o conteúdo dessa linha ao snapshot fonte; essa confirmação cabe à triagem posterior.
- Actions do diagnóstico: não executado. Guards: não executados por esta entrega. A mudança temporária de workflow não é destinada a merge.
- `sf-ci` por job: não aplicável; este diagnóstico usa apenas o runner Node cirúrgico se o integrador autorizar sua execução.
- Pacote/sha256 de pacote: não aplicável. O digest acima pertence exclusivamente ao artefato Playwright original.

## Como retomar

1. O integrador revisa esta branch e cria um snapshot temporário de CI cujo único delta sobre o HEAD seja o request abaixo.
2. Executa somente o leitor Node. Não selecione `operations.spec.ts`, Playwright ou qualquer código de produto.
3. Leia as linhas `AUDIT_OPS_RETAINED_SOURCE`, `AUDIT_OPS_RETAINED_RESULT` e `AUDIT_OPS_RETAINED_SUMMARY`. O sucesso significa apenas que a evidência existente foi lida com esse contrato.
4. Compare a primeira fase não concluída/erro registrado com o código do snapshot original. Só então proponha uma correção causal e um futuro gate de produto separado.
5. Não mergeie esta branch nem inclua seus arquivos na composição ou no pacote final.

Request canônico:

```json
{"package":"cli","runner":"node","args":["audit-operations-retained.node-smoke.mjs"],"env":{"ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER":"1"}}
```
