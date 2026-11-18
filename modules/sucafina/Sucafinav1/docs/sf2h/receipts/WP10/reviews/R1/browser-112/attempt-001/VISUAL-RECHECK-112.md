# Missão 112 — parecer visual independente (tentativa 001)

**Ator:** S1-R1, nova sessão de revisão visual, sem autoria dos exporters/readers. **Branch:** `export-visual-recheck`. **Lease:** `visual-review-browser112`. **Escopo:** receipts neste próprio prefixo; nenhum produto, teste, reader, workflow ou CI alterado. **Modelo observado:** GPT-6; session ID não exposto, não inventado.

## Proveniência e integridade

- Plano imutável `dbf9547211d9b0fade619790de7c19c0869b7c7d`; C51 `529142f63683de8e4b1f7d4232f88faf8ffcef6c`; C53 `180212940105e7b9ad15171b067c1c1b7841df5f`.
- Hosted run [43682455278](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43682455278), job `132715801639`, artifact [14148499941](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43682455278/artifacts/14148499941). Snapshot CI `243bb2bcb8145f18e47a5dcd5ef638e2bfc5cef0` has product-source parent C51.
- ZIP SHA256 `ac15e48914aef2e5d496f48c6136901432cda499caa82f8954851d1c748461e1` matches GitHub artifact digest; ZIP CRC valid. Manifest `_inspection/manifest.json` SHA256 `e562aeb561e48e5dd205227b44b29e3e35fbba52f8e14bdb001d9bc4cbf46fb6`.
- 12 new mandatory cases present; 12 PDFs and 139 PNGs; 25 original entries all verified with SHA256 + size in both before/after manifests; originals byte-identical. No historical artifact reused by this reader. Hashes of every inspected PNG and the two PDFs/original DOCX appear in `EVIDENCE-112.json`.

## Fontes e método de inspeção real

**Composed DOCX:** `_inspection/file-0003`, DOCX `e76815d22f0ad16726fc3187c63df46bce87b17847cee66498389253160e1d2a`, PDF `c3d3907dd9fb8971c23b1dcde86c20c6bd2a358411ac320c6451b1b4e718be7c` (15 páginas).

**After-drift DOCX:** `_inspection/file-0001`, DOCX `1473f074ba6efdca1bef4d6352050a93d31b5841f29acaad93d86c23d2458c31`, PDF `6c77c9633335a0c2dc2b8d95873fe1c12b9ace474374d9f7320e5d6a36fafbc9` (15 páginas).

Abri os PNGs **p1, p2, p3** dos dois documentos (além de p4/p15 de after-drift e p14/p15 de composed) em tamanho real. Avaliei p1–p15 de cada um em montagens visuais; também verifiquei geometricamente todas as páginas contra seus PDFs. Houve re-renderização PDF independente via MuPDF das páginas 1, 2, 3, 14 e 15 de ambos os PDFs; diferenças raster/antialias normais, sem contradição visual material. O arquivo original e não apenas XML foi usado. O PDF emite fontes embutidas `LiberationSans`, `DejaVuSans` e `DejaVuSans-Bold`; **Aptos não foi comprovada nesse Linux**.

- **Páginas 1:** título `Review` e identificador opaco completo `review:6e9ac25cc2621e5771901e434d1fb8c4d785d46f2f6c6c9412a2d73dbb6a9649`; título principal em três linhas de identificador, com espaçamento suficiente até subtítulo, sem sobreposição, corte ou perda de caractere observável. Correção pontual VIS88-001: **PASS visual delimitado**.
- **Páginas 2:** nota sintética longa com Unicode, literais `<scope>`, `&`, sentinela `END-EXPORT-66-NOTE` visível; não houve clipping observado. Primeira seção e início da tabela Forecast visíveis. Cabeçalhos das tabelas se repetem nas páginas subsequentes.
- **Páginas 3–15:** grade e rodapés legíveis, sem palavras extrapolando limites físicos detectáveis nos PDFs (0 boxes fora de página). **FINDING VIS112-001**: as primeiras rows são continuações sem identificação explícita na primeira coluna.
- **Páginas 15:** conclusão da tabela na parte superior, rodapé `Page 15 of 15` regular, espaço inferior em branco normal; nenhum dado visualmente oculto observado.

## Vereditos *separados*

| Dimensão | Veredito | Base/limites |
| --- | --- | --- |
| Funcional selecionado C51 | **PASS delimitado; não FINAL** | Job/test step `success`, 14 testes descritos na PR106; o próprio reader não capturou numeric exit status. Não é oito seleções finais de C53 |
| Render técnico DOCX C51 | **PASS delimitado** | DOCX reais convertidos em dois PDFs de 15 páginas, PNGs, hashes conferidos e fontes incorporadas; sem prova de Aptos nativo |
| Visual VIS88-001 título DOCX98 | **PASS delimitado** | p1 composed e after-drift com ID completo, sem overlap/clipping |
| Continuação de tabelas | **FINDING MEDIUM aberto** | p3–p15 dos dois DOCX, primeira coluna vazia na row continuada |
| Visual global do produto | **NÃO APROVADO** | Há finding, review restante e novo candidato C congelado pendentes |
| XLSX102 print-layout | **NÃO REVISADO** | Não há geração nova 102/107 verificável; samples antigos ficam excluídos |

## VIS112-001: row de tabela sem identificação na página seguinte

Na passagem p2→p3, `license:1:currency-declared: USD` aparece no fim da p2; o período e a referência de origem prosseguem no topo da p3 **com a coluna Captured value vazia**. Repete-se em p3–p15 para ambas as variantes. Os dados continuam recuperáveis pela página anterior, mas é defeito de legibilidade de documento longo. Conferência suplementar do OOXML: 2 tabelas, 169 rows, 2 cabeçalhos repetíveis, **0 `w:cantSplit`**. Local provável: `product/reviews/render.ts:143` (`new TableRow({ children: ... })` sem política explícita de não-fragmentação). Não alterar fonte pelo reviewer; 98 decide correção e emite novo documento real, 106 integra só quando aceito.

Encaminhado por comentário à [PR101](https://github.com/gustavomhss/Orchestra-SF/pull/101#issuecomment-6893556486) e [PR65](https://github.com/gustavomhss/Orchestra-SF/pull/65#issuecomment-6893556872).

## C51 → C53: prova transferível somente em fronteira estável

`529142f6..18021294` é `ahead=6` com 18 paths alterados: reparos de runtime HTTP/autoridade 103–104, testes e receipts. Nenhum exporter/renderer alterado. Blobs iguais nas duas pontas: `product/reviews/render.ts=7010c9e5ec1f5300388408573b5ace1273662070`; `runtime/reports.ts=729a6eeadd72f3ed122cd2ebc94ad8e4b52956c5`. Isso sustenta **reutilização delimitada da observação do título**, não reclassifica o artifact C51 como run C53 nem cobre todos os deltas de runtime, permissões ou ambiente.

## XLSX102 e condição de FINAL

PR105 `xlsx-print-layout`, fonte `e6c524ad6a6196bde1bf69e3f7cdbf049ab086c4`, não possui novo artifact XLSX102/107 na revisão. Os recentes runs de 107 inspecionados foram first-save/native, não geração de XLSX corrigido. **Não aprovar** arquivos históricos de Planner/Members/OPEX por OOXML, conversão histórica ou pagecount. Quando houver output real com manifesto/sha/worksheet, verificar individualmente `Info`, `OPEX`, `CAPEX`, `Headcount`, `Rate cards`, `FX rates`, `All Members`, `Summary by Leader` e template `OPEX`, nos cenários **normal/vazio/largo/longo**, cobrindo legibilidade, quebras, repetição de cabeçalhos, fórmulas e impressão.

**Parecer:** DOCX98 **título visualmente corrigido em evidência C51 reutilizável dentro da fronteira comprovadamente estável até C53**; continuidade das tabelas **VIS112-001 aberta**; XLSX102 **aguarda evidência nova**; **FINAL/global release = não**. Exige candidato C congelado, novo artifact para qualquer fonte corrigida, recheck de deltas e três reviews independentes com gates S0. Nenhum CI ou edição de produto feito nesta missão.
