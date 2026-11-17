# Revisão adversarial — PR #242 (Orchestra-SF, Linux/Azure)

**Veredito: BLOCK / NÃO APROVAR MERGE COMO SUBSTITUTO DO GATE.** Revisão estática da cabeça `sf-ci-lean`, pelo GitHub MCP; **UNVERIFIED**: execução verde dos workflows, branch protection, Azure real e equivalência de cobertura. O fato de Windows/macOS/desktop terem sido retirados é decisão explícita de escopo, **não** um defeito (`sf/ci/README.md:70-78`; `sf/ci/suites.json:4-9`).

## O que o PR realmente faz (nove fatos)
1. Introduz `sf-ci` para pushes em `sf-ci-lean`, PRs contra `close-final-candidate`/`go-live-close` e dispatch manual (`.github/workflows/sf-ci.yml:5-11`).
2. Cria preflight com teste do agregador, typechecks, verificações de geração, build Web e guardrails (`.github/workflows/sf-ci.yml:24-80`).
3. Produz binários Omni Linux para as suítes (`.github/workflows/sf-ci.yml:82-104`).
4. Executa cinco grupos Bun; CLI (12 arquivos) e Atlas (quatro arquivos) são recortes explícitos (`.github/workflows/sf-ci.yml:106-189`).
5. Executa três specs Playwright de Operations, Decisions e Reports, Chromium, um worker, sem retry (`.github/workflows/sf-ci.yml:201-252`).
6. Publica resumos/recibos; `sf/verify` exige cinco jobs e oito relatórios correspondentes (`.github/workflows/sf-ci.yml:190-199,253-286`; `script/sf-ci/gate.mjs:129-145`).
7. Acrescenta manifest de oito famílias e seis provas AM separadas (`sf/ci/suites.json:11-103`).
8. Acrescenta workflow de release **deliberadamente vermelho**, sem deploy, e alvo Azure `BLOCKED` (`.github/workflows/sf-release.yml:4-40`; `sf/release-target.json:22-34`).
9. Restringe o runner opcional `test-ci` e sua CLI a Linux x64; ajusta instrução AGENTS e testes de seleção de OS (`.github/workflows/test-ci.yml:19-43`; `script/test-ci-request.ts:1-8`; `script/test-ci.ts:13,34-38`; `AGENTS.md:160`; `packages/core/test/test-ci-request.test.ts:47-80`).

## BLOCKER

**B1 — Regressão verificável de prova de inclusão do typecheck E2E.** O Epic antigo exige `--showConfig`, `--listFiles` e `verify-e2e-typecheck.mjs`, falhando se qualquer etapa ou inclusão falhar (`.github/workflows/sf2-epic.yml:1023-1057`). O substituto invoca somente `bun run typecheck:sf-e2e` (`.github/workflows/sf-ci.yml:58-68`). Um typecheck pode ficar verde com arquivos críticos fora do grafo do compilador: a prova de inclusão anterior **não foi portada**. Obrigatório manter o verificador de inclusão ou demonstrar, com teste negativo, equivalência verificável.

**B2 — Manifest não governa de fato a seleção executada: drift pode ficar verde.** `sf/ci/suites.json:18-79` declara arquivos e specs; a invocação real fica duplicada/hardcoded no YAML (`.github/workflows/sf-ci.yml:140-180,210-216,247`). `validateManifest` só checa sintaxe, unicidade e IDs; não confronta lista selecionada com a execução efetiva (`script/sf-ci/gate.mjs:16-41`). `verifyAll` confere a contagem >0 e recibos, não identidade dos testcases nem igualdade entre seleção declarada e executada (`script/sf-ci/gate.mjs:44-53,114-145`). Um YAML reduzido/manifest obsoleto pode continuar apresentando oito suites verdes. A própria suíte de autotestes usa manifest sintético e um único arquivo fictício por seleção explícita (`script/sf-ci/gate.test.mjs:10-27`). Gerar comandos do manifest ou introduzir checagem cruzada executável de seleções com testes negativos que removam um arquivo obrigatório e detectem o drift.

**B3 — Equivalência de `CI-CLI` e `CI-ATLAS-BUSINESS` não está provada para promover como gate único.** O PR reconhece substituir o escopo completo dessas receitas por 12 testes CLI e quatro Atlas (`.github/workflows/sf-ci.yml:145-161,171-179`; `sf/ci/README.md:28-42`). O arquivo `suites.json` não registra cobertura por requisito/contrato nem prova de mapeamento dos cenários retirados (`sf/ci/suites.json:18-79`). **UNVERIFIED**: que os testes não selecionados sejam todos irrelevantes para Linux host, autorização, persistência, isolamento e release Web. Antes de substituir Epic/required checks, exigir diff de seleção anterior→nova e matriz requisito→teste com execução real e justificativa auditável para cada exclusão. Não exigir Windows/macOS por si só.

## MAJOR

**M1 — `sf/verify` não demonstra aceitação de produto instalado na Azure.** As únicas jornadas de UI selecionadas são três specs (`.github/workflows/sf-ci.yml:210-216,247`); build Web é só build (`.github/workflows/sf-ci.yml:69-70`), e `sf-release` sempre termina com `exit 1` (`.github/workflows/sf-release.yml:31-40`). Isso é comportamento seguro enquanto release é bloqueado, porém `sf/verify` **não é** prova de origem Microsoft/Entra, instalação, persistência, rollback ou AM01–06 (`sf/release-target.json:22-34`). **UNVERIFIED**: quaisquer evidências de execução Web real da composição Azure. Não prometer go-live ou substituir aprovação do release por CI verde.

**M2 — A garantia de gerador inalterado foi reduzida.** O Epic executa `bun run generate` seguido de `git diff --exit-code -- .` depois de `check:generated` (`.github/workflows/sf2-epic.yml:977-983`); a nova lane faz `check:generated` de Atlas/client, mas não executa regenerate+diff (`.github/workflows/sf-ci.yml:53-57`). **UNVERIFIED**: se `check:generated` captura exatamente todo drift/efeito de geração anterior. Repor o teste determinístico ou demonstrar equivalência.

**M3 — Base de guardrails é alterada.** Epic consulta `origin/dev` e guarda recibo do diff em `sf-static` (`.github/workflows/sf2-epic.yml:1002-1021`); piloto usa SHA base de PR ou snapshot fixo `ae7850...` (`.github/workflows/sf-ci.yml:71-80`). Isso pode omitir mudanças anteriores à base congelada. **UNVERIFIED**: equivalência semântica do check:guards para a história do candidato. Exigir execução/evidência comparativa das duas bases para a mesma árvore.

**M4 — Report de Bun certifica ausência de erro, não cobertura ou binding de teste.** O verificador JUnit documenta explicitamente que apenas valida XML, não a execução/proveniência/coverage (`script/sf2h/final-bundle/verify-bun-report.py:13-20`); `countBunReport` aceita qualquer `product_executed>=1`, com `status=PASS`, zero failures/errors/skips (`script/sf-ci/gate.mjs:44-53`). Assim ele barra suite vazia, mas não barra suite quase vazia. Exigir baseline por suíte, mapeamento de identidade e controles de seleção, preservando falha por skip.

## MINOR / controles preservados

**N1 — O release não tem soft-pass observável.** `sf-release.yml` valida SHA, exige Linux X64 + checkout exato e então falha incondicionalmente (`.github/workflows/sf-release.yml:22-40`). Não aparece `continue-on-error`, `if:false` nem deploy; isso é **bom** como cerca temporária, não uma implementação de deploy.

**N2 — As GitHub Actions diretamente novas usam SHA e permissões limitadas.** Checkout/upload/download/setup-node estão fixadas a commits; `contents: read` no workflow e `actions: read` só em verify; checkout sem credenciais persistentes (`.github/workflows/sf-ci.yml:12-13,29-31,97-104,120-127,192-199,232-234,270-281`; `.github/workflows/sf-release.yml:15-29`). **UNVERIFIED**: ações compostas locais e dependências transitivas; auditar `setup-bun`, `ripgrep`, `omni-binaries` antes da promoção. Não identifiquei token de escrita no diff.

**N3 — Parte relevante de fail-closed foi implementada corretamente.** O gate rejeita zero testes Bun, skips e falhas, testes Playwright inesperados/flaky/skipped, job ausente/skipped/cancelled, SHA/run/attempt/OS divergentes e digest adulterado (`script/sf-ci/gate.mjs:44-80,114-145`). Autotestes cobrem mutações artificiais destas classes (`script/sf-ci/gate.test.mjs:56-108`). **UNVERIFIED**: execução real desses controles em Actions e teste end-to-end de artefatos.

**N4 — O `test-ci` foi intencionalmente reduzido.** Foram retiradas matrizes Windows/macOS/Linux ARM64 e asserts correspondentes; agora só aceita prefixo `ci-run-linux-*` e X64 antes do checkout (`.github/workflows/test-ci.yml:19-43`; `packages/core/test/test-ci-request.test.ts:47-80`). Isso reduz plataforma, não prova perda de checks Linux. **UNVERIFIED**: efeitos em consumidores externos do CLI genérico.

**N5 — `AGENTS.md` limita `--os` a Linux, mas mantém frase de testes remotos e advertência sobre snapshots com arquivos não ignorados (`AGENTS.md:160-162`). Não é por si só bypass.

## Condições para merge seguro

1. Corrigir B1 e B2 com testes negativos reais, proibindo typecheck com specs omitidas e divergência entre manifest/seleção executada.
2. Resolver B3: inventário antes/depois de `CI-CLI` e `CI-ATLAS-BUSINESS`, justificativa de exclusões e rastreabilidade dos contratos SF; manter todos os testes Linux pertinentes.
3. Resolver M2/M3 com prova de equivalência ou restauração das verificações; rodar lint/security/typecheck/build e todas as oito suites em `github.sha` final, registrar recibos/digests, falhas e tempos. **UNVERIFIED** até resultados observáveis.
4. Não migrar required checks nem aposentar Epic enquanto o PR piloto e seus controles negativos não estiverem provados; `sf/ci/README.md:2-5,91-100` já declara essa restrição.
5. Manter `sf-release` bloqueado até deploy real do mesmo candidato+digest, autenticação Microsoft, proteção de origem/autorização/revogação, persistência, rollback e AM01–AM06 aprovados (`sf/release-target.json:22-34`; `.github/workflows/sf-release.yml:31-40`).

## Três perguntas desconfortáveis ao autor

1. Se eu excluir uma entrada essencial do `CI-CLI` no YAML sem atualizar `suites.json`, **qual teste falha hoje**? A validação compara apenas forma e IDs (`script/sf-ci/gate.mjs:16-41`), enquanto o YAML executa sua própria lista (`.github/workflows/sf-ci.yml:145-161`).
2. Por que remover a prova de inclusão `--listFiles + verify-e2e-typecheck` do Epic (`.github/workflows/sf2-epic.yml:1034-1057`) quando o novo gate chama só `typecheck:sf-e2e` (`.github/workflows/sf-ci.yml:58-68`)? Como demonstrar que nenhum arquivo do produto deixou de ser checado?
3. Que evidência reproduzível demonstra que os oito rótulos `CI-*` representam proteção equivalente para **este** Linux/Web/Azure, e não apenas oito suites com pelo menos um teste cada (`sf/ci/suites.json:11-79`; `script/sf-ci/gate.mjs:44-53,129-145`)?

**Limite epistemológico:** apenas inspeção de diff e fontes pelo MCP, sem executar CI nem confirmar branch protection, Azure ou required checks. Onde falta prova, os achados estão marcados **UNVERIFIED**; não houve mudança de código nesta revisão.
