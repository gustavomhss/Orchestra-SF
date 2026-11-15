# 64 → 60 — consumidor de admissão autenticada, fonte entregue

**Entrega de implementação independente e prova de componente concluída. Admissão nativa instalada permanece bloqueada pela capability externa concreta.** PR draft [#80](https://github.com/gustavomhss/Orchestra-SF/pull/80), branch existente `native-admission-proof`.A rota solicitada de integração é60/PR65, cuja lease encerrou explicitamente;45 conserva compiler/guards. `GLOBAL_RELEASE=false`.

## Fonte e execução exatas

| Identidade | Valor |
|---|---|
| Base autorizada | `7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85` |
| ACK anterior ao produto | `ca9a04ca451e4457b2afcfc3def171baf23de9ae` |
| W64 | `0846710321afab84e0c0a3a79653f41df8a284a0` |
| Tree W64 | `4675d209168b5f2fc2f55aa39a7e046d1141db8a` |
| Snapshot S | `e148ff33a1c3f4864d039f5d443934173b8e9030` |
| Tree S | `e7c0ff75835c65c60611162e9f95934d2ac0e2fd` |
| Run / attempt | [43667749802](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43667749802) / 1 |
| Job de testes | [132670817059](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43667749802/job/132670817059) |
| C28 material | `d088708276b48f896ad4e0ecd2a95cb73dc413b1` |

S tem primeiro pai W e **somente** `.ci-run.json` como delta. Readback MCP conferiu os cinco blobs de produto/teste e o envelope. O commit documental que contém este handoff conserva esses mesmos blobs; seu SHA/tree imutáveis são registrados nos comentários de entrega das PRs80/65 após o CAS. O run pertence a W/S, não a esse envelope nem a C28.

**Resultado real:158 PASS,0 FAIL,829 `expect()` calls,3 arquivos,14,32 s.** São71 testes de admissão64,38 de binding41 e49 de fences41. O nonce próprio `1198837a2c77cd67530bfb9bb95968e7` corresponde a um único verdict Omni `not applicable`; houve zero spawn/delegation. A rota Bun não gerou artifacts e não exige upload incondicional; logs integrais, request, metadata e hashes estão em [checks/run64/](checks/run64/). [Resumo](checks/CI-RESULT.json) · [Recibo completo](checks/run64/CI-RECEIPT.json).

Os testes exercitam serviços de componente reais com origem/UI grants/frame/Task/governança explicitamente sintéticos. A Task herdada não executa. Eles não provam provider, Task nativa executada, Relay, aprovação humana instalada, artefato consumido ou reload. IDs/modelos nativos reais não observados permanecem `null`, sem inferência por nome.

## Autoridade atual do destino

No readback final, `sf2-stack` está em `faa30fddb7e7b61696b66fd069f51cf18c51125f`, tree `b3b4f89ddd6a3ca5d570681f91098214b5ce935d`. Esse terminal acrescenta30 documentos sobre C28 e zero mudanças materiais; não é C29. A autoridade60 declara `HANDOFF_TERMINAL_LEASE_ENDED` para `S0-C-e12-browser60`, sem retomada automática ou sucessor. [TARGET-AUTHORITY.json](TARGET-AUTHORITY.json) fixa os blobs e o comentário real. O handoff é entregue na PR65 para a próxima integração autorizada. Nenhum worker ativo, nova lease ou ACK de consumo é presumido.

## O que consumir

O incremento altera somente três arquivos de produto: novo `routine-native-admission.ts`, `routine-native-governance.ts` e `routine-native-registry.ts`; acrescenta dois arquivos de testes64. O [manifesto](SOURCE-MANIFEST.json) fixa pre/post, Git blobs e SHA-256; [patch completo](owned-overlay/complete.patch) e pre/postimages acompanham a entrega. [DEPENDENCIES.json](DEPENDENCIES.json) resolve64 imports literais contra35 alvos existentes e exports públicos, preservando o snapshot transitivo herdado. Isso não é um typecheck.

O hook exige a Request POST e o contexto UI originais, intenção humana exata `routines.run`, origem privada estável e witness41 do Maestro/Task real. Revalida caso, fontes, publicação, principal, policy/access e geração antes do efeito e do retorno. Executa o settlement original uma vez. O replay claim antecede `tryBind`, que não substitui lease ocupada. Revogação/abort/expiração/rotação/dispose alcançam a aquisição antes do primeiro await; dispose também cancela a origem pendente. Nenhuma autoridade é emitida a partir de IDs, nenhuma Task extra é despachada e nenhum engine é alterado.

A [revisão adversarial de fonte](reviews/SOURCE-REVIEW.json) registra as corridas encontradas/corrigidas e seus limites. Não substitui os três pareceres independentes finais da campanha. [IMPLEMENTATION.md](IMPLEMENTATION.md) explica o comportamento.

## Montagem compartilhada inerte

[assembly/host-context.patch](assembly/host-context.patch) contém cinco hunks completos. O host real ficou intacto: preimage `b19c56fdd21fe829fd3bbbb3e377b6fbe0a5825b`, também confirmado em C28; postimage proposto `297a4050323d80648684725f9c7e9a8680aa318f`. Há pre/post completos, hashes, dependências e reconstrução textual verificada no [manifesto](assembly/manifest.json).

A proposta instancia registry41, liga `governance.ownerHook` ao admission64 e usa as autoridades/leitores canônicos. O default não fornece origin. Operações de rotina e watch ficam sem anúncio; a proposta não fabrica registro dinâmico nem readiness.O próximo integrador autorizado na rota60 deve reaplicar seletivamente os hunks sobre o host corrente, preservando alterações posteriores e verificando dependências no candidato real. Não copiar a árvore da branch64.

## Capability externa mínima e aceite ainda aberto

O [contrato concreto](contracts/capability-contract.json), as [notas de API](contracts/API-NOTES.md) e os [pins](contracts/source-pins.json) distinguem APIs existentes de montagem ausente. O produtor autorizado deve implementar `SfRoutineNativeAdmissionOrigin.resolve(actualInvocation)` retornando a mesma associação viva `{request, context, authoritySessionID, intent, signal, current}`. Ele precisa possuir a origem autenticada e a admissão legítima antes do settlement; os IDs apenas conferem fatos.

Faltam a especialização legítima C15/política/budget do Maestro nativo e filhos, a continuação de apresentação/aprovação/Permission humana real, o lifecycle escopado de registro antes do provider e a autoridade nova de leitura/continuação após reload. `sf_maestro` continua distinto de `maestro`. A API de Session não oferece por si só um atestado SF durável de principal; o registry efêmero não pode ser reconstruído de `plan.owner`. A restrição41 a `provider.executed === true` também permanece explícita. Schedule exige sua própria admissão antes de habilitar watch.

O produtor não envolve o runner inteiro em `registry.withRequest`: na rota64, o hook possui esse escopo por settlement, e a forma aninhada é recusada. Ele não deve responder Permission, fabricar revisão/approval, remover marcadores SF para evitar C15, ampliar grants ou criar ledger paralelo. A prova futura deve observar provider → Task/arm/Relay → artefato/digest → consumidor reautenticado após reload, incluindo revogação e idempotência.

Os98 critérios originais estão em [CRITERIA.json](CRITERIA.json), com textos e estados canônicos preservados. [AM-COVERAGE.json](AM-COVERAGE.json) mantém AM01–AM06,5 perfis,18 skills,8 packs e39 rotas sem crédito inventado. WP00.T04/WP10.T06 continuam abertos para qualificação instalada; C/G7,D/G8, oito seleções finais e três reviews continuam obrigatórios.

## Checks45 e ACK solicitado a60

[REQUEST-45.json](checks/REQUEST-45.json) solicita `bun typecheck` em `apps/cli` e `modules/sucafina`, e `bun run check:guards --base origin/dev` na raiz, sobre W exato. **NOT_RUN nesta entrega.** A lane de45 não foi tomada; nenhum teste/compiler/guard local foi executado. O request será publicado em PR32 com este commit fixado; o comentário da PR80 registra o transporte efetivo. O patch inerte demanda checks compostos separados depois de sua aplicação ao candidato.

A [release seletiva](CONSUMER-RELEASE.json) solicita ACK60 com W/envelope, blobs aceitos, disposição do patch compartilhado e de cada capability, candidato de destino e estado dos checks/AM. A ausência desse ACK não é registrada como consumo. A autoridade64 encerra após a publicação documental e o handoff; [AUTHORITY-FINAL.json](AUTHORITY-FINAL.json) conserva todos os HOLDs.A próxima integração requer nova autoridade explícita;45 permanece compiler e S0 permanece aceite final.
