# Orchestra-SF — checklist de prova instalada (Azure Web/Linux)
**Coleta documental A10/W1 em 2026-11-16 (America/Sao_Paulo); NÃO é teste executado na VM.**
**Veredito:** `AZURE_RELEASE_QUALIFIED=BLOCKED`; `CI_HARNESS_VALIDATED=PARTIAL`; `PRODUCT_CI_GREEN=NO`. Fatos estáticos consultados via GitHub MCP, não acesso a VM/tenant.

## Fontes e fotografia observada
- [`sf/release-target.json`](https://github.com/gustavomhss/Orchestra-SF/blob/sfa-release/sf/release-target.json): `activation.status=BLOCKED`, `cloudFoundation.mergedIntoCandidate=false`, `foundationIsApplication=false`, `doNotDeployOrClaimGoLive=true`. A fundação `azure-hardening@22d8da9948810562deed2b051d4903d80d6f2370` não é app instalada.
- [`.github/workflows/sf-release.yml`](https://github.com/gustavomhss/Orchestra-SF/blob/sfa-release/.github/workflows/sf-release.yml): `workflow_dispatch` requer SHA de 40 hex, faz checkout, valida Linux e **termina com `AZURE_APP_ACTIVATION_NOT_COMPOSED` + exit 1**, sem deploy. Manter RED.
- [`sf/ci/PENDING-WORK.md`](https://github.com/gustavomhss/Orchestra-SF/blob/sfa-release/sf/ci/PENDING-WORK.md) e [`GPT-PLAN-10.md`](https://github.com/gustavomhss/Orchestra-SF/blob/sfa-release/sf/ci/GPT-PLAN-10.md): regras de aceite e owners. Referência histórica [Actions 43956369500](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43956369500) concluiu **cancelled** global, NÃO qualifica novo C.
- `close-final-candidate` observado em `1cb77b8deb144e01a655c36987922338b1474003`; não congelado por A10. `sfa-release` observado antes desta edição em `f75177e5b873675975bf8b680a1b1b4e5a5a029c`. Ambos são snapshots, não SHA de aplicação servida.
- Branch protection de `close-final-candidate`: GET retornou **403 Resource not accessible by integration**; rulesets listável retornou `[]` nesta credencial, **sem prova de política real**. O único caminho é atestado/export pelo proprietário; não interpretar 403/[] como ausência de proteção.

## Checklist de aceite (nenhum PASS por omissão)
| ID | Estado A10/W1 | Owner / desbloqueio verificável |
|---|---|---|
| AZ-01 VM + app Web/host Linux x64 instalados | **BLOCKED_BY_ENV** | A7 + dono Azure: ID de VM/host, URL HTTPS, processo/serviço, SHA+digest do artefato servido, smoke transacional |
| AZ-02 Microsoft Entra/OIDC + origem/sessão/CSRF/revogação | **BLOCKED_BY_ENV/OWNER** | A8 + dono tenant: app registration e atores autorizados; casos positivos+negativos com permissões reais |
| AZ-03 persistência/migrations/restart/backup/restore/rollback | **BLOCKED_BY_ENV** | A7 + dono VM/dados: restore e reversão observados no Linux, mesmo C |
| AZ-04 F04 instalado privado/atores + 3 negativos | **BLOCKED_BY_ENV** | A9 dependente de A5/A7/A8: manifesto real `sf2h.native-installed-manifest.v1`, 0700, witness; sem anexar secrets |
| AZ-05 AM01–AM06 + oito recipes + U39/U40 | **BLOCKED_BY_ENV** | A9 + produtores: suites integradas reais, oito recibos, mesmo C; nada de unit simulando live |
| AZ-06 freeze C/tree/digest + 3 cold reviews | **NOT_RUN** | A10 só em W3/W5 após integração A6 e pareceres A1; qualquer diff invalida freeze |
| AZ-07 deploy com environment protegido+approvals+artifact imutável+rollback | **BLOCKED_BY_OWNER/ENV** | Dono aprova ambiente/credenciais OIDC; A10 conecta workflow só W5 após A7/A8/A9 |
| AZ-08 mudança de required checks e desativação Epic separada | **BLOCKED_BY_OWNER** | Repo owner após `PRODUCT_CI_GREEN` e `AZURE_RELEASE_QUALIFIED`; passos reversíveis e PR separado |

## Itens de entrega A10 e seus limites de wave
| Item | Estado na coleta | Próxima evidência/ator |
|---|---|---|
| M1: distinguir sucesso CI de produto realmente servido | **W1 DOCUMENTED**, não qualificação | Três flags separadas no template/digest e `README.md` |
| CI-13: export de rulesets + required status contexts | **BLOCKED_BY_OWNER (403)** | Proprietário fornece export/screenshot, branch alvo, actor/app origin e required checks atuais |
| CI-14: plano de migração de checks sem gap | **W1 PLANNED, NOT_EXECUTED** | Owner confirma contexts; após C green e release, adicionar `sf/verify` antes de remover antigos, testar rollback |
| CI-15: documento de fechamento com C final/12 jobs | **NOT_RUN** | Coleta run novo completo + receipts/sha256 e assinaturas do responsável |
| Freeze W3 | **NOT_RUN** | A1/A6 entregam integração+revisão; A10 captura commit C/tree/manifest/artefato |
| PR review e três pareceres finais | **NOT_RUN** | A1 nomeia revisores externos e recebe achados endereçáveis |
| `sf-release.yml` / `release-target.json` | **BLOCKED, INTACTOS** | Nada editado em W1; alteração técnica só após provas e decisão do dono |

## Evidência mínima por prova futura
| Identidade | Exigido | Estado atual |
|---|---|---|
| exato C 40hex + tree, diff limpo, run id/attempt e `github.sha` checkout | Mesmo C em CI, pacote e VM; PR merge ref distinto explicitado | NOT_OBSERVED |
| artifact ID/URI restrita + SHA256 + assinatura/proveniência | byte publicado = byte instalado, sem rebuild silencioso | NOT_OBSERVED |
| 8 recibos testados com arquivo/caso, digest e 12 jobs | `sf/verify=success` real no candidato após negativa B1/B2/M4 | NOT_OBSERVED |
| login Entra, CSRF, sessão, fonte, owner, Task/Permission/Relay e reversão | negativos reais de identidade/origem, não cookies fake | NOT_OBSERVED |
| F04, U39/U40, AM01–06, backup Linux, smoke transacional, rollback | logs/receipts no mesmo C e mesma instalação | NOT_OBSERVED |
| 3 revisores frios + dono | nomes/parecer/URL/tempo e findings resolvidos | NOT_OBSERVED |

**STOP:** manter `sf-release` fail-closed, `release-target.activation.status=BLOCKED`, Epic e required checks atuais. Qualquer aprovação de merge, ruleset, ambiente protegido ou go-live é **DECISÃO DO DONO**, não deste agente. Não fazer upgrade de estado por PR verde.

---

## A10/W2 — handoff objetivo ao owner para PROMOÇÃO (documental, ainda BLOCKED)

**Procedimento owner-only integral:** [sf/ci/RELEASE-ATTESTATION.md](../../sf/ci/RELEASE-ATTESTATION.md#pacote-de-promoção--owner-only--execução-condicional-2026-11-16). Atestação utilizável: [evidence-template.md](./evidence-template.md#7-atestação-operacional-assinável--modelo-para-o-c-final-não-preenchido).

| Ordem | Dono exato | Entrada que precisa fornecer / registrar (sem valores secretos no repo) | STOP se ausente |
|---|---|---|---|
| 1 — integração | Proprietário de repo + A6/A1 | PRs por lease com aprovação, B1/B2/B3/M2/M3/M4, CI-04 equivalência, fixes de produto e revisão #240/#242 | Não há C |
| 2 — revisão | Dono aponta 3 humanos não autores: Security/Entra; Platform/Backup; Produto/CI | Identity, parecer timestamp/link + findings resolvidos no mesmo SHA, não “LGTM” genérico | AZ-06 NOT_RUN |
| 3 — baseline GitHub | Você, Admin | Export válido de branch protection e rulesets efetivos (incluindo origem org), contexts/app IDs, strict, reviewers/bypass, targets, hash e hora; evidência 403 da integração | CI-13 BLOCKED_BY_OWNER |
| 4 — identidade | Entra admin + você + A8 | Tenant/client/issuer/redirect/consent; grupos/roles por ID e contas reais requester/holder/denied/admin; sessões seguras, revogação, topologia de origem/retorno I00 | AZ-02 BLOCKED_BY_OWNER |
| 5 — Azure host | Azure owner + A7 | subscription/RG/VM/disk/vault, permissão deploy/restore isolado, DNS/TLS; serviço, pacote C, factory legítima, mount, anteriores e target RPO/RTO | AZ-01/03 BLOCKED_BY_ENV |
| 6 — segredos | Azure/Entra owner | Config privada de identity/cert/client credential, sessão+CSRF e source connectors conforme contrato real, Key Vault e acesso Managed Identity/0600; OIDC federado para GitHub environment — **nada de long-lived deploy secret em chat/Git** | AZ-02/07 BLOCKED_BY_OWNER |
| 7 — provas | A7/A8/A9 + você | Build C digest, smoke transacional, 8 native recipes e AM01–06/F04/U39/U40, backup/restart/restore isolado e rollback em C, IDs/hashes e witness | AZ-01..05 NOT_RUN |
| 8 — promoção | Você, após artefato/reviews | Protected environment approvals + ato escrito para promover C, rollback e operador; implementar workflow operacional sem sentinel em C **antes do freeze final** | AZ-07 BLOCKED_BY_OWNER/ENV |
| 9 — policies | Você, somente após C e AZ PASS | Autorização de mutar required checks, adição sf/verify mantendo Epic, PR negativo, só depois retirada de contexts antigos, snapshots de rollback; outro PR para Epic | CI-14/AZ-08 NOT_AUTHORIZED |

**Pendente técnico conhecido fora de A10:** A8 sinalizou no handoff A8-02 que o retorno Web/I00 ainda carece de contrato, A8-03 topologia de origem não comprovada, A8-04 exemplo de GET sem 3 selectors é inválido (esperado 400). A prova guest correta precisa incluir installationId/projectId/hostId e HTTPS; HEAD 200 **não prova autenticação**. A9 identificou dispatcher AM live ainda BLOCKED_BY_SOURCE; A7 documentou que fundação Azure/Caddy 503 **não é aplicação instalada**. Esses achados vetam promover sem correção/prova e owner responsável.

**Sequência de rollback exigida como pré-requisito, não pós-escrito:** antes de qualquer alteração guardar versão anterior e digest, prova de compatibilidade de schema, checkpoint com Backup job e recovery point, restore em VM isolada, RPO/RTO com dono, capacidade de fechar writes/Task/Relay e versão anterior no slot. Se falhar host mas schema compatível: switch atômico + restart + transação/Entra; se schema incompatível: não usar binário antigo no DB novo, restaurar **isoladamente** e reconciliar alterações; se falhar policy: manter a mais restritiva até Epic original voltar e ser observado. Não modificar policy ou produção enquanto estado for BLOCKED.

**Nada executado nesta seção:** docs prontos para decisão, sem assinatura, sem secrets, sem Azure, sem workflow de deploy ativado e sem required checks mutados.
