# Pós-checkpoint100 — P03 original falhou (delta append-only)

Checkpoint base `38124138d21289a3bd20c86cd8d4e9c78c157417`. A corrida99 antes descrita como in_progress terminou **completed/failure**: [run 43681302722](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43681302722), job `132712328135`, S `c9c38cbf92844dcbdfbdc543fb6b378b241817f4`. `0 pass, 1 fail, 1 error, 24 expects`, duração 180,26s. Falha `Omitted-training portfolio: {"status":"stale","reason":"portfolio-selection-changed"}` em `semantic-union-source-scenario.test.ts:50:44`; timeout separado 180000ms no cenário training confirmed. O original preserva 72 asserts e test blob `47b5358c`.

Os 21 PASS/232 expects do R1 fonte99 não qualificam P03 nem C51. Source99 (W `41744d18`) **não integrado**, nem o result-store W76 reaplicado. Witness encaminhado ao [writer99 PR95](https://github.com/gustavomhss/Orchestra-SF/pull/95#issuecomment-6889836370) e [dispatcher45 PR32](https://github.com/gustavomhss/Orchestra-SF/pull/32#issuecomment-6889836685). Rigor: sem aumentar timeout, relaxar oráculo, alterar fixtures ou duplicar run.

O candidato material continua C51 `529142f63683de8e4b1f7d4232f88faf8ffcef6c`, tree `d679b541596dab3b280a87e15e4a0b29ee518262`; GLOBAL_RELEASE=false. A45 e owner99 são dependências externas comprovadas.
