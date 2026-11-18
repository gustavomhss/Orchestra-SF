# A1 — CI-11: custo, filas e duração observada (2026-11-16)
**Instrumentação:** GitHub Actions run/jobs e tempos `started_at`/`completed_at`/steps via GitHub MCP. Números **observados no histórico, não SLA**, e `runner-min` abaixo é **soma de durações dos jobs**, não invoice oficial do GitHub nem medição de CPU.

## Amostra histórica (SHAs diferentes, produto RED)
| Run / ref | Estado exato | 12/59 jobs | Wall (run_started→updated) | Soma job runtime estimada | Comparabilidade |
|---|---|---:|---:|---:|---|
| [43958796792](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43958796792), PR #242 head `2f94d74d`, merge checkout `31955bc3` | `completed/failure` | 12 | **13m07s** (787s) | **29m58s ≈29,97 runner-min** (1798s) | baseline lean RED atual |
| [43951326271](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43951326271), `2b386661` | `completed/failure` | 12 | **12m20s** (740s) | **28m19s ≈28,32 runner-min** (1699s) | lean anterior, não SHA igual |
| [43942492490](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43942492490), `92e230c2` | `completed/failure`; SF longo/cancelado | 12 | **31m32s** (1892s) | **65m02s ≈65,03 runner-min** (3902s) | outlier/escopo evolução, SF inacabada |
| [43917342527](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43917342527), Epic `0cc73cdd` | `completed/failure` | 59 jobs retornados | **45m36s** (2736s) | **322m39s ≈322,65 runner-min** (19359s) | **NÃO COMPARÁVEL**: EPIC cross-OS amplo, diferente de Web/Linux SF |

**p50/p95:** `INSUFFICIENT_SAMPLE`. Há apenas duas execuções lean recentes completas utilizáveis e **zero runs PRODUCT_CI_GREEN**; cada uma usa SHA distinto. Sem distribuição estacionária, valor p50/p95 seria enganoso. **Custos em USD:** `UNKNOWN` — não há tarifa/accounting do plano/runners disponíveis, nunca inferir invoice por minuto.

## Decomposição run 43958796792
Run início 21:18:50 UTC; primeiros runners iniciam 21:19:30–31 → fila inicial **≈40–41s** (não inclui espera entre matrices). Último job `sf/verify` 21:31:56. Soma individual aproximada a segundos (timestamps GitHub).
| Lane | Job runtime | Evidência focalizada |
|---|---:|---|
| preflight | **103s** | setup Bun **73s**; negative Linux selector sucesso |
| static/contracts | **215s** | setup Bun **41s**, checks generated **28s**, typecheck **122s** **failure**; Web build **skipped** por falha real |
| Omni Linux | **48s** | `omni-binaries` **27s** e upload artifacts |
| unit CI-SF | **139s** | setup Bun 69s, suíte **46s**; `--bail=5` após falhas reais |
| unit CI-CLI | **84s** | setup Bun 53s, seleção 7s, **success** |
| unit CI-APP-SRC | **64s** | setup Bun 32s, seleção 18s, **success** |
| unit CI-APP-BROWSER | **61s** | setup Bun 37s, seleção 6s, **failure** |
| unit CI-ATLAS-BUSINESS | **62s** | setup Bun 37s, seleção 12s, **success** |
| UI-OPERATIONS | **160s** | Chromium **20s**, spec **88s**, **failure** |
| UI-DECISIONS | **330s** | Chromium **22s**, spec **242s**, 180s de timeout em um caso |
| UI-REPORTS | **508s** | Chromium **20s**, spec **437s**, 2×`locator.fill` timeout 180s |
| verify | **24s** | **fail-closed** upstream `static/unit/ui=failure` |

**Critical path observado:** UI-REPORTS ocupou 508s de job, começou após outra lane UI em 21:23:02 (matrix `max-parallel:2`), encerrou 21:31:30; `sf/verify` depende de UI e só iniciou 21:31:32. Assim o maior custo de parede do último run está em dois timeouts de 180s por input oculto; corrigir a jornada real (A4), não aumentar timeout ou reduzir assertions. Otimização de setup Bun pode ser avaliada por A2/A6 **após** produto estar verde e comparável; nenhum ajuste feito A1.

**Regra de medição futura:** selecionar ≥5 runs verdes do **mesmo C/config sem cancelamentos**, coletar timestamps de fila, setup, build realmente executado, Omni, oito suites completas, verify, total jobs, attempt, alterações de manifesto; só então p50/p95 de wall e runner-min, comparável com Epic por escopo qualificado. Registrar sensibilidade a concurrency/cancel-in-progress e cold-cache sem confundir runner work com billing.
