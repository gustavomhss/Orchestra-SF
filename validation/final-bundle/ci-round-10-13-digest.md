# Orchestra-SF — digest verificável do histórico CI (solicitação “rounds 10–13”)
**A10/W1 · coleta GitHub Actions em 2026-11-16 (America/Sao_Paulo) · STATUS: HISTORICAL_ONLY / NOT_RELEASE_QUALIFICATION**

**Limite de proveniência:** não há nos arquivos acessíveis um vínculo canônico entre os rótulos internos “round 10”, “11”, “12”, “13” e cada Actions run. Portanto **NÃO** atribuo nenhum dos IDs abaixo a um round numerado, nem completo uma janela de rounds por suposição. Este documento é novo, não uma recuperação de conteúdo inexistente. Referências da campanha consultadas via MCP GitHub:

| Fonte verificável | Branch/head_sha do evento | Event/attempt | Criação→atualização UTC | Status/conclusão global |
|---|---|---|---|---|
| [sf-ci 43951326271](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43951326271) | `sf-ci-lean` / `2b386661a5b389958e93a8f5dd54d44c5d746c09` | pull_request / 1 | 2026-11-16 20:35:16 → 20:47:36 | completed / **failure** |
| [sf-ci 43956369500](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43956369500) | `sf-ci-lean` / `0e4848847b85d3d5f97d03de63574c5461c50cba` | pull_request / 1 | 2026-11-16 21:04:53 → 21:19:28 | completed / **cancelled** |
| [Epic 43917342527](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43917342527) | `sf2-epic-c` / `0cc73cdd9a5736a3cb8e2ef83590ad4dc105f616` | push / 1 | 2026-11-16 17:20:30 → 18:06:06 | completed / **failure** |

`head_sha` acima é o head retornado pela API de run, **NÃO** o `github.sha`/SHA checkout de merge ref; o `github.sha` efetivo, `HEAD^{tree}`, SHA256 dos reports/receipts, artifact IDs e tempos por job não foram coletados. Portanto `CI_HARNESS_VALIDATED=PARTIAL`, `PRODUCT_CI_GREEN=NO`, `AZURE_RELEASE_QUALIFIED=BLOCKED`.

## 1. Conclusões EXATAS dos 12 jobs, por run (GET `actions/runs/:id/jobs`)
| Job | Job ID 43951326271 | Conclusão 43951326271 | Job ID 43956369500 | Conclusão 43956369500 |
|---|---:|---|---:|---|
| `sf/preflight` | [133594581909](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43951326271/job/133594581909) | success | [133612271058](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43956369500/job/133612271058) | success |
| `sf/static-and-contracts` | [133594582423](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43951326271/job/133594582423) | failure | [133612270513](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43956369500/job/133612270513) | failure |
| `sf/linux-native-omni` | [133594582638](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43951326271/job/133594582638) | success | [133612271033](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43956369500/job/133612271033) | success |
| `sf/test-CI-SF` | [133594940355](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43951326271/job/133594940355) | failure | [133612712087](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43956369500/job/133612712087) | failure |
| `sf/test-CI-CLI` | [133594940444](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43951326271/job/133594940444) | success | [133612712098](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43956369500/job/133612712098) | success |
| `sf/test-CI-APP-SRC` | [133594940398](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43951326271/job/133594940398) | success | [133612712109](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43956369500/job/133612712109) | success |
| `sf/test-CI-APP-BROWSER` | [133594940365](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43951326271/job/133594940365) | failure | [133612712024](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43956369500/job/133612712024) | failure |
| `sf/test-CI-ATLAS-BUSINESS` | [133594940341](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43951326271/job/133594940341) | success | [133612712218](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43956369500/job/133612712218) | success |
| `sf/test-CI-UI-OPERATIONS` | [133594940283](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43951326271/job/133594940283) | failure | [133612712031](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43956369500/job/133612712031) | failure |
| `sf/test-CI-UI-DECISIONS` | [133594940496](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43951326271/job/133594940496) | failure | [133612712055](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43956369500/job/133612712055) | failure |
| `sf/test-CI-UI-REPORTS` | [133594940332](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43951326271/job/133594940332) | failure | [133612712038](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43956369500/job/133612712038) | **cancelled** |
| `sf/verify` | [133601324145](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43951326271/job/133601324145) | failure | [133620509546](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43956369500/job/133620509546) | failure |

**Correção factual importante:** `PENDING-WORK.md` registrara Reports como `IN_PROGRESS` na coleta intermediária do run 43956369500. A consulta posterior ao job 133612712038 confirma conclusão final **cancelled**, não PASS nem FAIL. O run global terminou **cancelled**. No verify 133620509546, `Diagnose upstream gates before downloading suite artifacts` falhou e as etapas de coletar/verificar oito receipts foram **skipped**: prova de red fail-closed, não prova positiva de recebimento de 8 artifacts.

## 2. Lacunas de qualificação e custódia
- Estes runs são históricos da cabeça do PR #242, **não** run fresco do branch `sfa-release`, nem freeze C de W3, nem produto servido na VM. O branch `close-final-candidate` observado estava em `1cb77b8deb144e01a655c36987922338b1474003`; não inferir ancestrais, promoção ou release.
- `GITHUB_SHA` exato do checkout, tree, artifacts/receipt IDs/digests, tempos/exit codes por suite e lista completa de testes executados: **NOT_OBSERVED** neste digest. Sem esses campos, não marcar CI-06/CI-15/PRODUCT_CI_GREEN como PASS.
- Pêndencias B1 (inclusão E2E), B2 (seleção manifest), B3/CI-04 (CLI+Atlas equivalência), M2 (geração+diff), M3 (base guards), M4 (suíte quase vazia): **OPEN** até contraprovas em novo SHA e revisão externa.
- CI-13 / owner: `GET /branches/close-final-candidate/protection` retornou **403 Resource not accessible by integration**. `GET /rulesets?includes_parents=true` retornou `[]` nesta credencial; não prova políticas finais. Required check migration **NOT_EXECUTED**.
- Rótulos rounds 10–13: **BLOCKED_BY_SOURCE** (mapping dos runs e evidência original não localizada). Dono/A1 devem fornecer cadeia de IDs/refs se precisarem do digest individual de cada round.
- Azure host Entra, F04, AM01–06, restore/rollback, artifact imutável e três cold reviews: **BLOCKED_BY_ENV/OWNER / NOT_RUN**, não serão homologados por PR.

## 3. Próxima rodada válida
Abrir PR draft `sfa-release → close-final-candidate`, obter run `sf-ci` e registrar em nova entrada **run ID, tentativa, PR head e checkout SHA**, as 12 conclusões exatas e IDs (incluindo `cancelled`/`skipped` se houver). Somente A1/A6 integram fixes; A10 não movimenta bases, não congela C em W1 e não reescreve `sf-release.yml`. O run do draft é evidência CI de PR, **não** certificado Azure.
