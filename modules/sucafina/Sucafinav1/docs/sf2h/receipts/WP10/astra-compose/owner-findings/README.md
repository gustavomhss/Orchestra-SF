# Findings de typecheck para os proprietários

Base de todos os patches: produto `ff7a99753d1fd1bc8b68b4f2642fed26e3cadbdf`, árvore `91fdfc7cdf15ad57350ca4c4f2751dfe50daf919`.

Evidência: [Actions 43577846910](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43577846910), job `132395914997`, snapshot de check `ee53445dc8bf49f7148918867eedab0093cc111f`. Sucafina parou em dois erros de parser; CLI emitiu 30 diagnósticos adicionais. O conjunto não prova que todos os erros semânticos do package já foram alcançados.

**Escopo da entrega:** 32 diagnósticos classificados, 13 causas, seis patches propostos em 14 arquivos. Nenhuma alteração de produto aplicada ou publicada. Nenhum teste/typecheck de produto executado localmente. `git apply --check` apenas confirmou a integridade de aplicação dos seis diffs; os hashes originais dos 14 arquivos continuam iguais. Não é revisão independente e não é aprovação de escopo.

## Grupos

| Grupo | Owner | Diagnósticos | Resultado |
|---|---|---:|---|
| astra-interface / #31 | WP01 | 2 | Patch de label e body para AlternativeDraft, somente leitura |
| astra-operations / #34 | WP04 | 2 | Finding de wiring de review proof; requer owner, sem stub |
| astra-operations / #34 | WP06 | 1 | Patch do tipo local de retorno de preview backup |
| astra-finance / #35 | WP11 | 14 | Patch de uniões discriminadas, generic transacional e narrowing redundante |
| AI residente | WP12 | 2 | Patch de estado refinado no callback e tipo do read de recuperação |
| Portfolio | WP13 | 8 | Patch de duas chaves de fixture, narrowing de falha e guards no callback de threshold |
| Decision memory | WP14 | 3 | Patch de tipo da binding e chamada à API real resolver.resolve |

## Verificação dos heads dos novos grupos

Leituras realizadas exclusivamente por GitHub MCP, fixadas em SHA:

- #31 `903bcee2e007809f7614a7fff39dd5019f7f7733`: `product/ui/components.ts` e `product/ui/contribution-body.ts` idênticos à base ff7a997; ambos os diagnósticos continuam aplicáveis.
- #34 `de6959db82dbe48bd59e3d012ff668a86347a6cd`: `product/procurement/decision-host.ts` e `product/imports/dashboard.ts` idênticos à base; os três diagnósticos continuam aplicáveis.
- #35 `8184761b61f78d6aeac73232fdc879e93f85bc5e`: `product/decisions/alternative-replay.ts`, `mutations.ts`, `prepared-apply.ts` e `proposals.ts` idênticos à base; os 14 diagnósticos continuam aplicáveis.

O head anterior de #34 `91e1f60bc6f7e85517e2b4f963eec5ac7da13e62` tinha outra implementação do preview backup. A comparação desse head antigo não comprova correção do head atual; ele reintroduziu o adapter de ff7a997.

## Finding que precisa implementação do owner WP04

`product/procurement/decision-host.ts:168` não passa `reviewDigestFor` a `createSfPreparedApply`; `:187` não passa `reviewDigestFor` nem `revalidateProducer` a `createPreparedExecution`.

O producer de revisão já calcula e devolve `reviewDigest`. O cache Procurement descarta esse campo e guarda somente `changeDigest/expiresAt`; a autorização humana atual vincula somente o request sem o digest de revisão. Conectar callbacks constantes ou tornar os hooks opcionais eliminaria a prova exigida por WP11 e não é aceitável.

O owner deve preservar o digest efetivamente revisado, vinculá-lo ao payload/grant da confirmação humana, fornecer esse mesmo digest pela admissão privada e revalidar o producer antes da primeira aplicação. Receipt/retry precisa manter a mesma vinculação e detectar digest diferente no mesmo idempotencyKey. Não foi preparado patch automático porque duas propriedades adicionadas às factories não corrigem toda essa semântica.

Casos propostos em Actions: revisão correta; digest trocado/expirado; alteração material entre revisão e aplicação; retry idêntico de receipt; troca de review no mesmo idempotencyKey; revogação de ACL; mudança de principal/incarnation. Os seletores existentes constam em `findings.json`.

## Dependências explícitas

- WP13: corrigir as duas chaves é pré-requisito para o typecheck semântico de Sucafina. Podem aparecer diagnósticos adicionais depois desse desbloqueio.
- WP14: `test/product/wp14/source-access-procurement.test.ts` ainda usa a API antiga do resolver: imports removidos `procurementSourceSelector` e `isCurrentProcurementSource`, factory sem `scopedSources` e chamada do resolver como função. Migrar essa fixture para `issue`/`resolve` e fontes com escopo antes de usar seu resultado como evidência. O patch entregue cobre os três diagnósticos de produto, não declara a fixture executável.
- UI: completar a fixture de cobertura para AlternativeDraft pronto e não pronto, preservando escape de conteúdo e a diferença entre total completo e subtotal conhecido.
- Todos os patches precisam de review do owner e `bun typecheck` nos packages afetados por GitHub Actions, seguido somente dos seletores materiais. Nenhum epic foi disparado.

## Arquivos

- `findings.json`: diagnóstico individual com owner, path, linha/coluna, código/mensagem, causa, remedy, seletores propostos e patch.
- `patch-manifest.json`: SHA256 de cada patch e hashes dos arquivos de base e propostos.
- `patch-integrity-checks.json`: verificação de aplicação de diff e preservação dos arquivos de base.
- `wp01-ff7a997-typecheck.patch`, `wp06-ff7a997-typecheck.patch`, `wp11-ff7a997-typecheck.patch`, `wp12-ff7a997-typecheck.patch`, `wp13-ff7a997-typecheck.patch`, `wp14-ff7a997-typecheck.patch`.
- `remote-source-snapshots.json` e `current-group-snapshots.json`: conteúdos retornados por MCP e blob SHAs usados na reconciliação.

Próxima ação: encaminhar aos owners dos grupos atuais; consumir commits publicados depois de reconciliar os mesmos arquivos, fixar novo head/tree e executar somente checks Actions necessários no novo produto.
