# Handoff — audit-sf-20261119

SHA: snapshot auditado 2dcbd93a41608e171dfde8896e0721a42fbede6d.
Data: 2026-11-19
Estado: partial

## Feito
- Executado o manifesto original de unidades, sem exclusões adicionais, em workflow temporário isolado; nenhum sf-ci foi despachado.
- Inventário persistido em docs/handoff/unit-audit-44585817131.md: 119 falhas observadas nos oito shards SF, além de quatro APP-BROWSER. São observações parciais, não coverage ou recibo de sucesso.
- CI-CLI, CI-APP-SRC e CI-ATLAS-BUSINESS terminaram com SUCCESS.

## Pendente
- docs/handoff/unit-audit-44585817131.md:1 contém cada arquivo/linha e erro observado que ainda exige correção ou vínculo ao gate posterior.
- Shards1/3/4/5/6 cancelados no limite original; não foram completamente executados. Shards2/7/8 e APP-BROWSER terminaram com falhas.

## Decisões e justificativas
- Nenhuma asserção removida, tempo aumentado, aprovação concedida ou evidência de sucesso produzida por esta auditoria.
- O gatilho da auditoria temporária passou de push para workflow_dispatch ao persistir os resultados, evitando repetir automaticamente oito shards com causas já conhecidas. O workflow sf-ci e o manifesto não mudaram. Não integrar este workflow na branch de produto.
- URLs de inscrição presentes em mensagens de erro foram redigidas no inventário; só erros e localizações de diagnóstico são publicados.

## Como retomar
Resolver os grupos de causa compartilhada do inventário, usar os specs estreitos correspondentes e registrar os runs posteriores; concluir os gates antes do único sf-ci final em sf-join-four.

## Comandos e resultados
- [44585817131](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44585817131): FAILURE. Detalhes reais por job no inventário. Nenhuma alegação de GO.
