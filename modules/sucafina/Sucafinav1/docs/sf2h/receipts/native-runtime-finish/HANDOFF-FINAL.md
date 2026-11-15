# Missão90 → 71 — conclusão da implementação SF independente, runtime instalado em HOLD

**Autoridade:** missão90, lease `native-runtime-browser90`. **Fonte W:** `7f420fab8605997a6b2c5079993bc0f825193091`, árvore `34be4e56e8cb72e1472d5fa89e9200a32992c4cc`, branch `native-runtime-finish`, PR draft [#96](https://github.com/gustavomhss/Orchestra-SF/pull/96) → `sf2-stack`. Base C41 `1074cf338619a70ddef1ad1f62e32618fc355fed`. Planejamento imutável `dbf9547211d9b0fade619790de7c19c0869b7c7d`. ACK90 no commit `446e3a9bc0aa0512f2bda4fe83d2dd4f9e1abb44`. Modelo observado: GPT-6; nenhum ID de sessão Orchestra/Astra efetivamente exposto. Nenhum novo Goal, controlador, branch, merge, deploy ou reinício.

**Resultado verificável:** nova implementação de ligação de Request original e nova leitura read-only, ambas *dependentes* de produtor C15/humano/origem autêntico ausente. **Não há execução nativa instalada comprovada.** Mantidos sem anúncio `sf_routine_*` e `sf_watch_prepare` na composição default. `GLOBAL_RELEASE=false`.

## Delta de código próprio remoto

| Caminho | C41 blob → W blob | Efeito |
|---|---|---|
| `apps/cli/src/sucafina-product/routine-native-origin.ts` | ausente → `5dd18a08aff29de94dc51ba8fbce3c6953541ae1` | `createSfRoutineNativeOrigin`: aceita **somente** associação fornecida pelo owner nativo já admitido, com POST Request original, `TrustedUiContext` real, intenção exata `routines.run`, sessão Maestro nativa no mesmo Location/projeto, C15 independente, context/policy/access, geração, timeout civil+monotônico ≤300s; binding congelado e estável. `resolve(actualInvocation)` é consulta, não admissão. Revogação, cancelamento inclusive na aquisição pendente, expiração e dispose fecham sem retomada. |
| `apps/cli/src/sucafina-product/routine-native-registry.ts` | `9f108bf7af9f2d23d912bc568bb1f3a0523af085` → `a6e4f6580cf5380d637ae5add2e7317606ccbf38` | `withReauthenticatedRead` usa Request UI **nova**, atestado durável fornecido por produtor confiável, identidade de parent Maestro canônico, geração/contexto/capability atuais; apenas owner histórico sem `task`, temporário, egress fenced; revoca durante aquisição. O original `registry.run/withRequest` segue único owner da Task viva, sem novo run ledger. |
| `modules/sucafina/Sucafinav1/test/product/native-runtime-finish/origin.test.ts` | novo → `17ef0e0f3bc2094e57cf60dc88050bb880128fed` | Testes focados de associação e negações, reuso de hook64 com execução **sintética**, duplicidade, geração, C15/autoridade, pending revoke/dispose. |
| `modules/sucafina/Sucafinav1/test/product/native-runtime-finish/historical-read.test.ts` | novo → `79ada67b416fbe453fdf99da2e2582f76501338f` | Testes focados de leitura histórica read-only com SQLite/records/adapter reais e atestado/Request **sintéticos**, ausência de Task owner, revogação, concorrência e egress. |

Commits de implementação: `74667973b737bb9dd1ee448d54ef32365fe0734e`, `9e6f04c475e18f5efd53eaee6884dd8b9b05e809`, `7f420fab8605997a6b2c5079993bc0f825193091`. A origem e a leitura **não são ativadas** pelo host default. A prova 64, PR80, W `0846710321afab84e0c0a3a79653f41df8a284a0`, [run 43667749802](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43667749802), job `132670817059`, 158 PASS/0 FAIL, permanece **componente64**, não transferível para W90 nem para provider/Relay instalado.

## Patch completo de host compartilhado — PARA 71, NÃO APLICADO

No diretório `assembly/`: `host-context.preimage.txt` (Git blob **`297a4050323d80648684725f9c7e9a8680aa318f`**), `host-context.postimage.txt` (blob **`f03ab621e96cfda23456be73bba2d24f24754d36`**), `host-context.patch` (7 hunks, blob **`1b4af11e1aca8aeaff0ba73e393d12fbdbb4e5dd`**) e `MANIFEST.json`. O patch só propõe montagem opcional: subscrição do produtor real ao bridge original, fim de lifecycle ordenado e recuperação de `routineRuns.discoverRuns` sob nova Request/atestado. **Não altera** `host-context.ts` neste W, não fabrica C15, review ou Permission, não cria registro dinâmico. Conflitos com evolução posterior do host exigem reconciliação seletiva por 71; jamais copiar arquivo inteiro sem conferir o preimage. Também há `owned-overlay/registry.patch` e seus pre/postimages do delta próprio já comitado.

### Assinatura mínima faltante na origem nativa instalada

A proposta em postimage descreve a dependência privada que **ainda não existe como implementação**:

```ts
export type SfRoutineNativeProducer = Readonly<{
  ready: () => boolean
  subscribe: (accept: (source: SfRoutineNativeOriginalAdmission) =>
    Promise<(() => void) | undefined>) => () => void
  historical: (context: TrustedUiContext, request: Request) =>
    Promise<SfRoutineNativeHistoricalAuthority | undefined>
}>
```

`SfRoutineNativeOriginalAdmission` contém `request: Request`, `context: TrustedUiContext`, `authoritySessionID: SessionSchema.ID`, `intent` exato com `planRevisionId,authorizationId,inputDigest,caseRef`, `signal`, `current` e `nativePolicy: {signal,current}`. O **owner genuíno** precisa possuir a Request autenticada **desde** a admissão/continuação humana original, identidade nativa e C15 real antes do provider. `historical` só deve emitir atestado após resolução por evidência durável independente do cliente e reautenticação da Request nova. **Session IDs, nomes, `plan.owner`, `SF_ROUTINE_INPUT`, `sf_maestro`, callback permissivo e fixture não constroem esse atestado.** O vínculo a `routines.run` exige `authority.human.authorize(context,"routines.run",intent)` com mesmo payload após admissão explícita, não `routines.admit`. O hook64 continua dono exclusivo de `registry.withRequest` durante o settlement original; não aninhar wrapper externo ao runner.

Ausências demonstradas nos sources C41: factory `createSfHostRuntime(input)` invoca `createSfHostRuntimeWithRoutineNative(input)` **sem** produtor; `host-context.ts` observa `nativeRoutineOrigin?.()` mas nunca o instala default; `native-host.ts` e `token-gate.ts` lidam com `SfNativeAdmission` e `TrustedExecutionBinding` do residente, sem owner de C15 do Maestro nativo/filhos; o contrato `SessionV2.CreateInput` só inclui id/parent/agent/model/location e não persiste genericamente atestado SF de origem/principal; `Tools.Service.register` é Scope-aware, mas array de descriptors em `contribution.ts` é materializado uma vez; Schedule não tem admissão SF instalada; `provider.executed=true` do ExecutionHost hospedado é recusado pela captura41/adapter41. API pública de Session, Task, Permission, Maestro, Relay e Schedule existe, **não** sua composição autenticada.

Não existe nesta missão transporte efetivo de apresentação do plano, resposta humana como primeira mensagem direta posterior, nem `Permission.reply` com escolha explicitamente feita pelo principal. Não ampliar grants nem inserir aprovação sintética. Ao integrar, 71 deve qualificar C15/budget/skills/denies do parent e filhos **antes do primeiro provider**, continuidade humana real e native approval/grant/Task/Relay, retorno com resultRef/outputDigest, consumidor read-only reautenticado após reload, revogação/cancelamento/idempotência e leitura sem exposição depois da perda de acesso. `sf_watch_prepare` só quando a admissão Schedule real existir.

## Checks e evidência

`checks/REQUEST-45.json` solicita ao dispatcher45 via interface `test:ci/request` os dois testes novos + regressões admission64/binding41/fences41 no `modules/sucafina` Linux, sobre W exato, com snapshot S, run/job/attempt e logs. Também `bun typecheck` em `apps/cli` e `modules/sucafina`, `bun run check:guards --base origin/dev` conforme AGENTS. **Nesta entrega W90: testes NOT_RUN, typecheck NOT_RUN, guards NOT_RUN, S/run/job novos null.** Nenhum `bun test`, epic, CLI local ou workflow alheio acionado. A45 deve deduplicar por W/tree/args/config/OS; **não** usar run64 como substituto.

`CRITERIA-DELTA.json` conserva os 98 textos, ponteiros e estados dos critérios da64; os 15 WPs, 74 tasks, 17 contratos e 1610 critérios permanecem canônicos. `CAPABILITY-STATUS.json` registra CAP90-01..08 e blockers. AM01..AM06 `NOT_PROVEN` e todos os aceites integrados C/G7, D/G8, WPs e três reviews continuam externos. Esta instância não pode aprovar a própria autoria como revisão independente.

## Handoff terminal e ACK explícito

**71 é a única integradora.** Solicito ACK71 com: (1) W90/tree e blobs aceitos/rejeitados por path; (2) destino atual `sf2-stack`/candidato composto e conciliação do patch `host-context` com preimage real; (3) quem fornecerá a capability nativa real C15/humano/histórico, assinatura e autorização; (4) estado documentado de checks45 e provas runtime/AM; (5) blockers restantes e decisões de readiness. **O envio não é ACK recebido**, nem intake ou autorização para sobrescrever outros writers. A90 encerra a própria lease após publicar este material. `GLOBAL_RELEASE=false`.