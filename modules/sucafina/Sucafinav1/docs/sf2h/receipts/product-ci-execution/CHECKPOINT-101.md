# Missão101 — resultados de CI de produto no C51

**Resultado real:** seis runs GitHub Actions Linux no **mesmo material** C51 `529142f63683de8e4b1f7d4232f88faf8ffcef6c` / árvore `d679b541596dab3b280a87e15e4a0b29ee518262`: **4 SUCCESS / 2 FAILURE**. Há **46 testes aprovados**, **1 falha de contrato de produto** e **5 erros de importação de módulos** (nenhum comportamento nativo executado). Atribuição reproduzida por logs, não inferida de status. Não há qualquer teste local.

| Seleção | Run (attempt 1) | Job | Testes | Veredito |
|---|---:|---:|---|---|
| HTTP94 | [43682386656](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43682386656) | 132715603251 | 7 PASS / 0 FAIL (201 expect) | **SUCCESS** |
| FIRST_SAVE87 | [43682448571](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43682448571) | 132715780313 | 12 PASS / 1 FAIL (213 expect) | **FAILURE** |
| DENIED_READ97 | [43682451927](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43682451927) | 132715790691 | 5 PASS / 0 FAIL (944 expect) | **SUCCESS** |
| DOCX98_TYPOGRAPHY | [43682453714](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43682453714) | 132715796194 | 8 PASS / 0 FAIL (124 expect) | **SUCCESS** |
| DOCX98_READER88 | [43682455278](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43682455278) | 132715801639 | 14 PASS / 0 FAIL (1756 expect) | **SUCCESS** |
| NATIVE90_COMPONENT | [43682450677](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43682450677) | 132715786509 | 0 PASS / 5 FAIL (0 expect) | **FAILURE** |

Cada branch `ci-run-linux-sf101-c51-*` contém **só** `.ci-run.json` contra C51. W/S/tree/request blob, ordem exata dos arquivos, runtime/config, job e cleanup constam de `RUNS-101.json`. O Omni positive control é **N/A nesta seleção focal** (não executado, nem alegado PASS).

## Bloqueadores encaminhados

- **87:** `minimal-first-save/first-save-recovery.test.ts:269` esperado `[503,403,403,403,403,403,400]`, observado `[503,403,403,403,403,503,400]`, falta de Idempotency-Key retornando 503 em vez de 403. [Writer87 informado](https://github.com/gustavomhss/Orchestra-SF/pull/92#issuecomment-6889947700).
- **90:** cinco imports falham por `observeSfRoutineNative` indisponível em `routine-native-origin.ts` (e referência `timeoutMs` sem declaração inspeção C51). [Writer90 informado](https://github.com/gustavomhss/Orchestra-SF/pull/96#issuecomment-6889948153).
- [PR65 informada](https://github.com/gustavomhss/Orchestra-SF/pull/65#issuecomment-6889948537). Não houve alteração de produto, fixtures, testes, workflows, oráculos nem rerun de P03.

## Exportações / inspeção (três vereditos separados)

- **Funcional:** `DOCX98_READER88` 14 PASS / 0 FAIL / 1756 expect, e `DOCX98_TYPOGRAPHY` 8 PASS / 0 FAIL / 124 expect.
- **Render técnico:** reader88 `COMPLETED` em run43682455278, job132715801639; [artifact 14148499941](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43682455278/artifacts/14148499941) de 16.053.071 bytes; **12 casos atuais obrigatórios**, 12 PDFs, **139 PNGs**; 25 originais (incluindo manifests) não sofreram mutação pelo reader. LibreOffice 24.2.7.2 / Poppler 24.02.0. Manifesto `_inspection/manifest.json` SHA-256 `e562aeb561e48e5dd205227b44b29e3e35fbba52f8e14bdb001d9bc4cbf46fb6` contém os hashes completos das páginas e originais; amostra/hash originais na `RUNS-101.json`.
- **Inspeção visual independente:** **PENDENTE (VIS88-001)**. Nenhuma assinatura visual 91/93 é transferida de geração de PDF/PNG, nem essa sessão aprova a própria autoria. Não declarar que o título ficou visualmente correto sem inspeção humana/independente.

`composed-docx` SHA-256 `e76815d22f0ad16726fc3187c63df46bce87b17847cee66498389253160e1d2a`; `after-drift-docx` SHA-256 `1473f074ba6efdca1bef4d6352050a93d31b5841f29acaad93d86c23d2458c31`. Página1 PNG `composed-docx` `a38c1885efa56de778d5e7ab3175e83839f83c8745233a4e6991d81389152727`, `after-drift-docx` `d2339517c9bc1f0616c885dd8b6c80d62dbe15bf2d7dc734a3ced07f0c7e4bd8`. Outros hashes preservados no artifact/manifest imutável e identificados pelo SHA.

## Autoridades e próximo checkpoint

O HEAD atual da `sf2-stack` após C51 possui **somente três commits documentais posteriores**; o produto testado permanece C51. Entretanto a **integradora100 encerrou explicitamente sua lease** em `AUTHORITY-TERMINAL-100.json` sem sucessor: **S0 deve nomear integrador sucessor** antes de integrar novos patches. 45 segue responsável apenas por compiler/typecheck/guards;101 é dispatcher de produto e não toca CI45. Retestes87 e90 somente quando novo W material/patch causal estiver oficialmente integrado. Esperar95/96/99/102 conforme suas dependências e nunca reexecutar P03 original sem mudança de causa.

**Estado final desta evidência:** C51 NÃO ACEITO; P03 FAIL/OPEN; MI07/M31 e Native Installed OPEN; eight final selections, epic, G7/G8, AM01–06 e reviews ainda não aprovados. **GLOBAL_RELEASE = false.**
