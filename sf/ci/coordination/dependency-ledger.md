# A1 — dependency, ownership e reviewer ledger (W0–W1, 2026-11-16)
**Fonte mandatória:** `sf/ci/GPT-PLAN-10.md` §0/§2–§5 e §6, em `sfa-coord`. Registra owners **sem criar permissões**, sem alocar execuções Azure ou autorizar produção. Nenhum humano/revisor foi declarado aprovado.

## Exclusividade de escrita — sem transferências
| Agente | Lease de escrita | Entrega W0/W1 e dependência |
|---|---|---|
| **A1** | `sf/ci/coordination/**`; `sf/ci/reviews/**` | estes ledgers + triagem + custo + parecer independente |
| **A2** | `script/sf-ci/**`, `sf/ci/suites.json`, runner/seletor `test-ci` enumerado no plano | CI-02/03/05/06/07/08, B2/M4; publica contrato de seleção/recibo a A6 |
| **A3** | SF tests/Planner (com exclusões A5/A7/A9 do plano) | PROD-01/04; não editar caminho de A4/A8 |
| **A4** | browser SF exceto F04, fixtures Procurement, 3 specs e support UI | PROD-02/03/05/06/07; não editar U39/U40/F04 |
| **A5** | exatamente 11 arquivos PR #240 | X casts, Y decoder, Z consumidores; fonte U39/U40, nunca execução live |
| **A6** | `.github/workflows/sf-ci.yml`, E2E inclusion verifier, `sf/ci/coverage/**` | F0 **único**, CI-04/09, B1/B3/M2/M3; wiring após contrato A2 |
| **A7** | `sf/azure/{vm,runtime,data,recovery,runbooks}/**` | AZ-01/03: documentação W1; testes Azure ainda **BLOCKED_BY_ENV** |
| **A8** | `sf/azure/{identity,security}/**` e host/security exclusivos do plano | AZ-02: design W1; Entra real **BLOCKED_BY_OWNER** |
| **A9** | `sf/proofs/**`, `script/sf-release-proofs/**`, `validation/azure-proofs/**` + testes F04/AM especificados | matrizes W1, sem F04 LIVE antes de A5+A7+A8+C; AZ-04/05 **BLOCKED_BY_ENV** |
| **A10** | `sf-release.yml`, `sf/release-target.json`, `sf/ci/PENDING-WORK.md`, `sf/ci/README.md`, evidências/bundle exclusivos | templates W1; CI-13/14/15 e AZ-06/07/08 dependem do dono e candidato C |

**Exclusões de maior risco:** A3 não escreve os 3 `test/native-ui-contract` pertencentes a A5, `native-fixture.ts` A5, `am05/sequence-integrity216.test.ts` A5, `parity-pitr.test.ts` A7, AM01–AM06 A9. A4 não escreve `transport-integration.test.ts` A9. A9 executa U39/U40 mas A5 os edita; A8 possui `readiness.ts`; somente A10 edita release workflow/target. `gpt-plan-001-brief.md`, revisões PRs, `PENDING-WORK.md` para A1 são **READ-ONLY**. Nunca alterar paths guardados.

## DAG / gates / owners de desbloqueio
```text
W0 A1 inventário/leases ─┬─> A6 F0 candidato→CI (somente A6)
                          └─> A1 classificar REDs, PRs e custos
W1 A2 B2/M4 ──interface──> A6 B1/B3/M2/M3/wiring
W1 A3 PROD SF ─┐
W1 A4 UI       ├─────────> revisão A1 + integração A6 → A10 freeze C (W3; NÃO HOJE)
W1 A5 PR240 ───┘
W1 A7 VM-preparo + A8 Entra-preparo ──┐
W1 A9 matriz F04/AM (SEM LIVE) ────────┼──> A9 provas LIVE W4 depois de VM/Entra/C
A10 freeze/release W3–W5 + 3 pareceres ┘──> autorização humana; nunca auto-PASS
```
- **BLOCKED_BY_SOURCE [A6]:** fonte `sf2h-plan/ci-recipes.json` não localizada no snapshot do plano; B3/CI-04 exige versão histórica com provenance ou reconstrução `requests.json`+Epic+requisitos com revisão fria. Não alegar equivalência de 8 receitas.
- **BLOCKED_BY_OWNER [dono/A10]:** export rulesets/protection (histórico 403), decisão de migração `sf/verify`/retirada Epic, approvals, release protegido e escolha de 3 revisores independentes. Labels e `mergeable` não são aprovações globais.
- **BLOCKED_BY_ENV [A7]:** Azure Linux VM com aplicação HTTPS, artefato e persistência/backup/restore/rollback no mesmo C ainda não comprovados.
- **BLOCKED_BY_OWNER [A8/dono]:** tenant Microsoft, app registration, OIDC, domínio e identidade/sessões/atores, origem e credenciais reais ausentes para execução.
- **BLOCKED_BY_ENV [A9]:** `sf2h.native-installed-manifest.v1` privado 0600/root 0700, requester/holder/denied, F04 U39/U40, oito recipes e AM01–AM06 ainda sem prova live.
- **BLOCKED [A10]:** final candidato C e digest não congelados; review/deploy/retirement não executáveis hoje.

## Três pareceres finais independentes solicitados como requisitos (NÃO recebidos)
| Slot necessário | Independência e evidência | Quem indica / status |
|---|---|---|
| R1: CI/equivalência | Revisor humano distinto de A2/A6; B1–B3, M2–M4, oito receitas e subcasos Q01; parecer SHA-assinado/link do review | dono/A10 indica; **PENDING_OWNER** |
| R2: produto/UX/financeiro | Independente de A3/A4/A5; resultados integrais do C, no mesmo SHA, não apenas testes focados | dono/A10 indica; **PENDING_OWNER** |
| R3: segurança/infra/release | Independente de A7/A8/A9/A10; Entra/origem, F04/AM, backup/rollback e artifact digest; sem acesso a segredos em anexos | dono/A10 indica; **PENDING_OWNER** |

Nenhum comentário GitHub formal `reviews` foi encontrado ao consultar PRs #242 e #240; reviews textuais anteriores não substituem estes três pareceres. **CI-12 parecer A1 é um review frio documental e não substitui aprovação humana final.**
