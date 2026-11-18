# Cold review adversarial da continuidade — achados e disposições por evidência

**Autoria desta revisão documental é a mesma da reconciliação.** É inspeção cruzada e verificação de consistência, **não** substitui o review independente do novo HEAD nem os FINAL canônicos do produto. A revisão77 julgou sobretudo o antigo pin; o novo delta só é elegível depois de um reviewer externo reler as mudanças.

| ID | Contraexemplo que causaria falha silenciosa | Decisão normativa única | Falta para prova real |
| --- | --- | --- | --- |
| R77-F01 | URL A, seleção B; atalho/back troca owner antes de autenticar; late-response A publica no B | `CONTRACTS §2.3`, `F01`, `I00`, `requestNativeTransition` atômico para todos ingressos, sem fallback/Chat | installed web+desktop com dois owners e resposta atrasada |
| R77-F02 | deep link IDs de A, mas middleware exige directory de B, ou server anuncia instalação de outro projeto | `CONTRACTS §2.1`, `ctx.installations` no catálogo com união IDs/location, trusted loaded runtime, no-store | route/provider real + guards/mismatch por conexão |
| R77-F03 | safeReturn alargado aceita redirect aberto/código Microsoft no renderer; roleMap vazio restaurado | intent efêmera single-use >128bits, até 5 min, `dashboard?sf=native-return` que já passa no `safeReturn` legado; bootstrap restrito | ACK72 + callback Microsoft/Graph, reuse/expire/restart/fail, desktop Session |
| R77-F04 | PR title-save é vendido como aprovação; owner muda após precheck, efeito executa com actor diferente; receipt C12 inventado | `X-SF-Native-Owner` conferido dentro Application transação; P0 via `U11.title-save` versus P1 `U13.pr-approval`; CAS `requests:id` | ACK73/74, regredibilidade do POST, produto/holder real, M31/MI07 |
| R77-F05 | unmount descarta draft; 503 vira revogação ou revogação mantém private content | Draft above ChapterBoundary, LeaveGuard, snapshot/retorno revalidado, cancel não cancela POST enviado | revisão visual/segurança + installed owner switch/logout |
| R77-F06 | `SfPersonalView` legado não aceita target nativo; frontend grava objeto arbitrário sem ACL/CAS | `CONTRACTS §5.6` v2 opt-in e A12/U43/UI32, original v1 intacto; landing preference persistida no mesmo produtor | release/ACK do produtor de views v2 + migração/ACL real |
| R77-F07 | grade UI impede colar TSV, ou converte 0 em null, mês 0 em mês 0, e duplica linha já aplicada | S02/A02/U07 component contracts com preview/apply originais, mês UI 0..11 → host1..12, per-row CAS e partial | instalado por OPEX/CAPEX com invalid/locked/multi-row/conflict/320px |
| R77-F08 | review FINAL só cobre UI, números, auth e esquece IA/MCP/Relay/Atlas | R01 produto/UX/native; R02 números/ACL; R03 IA/8 MCP/39 ops/Atlas/Relay/Schedule/docs, mesmo C, sem autoautoria | três reviewers realmente independentes, mesmo C, original gates |

### Testes adicionais de fechamento negativo

| ID | Falha adversarial | Tratamento obrigatório |
| --- | --- | --- |
| NUI-A09 | 20 escritores iniciados sem ACK simultâneo, I00 e Uxx editam mesmo registry | 138 paths da primeira leva checados sem colisão; `launch-record` revalida ownership/leases reais antes de cada GO |
| NUI-A10 | Autor duplica código enquanto aguarda schema ou executa test sem serviço | `ARTIFACT_READY` com dependência e handoff, nada de stub/copy/poll; integração/prova separadas |
| NUI-A11 | Teste verde de C antigo reaproveitado em C novo, ou suite reiniciada sem mudança causal | chave canônica completa + matriz de invalidação; evidência identificada por C/tree e run/job/attempt |
| NUI-A12 | HTTP POST chunked bloqueado, mas atribuído a ausência de Content-Length | M79/M74/M94 se ativos exigem prova da fronteira causal, não hipótese; nenhuma UI declara P1 verde por mock |
| NUI-A13 | Desktop `oc://renderer` usa fetch web/cookie de outra partição | D01 broker main + typed allowlist, session isolada, auth e download revalidados |
| NUI-A14 | scanner indisponível tratado como limpo, Schedule parcial tratado como completo | estados unavailable reais, nenhum PASS por stub; R03/CI original preservados |
| NUI-A15 | views/preferência usam memória local e aparecem persistidas | produtor preferences original com CAS/restart/two owner e readback; UI32 HOLD até implementação |
| NUI-A16 | edição de salário/ou FX ou paste mensal recalcula no browser | fonte `monthly-host/monthly-edit`, per-row errors, zero/inherited/locked, nenhum cálculo paralelo |
| NUI-A17 | UI fragmentada em 47 ordens deixa import/alias/rotas sem fonte central | I00 único registry, contratos TS congelados, `SURFACE-SPECS` 70 superfícies/305 operações, total 78 ordens e 1.610 pointers no validator canônico |
| NUI-A18 | terceiro reviewer implementa sua própria correção e aprova | substituição explícita do reviewer; cold review documental não satisfaz FINAL de produto |

### Evidência realmente verificada neste turno

- GitHub readback do plano original `PR76@de7da`, PR91/FIX-FIRST e fonte instalada de `personal-views.ts`, `views-http.ts`, `monthly-edit.ts`, `monthly-host.ts` no checkpoint `sf2-stack@5585e57f...`.
- `safeReturn` real em `runtime/local-identity.ts` admite **somente** dashboard/planner/procurement por pathname e preserva query; a bridge usa dashboard com marcador, sem mudar a allowlist. A implementação do marcador ainda está por fazer.
- Checagem JS de 20 cartas, 138 claims/sem colisão, 78 ordens (19+58+I00), 70 superfícies, 305 operações, P0/P1 e owner UI32/U43 passou. `validate_dispatch.py` e o `validate_plan.py --strict` ainda precisam ser executados no ambiente autorizado; não transferir PASS de antes do delta.
- Nenhuma evidência de compilação, testes de produto, Microsoft real, CI, P03, M31/MI07, scanner, Azure, deploy ou aprovação de S0/71 foi obtida por esta revisão. `GLOBAL_RELEASE=false`.

### Risco residual explicitamente NÃO mascarado

1. **Autoridade:** releases/ACKs em paths de produto e capacidade real de atores/runners devem ser observadas no lançamento; o planejamento não os fabrica.
2. **Stack/source drift:** contratos foram derivados de pins históricos e fontes pontuais mais atuais; cada família consumida precisa de re-pin e delta antes de autoria/CI.
3. **Produtor pessoal v2:** o código que persiste v2 e landing ainda não existe; o contrato está especificado, mas a feature fica bloqueada até writer autorizado.
4. **Runtime de auth/fence:** return-intent, broker desktop e nativeCommandPrecondition são trabalho planejado e requerem regressões instaladas reais.
5. **Revisão externa:** os oito fechamentos foram incorporados normativamente, **mas** a aprovação independente do novo delta ainda não ocorreu.

**Veredito:** `DESIGN_RECONCILED_AND_DISPATCH_SPECIFIED` com `RUNTIME_EXECUTION_AUTHORITY_PENDING`. Não há alegação de que erros futuros sejam impossíveis, de que os 1.610 critérios estejam satisfeitos ou de que 20 sessões estejam efetivamente lançadas.
