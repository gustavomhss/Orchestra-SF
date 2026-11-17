# UAT 360° · Pilot de provas verificáveis (V3 Lean)

**Status:** `DESIGNED_NOT_EXECUTED` · **Escopo:** três casos críticos, **não** uma reimplementação do produto ou da suíte E2E.

## Por que só três casos?

O atlas já contém 185 histórias, 825 verificações de rota e oito dossiês aprofundados. Mais casos gerados seriam bloat. Este incremento fecha **uma lacuna transversal**: admitir e conferir o *formato e integridade* de evidências de execução, sem falsificar PASS. Inicialmente cobre:

| Caso existente | Prova necessária | Reuso — não replicar |
| --- | --- | --- |
| `QA2-001` · Finance/CIO | Leitura autorizada, cálculo independente de forecast, escrita em versão, negativa em official locked, releitura executiva | `planner-runtime.test.ts`, `u06`, `u07` |
| `QA2-002` · Procurement | PR → sourcing → PO → issue, holder atual, impedimento de autopromoção e cotação inelegível, FX e recibos | `modules/sucafina/porta/{codigo,linha,s3}.test.ts`, `procurement-runtime.test.ts`, `u12` |
| `QA2-003` · Imports | Preview sem escrita, versão stale, uma aplicação, resposta perdida, recuperação do **mesmo** recibo | `operations-support/imports.ts`, `operations.spec.ts`, `product/imports/apply.ts` |

O arquivo `pilot-proof-plan.json` tem **21 provas vinculadas** a esses três casos; não são 21 testes executados. Os outros cinco dossiês QA2 permanecem no V2 e **não** ganharam um segundo roteiro.

## Sem framework, seed engine ou esquema paralelo

- Runtime: **Node 22** (`node:test`, `crypto`, `fs` nativos), sem dependências ou serviços novos. A suíte do produto permanece com Bun/Playwright. Este script valida *evidência*, não substitui E2E.
- Dados: use o **seed já existente** em `sf/demo/flamengo/seed.mjs` do **PR #268**, *somente após* validar sua promoção e o isolamento da instalação. `--apply` é operação mutável: o operador, não este programa, decide executá-la. O dataset `SF-LAB-2026` do atlas permanece planejamento até possuir seed autorizado; não inventamos API para instalá-lo.
- Evidência: preserve o **mesmo template** `EVIDENCE-RECORD.json` (`sf-uat-evidence-v1`) já fornecido pela V2. Para cada `QA2-00x`, adicione apenas `actor_bindings` e `proofs` detalhados. Não copie tokens, cookies, e-mails, IBAN, IDs OIDC ou dados Sucafina para o repositório.
- Autorização: `actor_bindings[].principalHash` é SHA-256 do identificador de teste protegido no ambiente privado; não substitui a verificação de roles/grants assinados do produto.
- Oráculo: valores monetários em **centavos inteiros**, com cálculo independente; ausência de FX não é zero.

## Executar

Na raiz do repositório:

```bash
node --test docs/qa/sucafina/uat-cio/scripts/verify-uat-proof.test.mjs
node docs/qa/sucafina/uat-cio/scripts/verify-uat-proof.mjs
```

O segundo comando retorna `NOT_RUN` para todos os três casos até existir evidência. Para examinar um lote privado:

```bash
node docs/qa/sucafina/uat-cio/scripts/verify-uat-proof.mjs \
  --evidence-dir /private/qa-evidence \
  --candidate <SHA_EXATO_DO_DEPLOY>
```

`/private/qa-evidence/QA2-001.json` etc. seguem o template V2 e declaram `proofs` com `proofId`, `kind`, `actorRole`, `principalHash`, `observedAt`, `correlationRef`, `httpStatus`, `artifactPath`, `artifactSha256` e, para mutações, `beforeDigest`, `afterDigest`, `receiptRef`, `receiptDigest` e `idempotencyKeyHash`. Artefatos devem existir **sob** a pasta de evidência e ter SHA-256 correspondente. `recovery` e `receipt` devem corresponder exatamente à aplicação original. `oracle` fornece um `observed` calculado pela aplicação para confronto com os valores independentes do plano.

O programa valida SHA, papel, dados mínimos, transições relatadas, before/after, ausência de efeito em negativas, referência ao recibo e hashes locais. **Não consulta Azure, Entra, a VM ou GitHub Actions. Não possui assinatura criptográfica de revisor.** Mesmo um arquivo formalmente íntegro recebe apenas `EVIDENCE_SUBMITTED_REQUIRES_EXTERNAL_VERIFICATION`. `releaseGo` permanece `false`; é incorreto promover uma release a partir deste script.

Um novo SHA exige reconciliação de `surface-manifest`, `route-registry`, `operation-registry`, producers e policies antes de reutilizar provas. Se o SHA difere da referência do piloto, o resultado é `SOURCE_RECONCILIATION_REQUIRED`.

## Encerramento sem overengineering

1. **Agora:** piloto revisável para QA2-001/002/003, sem serviços e sem duplicar testes/fixtures.
2. **Quando houver VM/atores:** registrar evidências de execução real no SHA C e fazer revisão humana independente; qualquer não execução é `NOT_RUN`/`BLOCKED`, nunca PASS.
3. **Só se o piloto mostrar valor:** aplicar *o mesmo contrato* aos outros cinco dossiês e aos P0 identificados, por risco, sem multiplicar matrizes paramétricas.

**Definição de pronto deste commit:** teste local verde, arquivos read-only, referências reutilizadas, três casos em estado não executado. Não confundir com a homologação integral do Orchestra-SF.
