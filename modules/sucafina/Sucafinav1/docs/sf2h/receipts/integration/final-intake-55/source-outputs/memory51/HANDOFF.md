# Missão51 — MI07 preservado, bloqueio contratual demonstrado

**MI07 permanece NOT_CLOSED.** A execução integral na composição atual falhou antes da jornada Memory: o produtor real de Procurement recusou a preparação financeira usada pelo teste para capturar a fonte original. O finding é **M51-MI07-PROCUREMENT-CAPTURE-BLOCKED**, dependente de **M31-FINANCIAL-APPROVAL**.

**Autoridade51: HANDOFF / ENDED na publicação deste terminal; nenhum source writer51 ativo depois dela.** A47 continua a única integradora de `sf2-stack`; S0/WP00 + Procurement/C12 recebe a decisão de contrato;45 conserva compilação/guards; S0 conserva os gates finais. Não há liberação global.

## Resultado real e identidade

| Papel | Identidade |
|---|---|
| Branch / PR preservadas | `astra-wp10` / PR29 |
| Head terminal40 recebido | `1136abe85d0dee1e5d43d7c3ebaaa3dd5932fd90` |
| ACK51 antes do trabalho de validação | `3938d50d78e65e4a6fc490c71a079d3fc9142f1b` |
| Manifesto publicado antes do dispatch | `f2794784551e25ce2a2f56f408506cd790fae976` |
| Base fixada C18 | `ee1a3ea147ab7d7f4f6b231217e623456e294c84` |
| Árvore C18 | `8563e04f8751ed786ccdbc086ed6566c410af3fe` |
| W isolado: C18 + exatos dois postimages40 | `4f736943df7916964a231461d33ae0c84e5f2c01` |
| Árvore W | `10e4b9c793c528c2172b08eadd954710386d8dda` |
| S: W + somente request original | `0a0b1a9110bdf2e068745f284c97c86f3d0cd2e4` |
| Árvore S | `c32b96f0a9cd9220391166852897bb2331082260` |
| Run / job | [43654082252](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43654082252) / `132628655525` |
| Cleanup | `132629091368`, SUCCESS |
| Resultado | **0 PASS / 1 FAIL**, um arquivo e um teste selecionados |
| Falha | `procurement.capture-original`, elapsed **825 ms**, fase18 ms, sem abort/deadline |
| Tempo do teste / Bun | **843,11 ms / 1329,00 ms** |
| Omni | **PASS**, nonce `ae55676a866d14d70f0ca28bc2b4d94f`,1 declarado,2 spawns,0 delegated |
| Artefatos Actions | Nenhum; esse runner Bun não exige upload genérico. Logs exatos arquivados. |

O erro executado é:

```text
Original source capture unavailable: financial-approval-command-unavailable
```

O teste lançou na linha240, antes da assertion de um comando, de `atlas.emit-ledger` e de qualquer fase `memory.*`. As marcações `scanner.ensure` e `scanner.version` concluíram. O run não chegou ao scanner de append, histórico, corrupção, replay/stale, cancelamento ou revogação finais.

**A duração curta não demonstra melhora de performance.** Finance34 está presente, mas a execução foi interrompida por uma precondição anterior. O efeito de Finance34 sobre o timeout de MI07 permanece não medido.

## Cenário, código e budgets preservados

O request original foi reutilizado por blob, sem alteração:

- Pacote `sucafina`, diretório `modules/sucafina`, runner `bun`.
- Arquivo completo `./Sucafinav1/test/product/wp10/analysis-composition/historical-memory.test.ts`.
- Argumentos originais `--timeout 120000`; env `ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER=strict`.
- Deadline cooperativo **225000 ms** e limite explícito Bun **240000 ms**.
- Spec `ee5c725ae78e0eba5c12600da80eb51b7173c2ed` e os três helpers continuam idênticos ao W antigo, à release40 e ao C18.
- Os originais35 também continuam exatos: spec `a7d5b4c8346c8f092b4497e7ae8c44aa5f8b53c9`; helper `65c5fd04f6af34a241e6cc0bd40cd968cdc6e353`.

Nenhuma assertion, operação financeira, dado, corrupção, negativa de autorização ou budget foi reduzido. Não houve skip, provider permissivo, reaproveitamento de autoridade, substituição por18 curtos/2 originais, teste local ou epic. Houve **um dispatch51**, após deduplicação; nenhum retry do produto inalterado.

As duas fontes40 são os únicos overrides sobre C18:

| Path relativo a Sucafinav1 | Preimage C18 | Postimage40 / W |
|---|---|---|
| `product/host-binding/business-context.ts` | `6e0aba2f7aa058cef1b35ecd0c963312e98ef993` | `390bce2594e39a28defce1d47fafa0d7291e940e` |
| `product/host-binding/atlas-memory.ts` | `91e8bc8f5d80f83b7756b4647c790cc5e5936d59` | `a45ab53b1dab706eedb3b0d075bbfe36a00be40d` |

Finance34 local-store é `e9da289bdce680f2429904c1e83dec60c39aa2a8`. O compare Git confirma exatamente dois arquivos modificados de C18 para W, e somente `.ci-run.json` de W para S. A árvore composta não foi importada sobre `astra-wp10`;51 não escreveu `sf2-stack`.

## Causa e owner

A37 publicou a recusa deliberada da preparação financeira; A47 consumiu a unidade completa no C15, mantendo o finding obrigatório **M31-FINANCIAL-APPROVAL = NOT_SATISFIED_BLOCKED_POLICY_CONTRACT**.

O MI07 cria uma PR draft com valor100, registra escolha `replace` para150, admite a intenção humana real e chama `prepareDomainCommands`. Exige resultado `ok` com um comando. O host revalida caso/escolha/autoridade, chama o preparador canônico e retorna qualquer recusa **antes** de chamar seu `captureSource` privado.

Os pontos determinantes são:

1. `product/procurement/scenario-preparation.ts`, blob `7fce64e7e213693d505f9bc6e08835468b7ead41`: a substituição financeira não tem saída positiva compatível.
2. `product/procurement/prepared.ts`, blob `517f50991fb7f057aff943c9e0b626ef6ddc91d6`: o guard inferior também recusa `values.pr.estAmount`, além de estágio e no-op.
3. `product/procurement/prepared-review.ts`, blob `b7d25206bb7ba11d20b293495f09e6cb70430a84`: o review não permite bypass por comando retido.
4. `product/procurement/decision-host.ts`, blob `9b48c999661e4b8a10593ae7cd5d6e2ed1e2f635`: linha125 retorna a falha; linha128 só captura após todos os comandos serem `ok`. A captura não tem API pública independente. Resolução histórica e continuidade dependem desse archive real.

O ciclo canônico permite alterar o valor no draft/rejected. A submissão já grava e congela o valor a aprovar. A aprovação final entra em sourcing, onde a substituição pretendida já não é uma edição admitida. Aprovar100 não aprova150; escrever/aprovar150 antes da captura elimina a transição histórica original100→150.

Trocar papel/estágio, semear `prApproval`, retornar um comando permissivo ou escrever manualmente o archive não resolve o original dentro da política corrente. Pular o preparador e somente emitir Atlas também não produz o archive canônico exigido pelo resolver histórico.

**Não há correção segura nos dois paths Memory autorizados nem adaptação apenas da fixture que preserve simultaneamente esse produtor, cenário e assertion.** A mudança necessária pertence a **S0/WP00 + Procurement/C12**, com integração exclusiva47.

A auditoria financeira37 está em `FINANCIAL-COMPATIBILITY.md`, blob `4d77fd48977058d6033a89592463198b76d87b65`, release `ab2a967125b3c767067797a27b919466020fbd82`. O incremento47-03, blob `15ad5a0640c312e03d32e7c1cb74187c9d3a3eba`, preserva explicitamente esse hold. FINDINGS.json contém a cadeia, pre/postimages e a condição de retomada.

## Patches e decisão necessária

O pacote contém uma cópia byte-idêntica do **patch completo40**, em `owner-patch/0001-memory40-preserved.patch`, blob `5d7237afc2b58ea200bb1ec1b8b55c1a199d0fd5`; SHA256 `08968ae49b79e5833520b69eb6ec63c871df34c57c3840e673ba7984276be8f2`. É a correção original de autorização/replay preservada, não uma correção nova51. A47 já a consumiu no C19; não aplicar novamente sobre postimages iguais.

Não foi fabricado um patch executável para “liberar” o comando financeiro: nenhuma capacidade canônica disponível implementa esse resultado mantendo o gate37 e o oracle original. Retirar o guard seria uma alteração de política proibida pela missão. A ausência de patch para essa semântica ainda não decidida está registrada, não ocultada por pseudocódigo.

O próximo owner deve resolver **M31-FINANCIAL-APPROVAL**, definindo efeito e ordem canônicos, e publicar código/testes/contratos completos com pre/postimages e release explícita. Outra decisão possível é criar uma entrada própria para captura histórica autorizada reutilizando o produtor real; isso muda a precondição/assertion de preparo do MI07 e exige reautorização explícita do contrato de teste.51 não a tratou como ajuste trivial.

Depois da liberação e integração da dependência compatível, o sucessor Memory pode qualificar o MI07 integral em novo W fixado, com os mesmos budgets e todas as provas históricas preservadas. Nenhum resultado em C13 anterior ao hold é apresentado como prova de C18/C19.

## Reconciliação posterior: Memory40 entrou no C19

Durante a execução, A47 publicou:

- **C19:** `5b11f1460fa44426626ea7674ccb8baf0a083e0a`.
- Tree: `647569d14e2f01959b17d4245bfbf0485c32fa8c`.
- ACK: **ACK47-07**, consumo explícito da release40.
- Manifesto: `increment-07.json`, blob `b66315bee1beb26070e6ff4b6ab236f7a3dc6c4d`.

Conferidos os dois postimages Memory iguais ao W51, o MI07 original idêntico e o preparador financeiro no mesmo blob recusado. C19 acrescenta os quatro testes próprios40 e seus recibos; a recusa pertinente permanece. Não houve outro dispatch51 apenas por essa integração documental/testes. O run continua atribuído ao seu W/S exato, não relabelado como execução de C19.

## Evidência anterior e limites de aceite

A falha anterior permanece arquivada com log integral: run43637227753, W `ab511e9ab2dcb0f64b34bea944533cdbf7ed98e7`, S `e63511737be687a2e42f9a15706a229db42a31c1`, **0 PASS/1 FAIL/687 expects**,225,71s. O deadline atingiu225014ms em `memory.fence-final-request-headers`, antes da nova prova/replay/stale e corrupção/revogação finais. O novo resultado não apaga essa falha.

| Obrigação | Estado terminal51 |
|---|---|
| MI07 histórico integral | **NOT_CLOSED / EXTERNAL_CONTRACT_BLOCKED** |
| Timeout225000ms na composição nova | **NOT_REQUALIFIED**, fases Memory não alcançadas |
| Correção40 de originais/replay | Bytes preservados; source proof anterior conservado; consumida por47 no C19 |
| Spec/helper original35 | Byte-idênticos, sem nova execução51 |
| Compilação/guards da composição | **NOT_RUN por51**, request exato encaminhado à45 no manifesto |
| AM05 / witness nativo | **OPEN**, nenhum witness Session/provider/Task/SkillLoadReceipt/consumer fabricado |
| Gates finais / GLOBAL_RELEASE | **OPEN / false** |

A45 continua dona dos checks. Seu head observado é `astra-compose@d317873c18bf224c4c1f4d3425179d12ad53e81b`, terminal26 com compiler não executado; não foi observado ACK45 publicado. Isso não determina estado do backend nem autoriza substituir o owner. Não foi criado workflow paralelo.

O planejamento `dbf9547211d9b0fade619790de7c19c0869b7c7d`, T0 `2026-11-13T04:01:10Z`,15WPs/74tasks/17contratos/1610critérios permanecem. A leitura completa de S0-B e anexos foi dividida entre root e revisores somente leitura, registrada no ACK51. CRITERIA.json preserva os98 IDs do pack, com zero fechamento integral de critério canônico por esta execução.

## Publicação e retomada

A entrega terminal acrescenta somente arquivos próprios em `docs/sf2h/receipts/memory-history-closure/`. Preserva produto/testes de40 e todo o histórico da mesma branch/PR. Seu parent esperado é `f2794784551e25ce2a2f56f408506cd790fae976`; o SHA do terminal é o commit que contém este arquivo e aparece externamente na PR29.

Todos os avanços de `astra-wp10` usaram GitHub MCP, expected-SHA CAS e `force:false`. Não houve edição de fonte externa, rollback de37, alteração de política, teste local, epic, deploy, merge, Azure, credenciais, restart, Goal/controller ou mensagem a terceiros.

**A47 pode consumir este diagnóstico fechado e rotear a dependência sem aguardar um writer51 ainda ativo: a autoridade51 termina explicitamente com esta publicação.** A retomada requer uma sucessão limitada explícita, o produtor/contrato liberado e nova reconciliação de heads/leases; silêncio não transfere autoridade.
