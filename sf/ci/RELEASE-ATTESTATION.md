# Orchestra-SF — registro de atestação para release (A10)
**Criado 2026-11-16, W1. Estado: PREPARATION_ONLY / NOT_SIGNED / RELEASE_BLOCKED.**
Este documento prepara o aceite, não o concede. Sem VM/Entra/F04/AM/restore/rollback e autorização humana, `.github/workflows/sf-release.yml` permanece inerte/vermelho e `sf/release-target.json.activation.status=BLOCKED`. Não executar release ou mudar rulesets pelo A10 em W1.

## Gate zero — três estados SEM equivalência
| Milestone | Status demonstrado nesta fotografia | Prova distinta requerida |
|---|---|---|
| `CI_HARNESS_VALIDATED` | PARTIAL, contraprovas e equivalência ainda pendentes | B1/B2/B3/M2/M3/M4; CI-03/04/06; revisão fria no C |
| `PRODUCT_CI_GREEN` | NO (histórico `sf/verify=failure`) | 12 jobs `success`, 8 receipts íntegros, mesmo checkout/run/attempt + casos executados |
| `AZURE_RELEASE_QUALIFIED` | BLOCKED_BY_ENV/OWNER | real app instalada/Entra/backup/restore/F04/U39-U40/AM01–06/rollback, digest C e 3 pareceres |

## Freeze C — apenas W3 e após A1/A6 e PRs integrados
| Campo | Evidência / owner | Status |
|---|---|---|
| PRs aceitos, revisão fria e head candidato C 40hex | A1/A6 + urls | NOT_RUN |
| SHA `HEAD^{tree}`, manifest SHA256, workflow e guards | A10 + Actions | NOT_RUN |
| Build e artifact imutável ID/SHA256 | A7 + release owner | BLOCKED_BY_ENV |
| Re-run das 12 conclusões e 8 receipts em C | A1/A2/A6 + A10 | NOT_RUN |
| Invalidação por commits pós-freeze e nova rodada | A10: change log | NOT_RUN |
| Três revisores independentes, achados fechados | A1 + revisores humanos | NOT_RUN |

Não usar `head_sha` do PR como se fosse automaticamente `github.sha` do run; quando checkout em merge ref, atestar ambos e comprovar que o byte C promovido corresponde à árvore qualificada. Qualquer alteração versionada relevante invalida o freeze.

## CI-13 — solicitação formal de evidência ao proprietário (não automatizar)
Em 2026-11-16 o GET `/repos/gustavomhss/Orchestra-SF/branches/close-final-candidate/protection` retornou **403 Resource not accessible by integration**. O GET de rulesets listável retornou `[]` na credencial de integração; isso **não** significa ausência de branch protection. Responsável **dono do repositório com acesso administrativo** fornecerá export/screenshot com timestamp, branch(es) realmente protegida(s), required status contexts **exatos** e respectivo GitHub App/actor, políticas de bypass/admin, merge/review/approvals e rollback. Guardar o arquivo sensível fora do pacote público, expondo apenas referência restrita+hash, aprovações e URLs do registro.

## CI-14 / AZ-08 — ordem reversível, sem janela sem proteção; executar APENAS por decisão do dono
1. **Pré-condição:** `PRODUCT_CI_GREEN` e `AZURE_RELEASE_QUALIFIED` comprovados sobre C, B1/B2/B3/M2/M3/M4 resolvidos, 3 cold reviews assinados, `sf/verify` em branch/PR alvo real e contexts exatos confirmados pelo owner. Epic existente **permanece obrigatório**; não mudar rulesets por script ou neste PR.
2. Dono aprova **por escrito** plano/horário, target branch(es), matriz de permissões e saída de rollback; exporta configuração **antes** da mutação. Confere que `sf-ci.yml` dispara para todos os branches/fluxos protegidos que vão requerer o novo context; `sf/verify` must be created by the expected App; ausente = BLOQUEIO, não desproteção.
3. Dono **ADICIONA** `sf/verify` à lista required **mantendo os checks Epic já exigidos** (estado intermediário mais restritivo, nunca menos). Testa PR de controle/commit fresco com ambos requeridos e verifica bloqueio por ausência/failure de cada um; registra screenshot/export e URL do run.
4. Só após prova positiva e reversão testada, dono altera a lista necessária removendo contexts antigos **sem nunca remover o novo**; confirma policy protegida, PR bloqueado para check negativo, aprovação e ausência de bypass.
5. **Depois**, retirar Epic somente por **PR separado**, revisão e autorização explícita, com mecanismo de rollback documentado e `sf/verify` ativo. Em erro: restaurar settings exportados/required checks anteriores, manter ou reativar Epic e requalificar C; nunca soft-pass. Não fazer merge de PR de aposentadoria sem teste de regresso do caminho de enforcement.

**Proprietário, ação, aprovação e links:** `NOT_SIGNED / NOT_EXECUTED`. Apenas este plano textual foi preparado. Nenhum required status foi migrado.

## AZ-07 — release protegido (projeto de integração; não editar YAML em W1)
Implementar na wave W5 após A7/A8/A9: `workflow_dispatch`/promoção só do C 40hex aprovado; `environment` GitHub protegido com reviewers, deployment branch restrictions e gate manual do dono; permissões mínimas (`contents:read`, `id-token:write` exclusivamente para job que usa Azure OIDC, sem secrets permanentes); artefato imutável identificado por ID+SHA256/assinatura e sem reconstrução silenciosa; validar SHA do checkout vs C e digest da aplicação efetivamente servida; HTTPS/host real e login Entra; smoke **transacional** com dados não sensíveis + negativos de origem/identidade; checar migrations, restart, backup/restore Linux e rollback real do mesmo ambiente/artifact; failure cancela promoção e registra reversão. Qualquer `HTTP 200`, Caddy 503, health isolado, output vazio, artifact ausente ou aprovação simulada => RED.

O workflow atual está **corretamente fail-closed** (`AZURE_APP_ACTIVATION_NOT_COMPOSED`, exit 1); um patch que apenas retire a falha seria violação do gate. A10 não solicita credencial de tenant no chat nem grava tokens/cookies nos recibos.

## Quadro de decisão humana (preencher só com prova real)
| Decisão | Autoridade | Evidência assinado/data/link | Estado |
|---|---|---|---|
| Freeze C aprovado | A1 + A10 + 3 revisores externos | NOT_OBSERVED | NOT_RUN |
| Azure access / tenant / protected environment | Dono Azure/GitHub | NOT_OBSERVED | BLOCKED_BY_OWNER |
| Release técnico, smoke, F04, AM, restore, rollback | A7/A8/A9 + owner | NOT_OBSERVED | BLOCKED_BY_ENV |
| CI-13 export branch protection / contexts | Repo owner | NOT_OBSERVED | BLOCKED_BY_OWNER |
| CI-14 required checks mutation sem gap | Repo owner | NOT_OBSERVED | NOT_AUTHORIZED |
| AZ-08 go-live e aposentadoria Epic | Repo owner, PR separado | NOT_OBSERVED | NOT_AUTHORIZED |

**Conclusão assinável: NÃO ASSINADA; go-live não autorizado.** Links dos recibos e revisores vão ao `validation/final-bundle/evidence-template.md` somente após execução real.
