# Conferência offline da reconciliação

Estes scripts usam somente Python padrão e arquivos exportados por GitHub MCP. Não importam produto, não acessam rede, não executam testes, typecheck, guards nem CI. Um `PASS` significa integridade mecânica do censo.

## Entradas fixadas

Obter por GitHub MCP, preservando bytes, no commit `dbf9547211d9b0fade619790de7c19c0869b7c7d`:

- `modules/sucafina/Sucafinav1/docs/sf2h-plan/campaign.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/proof-map.json`

O hash obrigatório de `campaign.json` é `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. O arquivo grande pode exigir `fetch_blob` pelo blob `71b56906f8bb190c4d568f60c7511ce1ff63d5f3`. Não substituir conteúdo vazio retornado por um endpoint limitado.

## Executar a conferência

Os nomes de entrada abaixo são caminhos locais escolhidos por quem exporta. O script recusa IDs/textos alterados, duplicações e redução do universo.

```bash
python script/sf2h/coverage-reconciliation/canonical.py \
  --campaign /tmp/sf-census-input/campaign.json \
  --proof-map /tmp/sf-census-input/proof-map.json

python script/sf2h/coverage-reconciliation/verify_census.py \
  --campaign /tmp/sf-census-input/campaign.json \
  --proof-map /tmp/sf-census-input/proof-map.json \
  --census modules/sucafina/Sucafinav1/docs/sf2h/receipts/coverage-reconciliation/20261114T191555Z
```

## Conferência ampliada e envelope de publicação

`--source-cache-index INDEX.json` confere os ponteiros literais das matrizes publicadas e os blobs dos corpos baixados. O índice tem formato `{ "SOURCE-ID": { "cache_path": "/caminho/local/arquivo.json" } }`. Os IDs, URLs, commits, paths e blobs a exportar estão em `sources.json`. O índice local não é uma fonte de autoridade; cada corpo deve corresponder ao blob fixado. Na produção deste censo foram verificados **1.560 ponteiros de linhas publicadas** e **253 corpos contra o Git blob**. Os 50 critérios de campanha são conferidos diretamente no canônico.

`--changed-files COMMIT.json` aceita a resposta MCP de um commit/compare com `files`, ou uma lista de paths. Exige somente adições nos dois namespaces autorizados. Use o **delta do commit evidencial contra seu pai**, porque a branch `intel-resume` já continha produto. O diff inteiro da PR contra `sf2-control` inclui ancestrais preservados e não é o envelope desta missão.

`--files-manifest FILES.json --repo-root RAIZ` confere os SHA256 dos artefatos entregues. `--output resultado.json` grava um novo recibo local; não sobrescrever recibos publicados de tentativa anterior.

`files-manifest.json` exclui a si próprio e `verification.json` para evitar referências circulares. O resultado da conferência não é somado a testes de produto nem usado como percentual de conclusão.

## Significado dos estados

`implemented`, `integrated`, `proven` e `accepted` são eixos distintos. `PARTIAL` identifica contribuição delimitada, sem fração numérica. `UNKNOWN` identifica falta de observação suficiente e não ausência de código. `NO` exige contraprova no pin indicado. `NOT_ACCEPTED` preserva a falta de aceite final do candidato C. Estados antigos ficam em campos históricos; não alimentam as contagens de avaliação atual.
