# SF88 — resultados reproduzíveis e handoff à 71

**Branch:** `export-visual-proof` • [PR #93](https://github.com/gustavomhss/Orchestra-SF/pull/93) (draft), planejamento fixo `dbf9547211d9b0fade619790de7c19c0869b7c7d`.

## Evidências produzidas no GitHub Actions

- [R1 / run 43677064008](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43677064008): original produtor `240bc92e4356b0691b5dcee1dd4edfeb574e2474`, snapshot `d4242ca2061b3a8f2c9c488fbae825af6abaa8e0`, artifact `14146647934`. 13 originais, 123 páginas; reader FAIL por sentinel JSON, links da galeria inicial incorretos. Conservamos esta prova como leitura histórica **nova**, não como cópia do run66.
- [R2 / run 43677729466](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43677729466): source `dc2e7c84`, snapshot `4cf4a552`, artifact `14147640872`. Reader COMPLETED; 13 originais, 130 páginas, nove folhas OOXML e 196 links válidos. CSV ainda truncado na visualização HTML derivada.
- [R3 / run 43678123870](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43678123870): source `a1be5ae4e7e934ca1c47674ee0b166cc560e2b31`, snapshot `a952f1b3ce48b15473f4b07810e79efd05d759fd`, artifact `14146978247`. **Reader COMPLETED**, 13 originais, 140 páginas, nove views de sheets, 206 links válidos/zero quebrados. Os CSVs largos têm visões verticais reais e legíveis.
- [MATRIX-14.json](./MATRIX-14.json): identifica exatamente as 14 observações historicamente solicitadas, com os 14 arquivos físicos **novamente gerados** (inclui duas instâncias realmente distintas de `composed-docx` entre R1 e R3, não falsifica 14 casos únicos). W/S/run/artefato/hash por arquivo.

Arquivos originais e manifestos são descarregáveis nos artefatos Actions acima, dentro da retenção GitHub (7 dias), incluindo `_inspection/gallery/index.html`, imagens PNG, PDF de inspeção, `fonts.txt`, `pdfinfo.txt`, `extracted.txt` e `manifest.json`. **Não** foram modificados os bytes dos originais; todos os checks SHA-256 antes/depois coincidem. Não classificar PNG de conversão como arquivo exportado originalmente.

## Vereditos sem mistura

| Aspecto | Resultado |
|---|---|
| Reader dos seis formatos | **PASS técnico no run R3** |
| Integridade de bytes | **PASS** (13/13 em R3, e R1 duplicado validado) |
| Testes funcionais | **FAIL: 12 pass, 2 fail**, 14 testes / 1.723 assertions. Revogação pós-leitura e side effect persistente do read-only |
| QA visual | **INSPECIONADO COM FINDINGS**, não aprovado |
| FINAL independente | **NÃO ASSINADO** |
| GLOBAL_RELEASE | **NÃO** |

Veja [FINDINGS-R1.md](./FINDINGS-R1.md), [RESULTS-R2.json](./RESULTS-R2.json), [RESULTS-R3.json](./RESULTS-R3.json) e [HANDOFF-88.json](./HANDOFF-88.json). Nenhuma correção de exporter, layout48, application86, scanner75 ou dispatcher45 foi feita nesta lease.
