# Missão 214 — handoff remoto de produto CI

**Ator/lease:** `product-ci-e7-browser214`, `sf-ci-validation`, PR #106, modelo efetivo GPT-6; sessionID não exposto. Autoridade 200 recebida e confirmada pelo `ACK-214.json`, sem inferir lifecycle.

## Estado final observado

- **15 runs oficiais Actions**, todos concluídos: **7 workflows SUCCESS, 8 FAILURE; 134 testes PASS, 12 FAIL, 146 testes selecionados**. Um run B15 selecionou **0** testes e falhou por filtro Bun; B15R corrigiu a seleção (5 PASS). Sem uploads de artefatos. Todas as tentativas são 1. Contagens de skip não foram reportadas; não atribuir zero.
- `RUNS-214.json` contém cada W/tree/S/request blob, pacote/diretório, seletor, run/job/attempt, resultados, artifacts e controle omni. Não houve execução local ou workflow alternativo; 190 continua owner exclusivo dos checks compiler/G7.
- PR #191 compositor: último HEAD observado `e9d6e30c65bfbd1e67cb3d6e082cdef1d06ee5ab`. `sf2-stack`/189 observado `6130f682014662964a2f2fcd2c0c487a904ecd3e`. **Nenhum C final aceito.** Último commit do compositor após W `e6488a4` foi um ledger documental de 1610 critérios, sem alteração material para reabrir teste.
- PASS delimitados incluem F01/F02 (26), BI/People/Atlas (29), Operations reparado (9), S05 (5), owner/nav CTA (11), Client/F02 MIME reparado (6), Desktop/213 bridge (4). **Não são prova instalada D01 nem AM01–06 nem C/G7/D/G8.**

## Código/patches efetivamente entregues

- Commit próprio de quatro **postimages integrais inertes** no `INERT-211-CAUSAL-PATCHES.json`: Operations `02b5f163...`→`bdde554d...`; AM03 `530b1d66...`→`bb4cdec0...`; AM04 `1fbabb2...`→`aa144a64...` e `4a7100c...`→`20be7565...`. O compositor 211 aplicou exatamente esses blobs por CAS; B17 Operations 9/0, B18 AM03 2/0; AM04, após resolver imports, permanece 2 FAIL HTTP 400.
- Commit próprio de postimage completo para `packages/client/test/sucafina/transport-type-repair/f02-transport.test.ts`: `6f470dcc23300873223ec2c01bb7d36c6a5c23ea` → `fef5c0a8702ffde3921a7cd65829cfba9259716d`, disponível em `INERT-211-CLIENT-MIME-214.json`. Compositor 211 consumiu o postblob (recibo `INTAKE-213-214-MIME.json`); B21 6 PASS/0 FAIL. A comparação exata foi preservada (sem regex/relaxamento).
- O compositor também consumiu o código 213 do desktop real e os quatro blobs inertes de `apps/desktop/package.json`, `electron.vite.config.ts`, `bun.lock`, e `packaged-electron.spec.ts`. B22 4 PASS/0 FAIL de *bridge unitário sintético*; o executável Electron real segue não atestado.

## Falhas não dispensadas / próximo consumidor

- **Decisions**: `projection.cases` aceita a chave extra `includePrivate:true` indevidamente — fonte 193/211 precisa postimage de decoder fechado e 214 recheck único no W modificado; evidência B9 `43780028332`.
- **AM04**: `decision-review` retorna HTTP 400 em ambos os testes após corrigidos imports, onde se esperava 200 — 197/211 investigar `createProcurementDecisionHttp` + case/choice/Review; B18 `43781497192`, job `133019486672`. Não converter status.
- **AM01/212**: regressão em `baseline-coverage-case-not-selected` depois da correção de preview não-aplicado; B19 `43781520064`, job `133019558133`; 212/196/211 precisam uma prova de seleção real de caso e C09/C10, sem inventar total positivo.
- **AM05/198**: captura C12 original indisponível em dois testes B11 `43780062327`; sem scanner positivo, sem Relay sintético promovido a prova.
- **AM02/196**: `authority-unavailable` no C16/B16 `43781314836`; dependente de host/identidade real e candidato C.
- **Revisões 207–209**: todas preliminares `FIX_FIRST`, sem assinaturas FINAL para C/D. Arquivo 210 provou readback de 55 blobs antigos mas *não* G7/G8 ou equivalência de consumidores/remoções.

## Gate externo exato (199/213/189/S0)

Em runner **existente e autorizado**: C aceito imutável `SF_NATIVE_CANDIDATE_SHA`; manifesto de instalação 0600 `SF_NATIVE_INSTALLED_MANIFEST`; endpoint privado 0600 `SF_NATIVE_BROWSER_ENDPOINT_FILE` para CDP loopback e contextos Microsoft autênticos separados requester/holder/denied; `SF_NATIVE_D01_PACKAGED_ATTESTATION` 0600 com binário Electron real e hash do candidato; binding main-owned Orchestra, resoluções F01 CAP14/CAP04/CAP05 e IDs de linhas/versões originais; credenciais/grants nunca serializados ao Git. A inexistência desses itens bloqueia somente as provas dependentes. `EXTERNAL-DEPENDENCY.json` da 199 possui o contrato exato.

Após resolver defeitos e obter C aceito, **somente o dispatcher 214** fará as oito lanes `CI-SF`, `CI-CLI`, `CI-APP-SRC`, `CI-APP-BROWSER`, `CI-ATLAS-BUSINESS`, `CI-UI-OPERATIONS`, `CI-UI-DECISIONS`, `CI-UI-REPORTS` **no mesmo C**, com epic/e2e, U15/U39/U40, D01 e AM01–AM06 reais. **190** fará C/G7; D/G8 separado em D autorizado; 207–209 revisões FINAL independentes e remoteproof. Sem selecionar provider silencioso, duplicar runs sem mudança causal ou mudar validators/workflows.

**Conclusão:** toda seleção independente identificada foi fechada e contabilizada. Não há run em voo nem aceite de C final. `GLOBAL_RELEASE=false`, Goal nativa PAUSADA. Esta é uma entrega documental de código inerte/receipts/CI, **não aprovação de release**. Arquivos `ACK-214.json`, `RUNS-214.json`, `FINDINGS-214.json`, `QUEUE-214.json`, `HANDOFF-214.json` + este handoff constituem a transferência remota; histórico/PRs preservados, sem devmerge/deploy.
