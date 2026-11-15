# Missão103 → 105 / 101 / 45 / 93 — handoff terminal da correção do consumidor90

**Fonte material:** [W103](https://github.com/gustavomhss/Orchestra-SF/commit/e957f66b00a3b05265e42d46e1d88201dea3e770) (tree `e4b359fea9157da76b6ae77cb558a34e6577232a`) na branch existente `native-runtime-finish` / draft PR [#96](https://github.com/gustavomhss/Orchestra-SF/pull/96). ACK103 anterior a código: `058f29cc3aafeaa6551fb0e3654b2bbf8e431a2c`, lease `native-consumer-browser103` (GPT-6, rótulo Astra, session id não exposto). Escrita remota somente GitHub MCP + CAS, `force=false`.

## Por que

CI101 no C51 material `529142f63683de8e4b1f7d4232f88faf8ffcef6c` e S `a856513eb61ca0d7c1cb7ddaf03a2b911e737d05` deu **0 PASS / 5 import errors** em run `43682450677` / job `132715786509` / attempt1. O `routine-native-registry.ts` importa `observeSfRoutineNative`; `routine-native-origin.ts` não exportava a API, e `bounded<T>` lia `timeoutMs` não declarado. Nenhum teste comportamental nativo foi efetivamente executado nesse run; é histórico de falha, não resultado W103.

## Patch completo e pre/postimages contra o C observado

O integrador105 está ativo (ACK `d083b422b6a587f47873abde4d866e35017ff8b8` no momento da reconciliação); a árvore atual `sf2-stack` teve exatamente os **mesmos** blobs preimage do C51 para os dois arquivos-alvo. Os dois testes novos **não existem** no C observado. Não substituir host compartilhado nem copiar branches inteiras.

| Path | Preimage em C `d083b422b6` | Postimage W103 |
| --- | --- | --- |
| `apps/cli/src/sucafina-product/routine-native-origin.ts` | `da69328f9e8aa4d68a08faf7c858ccae9d5c0e5b` | `0d34ddeb14e9da525d6acc4960a54f35be18d577` |
| `apps/cli/src/sucafina-product/routine-native-registry.ts` | `a6e4f6580cf5380d637ae5add2e7317606ccbf38` | `b5a92ee1653873463e85e2445919c85828c7ef4d` |
| `modules/sucafina/Sucafinav1/test/product/native-consumer-repair/observe.test.ts` | ausente | `4a6198381e64f097dc0bcb941d60482cf1d037d1` |
| `modules/sucafina/Sucafinav1/test/product/native-consumer-repair/deadline.test.ts` | ausente | `12d73520e558ffec6b63dcc1c3f452f6add41ec6` |

Patch de 4 arquivos: [assembly/source103-Ccurrent-to-W103.patch](assembly/source103-Ccurrent-to-W103.patch). Quatro imagens integrais (pre/post) no mesmo `assembly/`. Manifesto completo em [SOURCE-MANIFEST-103.json](SOURCE-MANIFEST-103.json). 105 aplica delta seletivo **somente após reconciliar novamente a árvore C corrente** e preparar seu próprio CAS. Não tratar ACK como intake ou check PASS.

## Semântica corrigida

`observeSfRoutineNative<T>(read,signal,timeoutMs=30_000)` agora é exportado corretamente, sem remover imports/tests; valida timeout inteiro positivo até 30s, observa abort/revogação, impede callback novo após abort no mesmo turno, neutraliza reject e não libera resultado tardio. Os leases civil/monotônico de até 300s passam a instalar timer **antes** dos awaits tanto na origem quanto na leitura histórica. Limites pending <=100 e vínculo original Request/C09/C15/Session permanecem, inclusive identidade/contexto/digests/generation. Leitura histórica continua read-only, sem Task/Permission/approval por ID.

## Validar antes de integração e release

- **101**: cinco specs exatos do C51 + dois novos negativos, uma seleção cirúrgica/deduplicada no W103, com S/run/job/attempt/observados. Veja [CHECKS-REQUEST-103.json](CHECKS-REQUEST-103.json). W103: **NOT_RUN** nesta sessão, não atribuir PASS.
- **45**: somente `bun typecheck` nos pacotes `apps/cli` e `modules/sucafina`, `bun run check:guards --base origin/dev`; checks **REQUESTED_NOT_RUN**, nunca testes de produto.
- **105**: receber W/tree/blobs e receipt, preservar producer95 PR104, host-context próprio da105 e owner52; garantir C51 e W103 não sejam confundidos; T0 e 15 WPs/74 tasks/17 contratos/1610 critérios inalterados.
- **93**: recheck independente do código material e do C composto quando houver prova. Review não pode ser assinada por writer103.

**Dependências/HOLD:** produtor95 nativo Request/C15/humano legítimo ainda não comprovado como composto; no provider/Task/Relay/Permission real installed, reautenticação durável after-reload, AM01–06, eight final selections, G7C/G8D e revisões finais ainda abertos. **Readiness OFF; GLOBAL_RELEASE=false.** Terminal encerra somente lease103, não aprova produto nem aceita a própria implementação.
