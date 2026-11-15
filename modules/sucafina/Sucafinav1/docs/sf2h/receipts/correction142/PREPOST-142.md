# Correção142 — preimages, postimages e patch de integração

**Fonte de material:** `d5dde5ba4f1cb98162bf99cc1391ebb328dee987`, PR #105, branch `xlsx-print-layout`, epoch `xlsx-layout-e2-browser142`.
**Consumidor inspecionado:** `sf2-stack@49da652cc093c6c392f43e89a58eb839640ddafd` (móvel; 132 deve revalidar imediatamente antes de aplicar). **Patch completo:** `PATCH-132.diff` (Git blob `ef79c594fb3ba1cabf114ceda1a1ae5989f93411`), contra as preimages reais do consumidor, não contra o arquivo da fonte102.

| Path (sob `modules/sucafina/Sucafinav1/`) | Preimage consumidor (C64 e HEAD verificada) | Preimage fonte142 | Postimage fonte142 | Ação132 |
|---|---|---|---|---|
| `runtime/workbooks.ts` | `3884ad35c7b471d2805d7444d24c4143b86ce197` | `567042ed8fadf2f1354947a60df8ababe332ae1d` | `2cae2a7f0a8b76f4759572099d8e27729c698b98` | Aplicar hunks 102+142; não copiar inteiro de fonte |
| `runtime/downloads.ts` | `7fa9c254c7c08b894d8b4c3336653c32b6270126` | `ac73b9edc44bd5c8a616ce583084969d2a69e771` | `ac73b9edc44bd5c8a616ce583084969d2a69e771` | Incluir somente print settings da versão102, preservados pela142 |
| `test/product/xlsx-print-layout/print-layout.test.ts` | AUSENTE na HEAD consumidora | `041ed70f302f0b0f4d13c6e8bea07f19e85f4c49` | `c53bdee17904f5a5e082ee9f2cae3b209c9002b5` | Novo arquivo completo como mostrado no patch |

## Correções sem alterar business data
- VIS131-001: OPEX repete colunas A:I (Line ID, Cost element, Vendor/item, Description, Owner, Entity, Allocation, Currency, Measure); CAPEX repete A:K (até Currency e Measure). Linha1 e intervalo usado mantidos. As folhas conservam A3 paisagem, fitToWidth=2, height=0, ordem sobre/abaixo.
- VIS131-002: Info coluna A 44 e B 94, alinhamento superior/wrap, alturas calculadas inclusive A22:B28, mantendo textos, listas e ordem.
- VIS131-003: Vendor/item e Description recebem wrap e altura de linha derivada, sem transformar strings iniciadas por '=' em fórmula. Descrição é preservada integralmente no XLSX; legibilidade do PDF depende de prova hospedada.
- Nenhuma edição feita pela142 em downloads, parser, importadores, filtros, ACL, contratos, schema, fórmulas ou dados financeiros. A mudança de print em downloads da102 continua necessária em C.

## Entrega e qualificação
- ACK `bb9eb8db77ee1fac829567164170d40b3046fe54`.
- Produto `4a8cfaab6153c1154fe8b773c276d1648d39f838`; regressão `d5dde5ba4f1cb98162bf99cc1391ebb328dee987`.
- Fonte e teste novo: **AUTHORING_COMPLETE, NOT_RUN**. Não há novo W/S/run/job/artifact, PDF/PNG ou aprovação131/132.
- Risco ainda aberto: repetição de 9/11 colunas em duas páginas A3 pode produzir escala imprópria em LibreOffice/Excel. 129 deve comprovar renderização real dos dois segmentos e de cada cenário; se clipping/escala for constatado, devolver finding à142 sem declarar aceitação.
- A prova do C64 anterior não é transferível ao novo C; 132 publica ACK de consumo real do material, 128 compila o C coerente e 129 executa CI cirúrgico existente. `GLOBAL_RELEASE=false`; Goal pausada; PR draft; DOCX fora do escopo.
