# Proposta inerte para o teste legado BI10

Estado: **INERT_OWNER_PATCH_NOT_APPLIED**. O arquivo legado não foi editado.

A missão38 registrou corretamente que BI10 ainda não tinha plano temporal instalado. A missão62 monta o produtor canônico existente; somente a expectativa antiga de séries vazias e timeline ausente precisa acompanhar essa conexão.

`presentation.preimage.txt` é a imagem integral do arquivo no base congelado. `presentation.postimage.txt` é a proposta integral. `proposal.patch.txt` contém o diff e `MANIFEST.json` vincula target, SHA base e digests dos blobs.

O proprietário de composição deve verificar a preimage no HEAD antes de aplicar a proposta. A mudança conserva a exigência de resultado de sensibilidade para BI11, a recusa após mutação da fonte e o orçamento legado de 120.000 ms. Ela não modifica os cálculos, fixtures, outros testes ou o produtor temporal.

A validação desta proposta está **NOT_RUN**. Os novos testes em `test/product/installed-bi-closure/temporal-contract.test.ts` também comparam a apresentação BI10 com o produtor real, preservam BI09 e cobrem o Portfolio persistido. A execução autorizada cabe ao Actions do owner após a composição.
