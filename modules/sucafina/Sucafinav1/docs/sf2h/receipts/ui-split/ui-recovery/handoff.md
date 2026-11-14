# ui-recovery — handoff do consumidor C12

## Entrega e estado

[PR #46](https://github.com/gustavomhss/Orchestra-SF/pull/46), de `ui-recovery` para `interface-resume`, em draft. O consumidor de apply após resposta perdida/reload tem prova browser aprovada no escopo executado. O primeiro save sem `draftRef` e a recuperação após purge de correlação continuam dependentes de portas externas. Os checks estáticos obrigatórios estão bloqueados no ambiente descrito abaixo. Nenhum desses limites foi convertido em PASS ou GLOBAL_RELEASE.

Produto final W2: `c38a9eb54297baf20df47d296c8d25471ab341b9`, tree `ebfaa2ab9d9f1291c05bf750143b8fc60997e179`. O commit de entrega que contém este handoff acrescenta somente recibos nesse namespace; a PR registra seu head/tree final. Produto, testes, fixtures e configuração permanecem nos blobs de W2.

Base fixa: `2ee71fc90055814912654ae198f7a1dcf9583943`, tree `cf3676a469a1f8bcab05e322ee7a4a1ada0704c5`. Missão: commit `d3d411f7e2476a562a57aa7620823980eaf34e46`, blob `18b58bf661364a9b6e698901129e8365791b3a80`. Plano: `dbf9547211d9b0fade619790de7c19c0869b7c7d`, SHA256 de campaign `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`; packs WP01/WP02 em `a3d29d011ba3607a57914701300f09117a3e2de9`. Os 153 critérios dos dois WPs permanecem íntegros.

## Comportamento obtido

O estado de navegação já conservava o corpo de apply e sua chave. A restauração exigia encontrar exatamente uma alteração na descoberta atual; a lista podia omitir um caso aplicado porque suas fontes haviam avançado. Essa ausência descartava a intenção antes de consultar seu recibo.

A UI agora conserva exatamente `caseRef` com sua versão original, `choiceId`, `changeId`, `reviewDigest`, corpo e chave. Após reload, exige uma nova leitura de opções; a recuperação é uma ação explícita do usuário. Não há replay automático, nova chave, troca de versão ou inferência por posição/título. A descoberta limitada não decide sozinha que a tentativa falhou. Duplicidade de seletores conserva o estado pendente e impede replay até nova descoberta.

A ação usa o `dashboard-hot-topic-apply` real. A admissão humana verifica o acesso atual. O caminho C12 lê o recibo durável antes de executar, confere a prova vinculada ao `reviewDigest` e devolve o mesmo resultado. A jornada original confirmou um único recibo e o mesmo estado/versionamento de caso e domínio após a recuperação. A contraprova de ACK incompleto demonstra que `ok` incompleto não libera nova intenção. A colisão real no armazenamento de recibos retorna 503 `receipt-identity-conflict`; dois reloads/retries conservam corpo/chave e não alteram o domínio.

A contraprova de revogação remove a participação real do caso e recebe 403 do host no replay. O caminho existente de revogação limpa DOM, forms, histórico e correlação. O próprio ator revogado não consegue devolver seu acesso por C08. Uma participação restaurada como entrada administrativa controlada da fixture permite nova admissão HTTP, mas não ressuscita a correlação purgada nem reaplica o domínio. Isso qualifica purge/reauthorização desse cenário; não qualifica uma API administrativa de regrant.

O primeiro save é tratado separadamente. Antes da chamada, a UI registra somente `{ caseRef, key }`, nunca campos, evidências ou texto do draft. Se houver reload antes de receber `draftRef`, mostra pendência explícita, bloqueia outro save e oculta o retry cujo corpo privado não existe mais. O teste cria duas intenções reais com texto igual e prova que a UI não escolhe uma delas por aparência. Esse PASS é do bloqueio seguro; a recuperação efetiva do primeiro save permanece aberta.

## Provas e SHAs

| Execução | Produto W / snapshot S | Resultado observado |
|---|---|---|
| [43620348596](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620348596), job [132524430934](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620348596/job/132524430934) | W1 `db56ec7fe2d1bf78dd2b26f13d708a79f9b23c71`; S1 `1ae238b3119d0759902e100ac2a779001564489a` | **4 pass / 2 fail**, 123 assertions; omni positive control **pass**. O run permanece registrado como falho. |
| [43620823146](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620823146), job [132525878220](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620823146/job/132525878220) | W2 `c38a9eb54297baf20df47d296c8d25471ab341b9`; S2 `a5a2396c106a7762084ade10740bd7033c238960` | **2 pass / 0 fail**, 46 assertions; omni positive control **pass**. Somente as duas contraprovas corrigidas. |

Passaram em W1, sem alteração dos testes originais:

- `Dashboard recovers the same C12 application receipt after a committed response is lost and the page reloads`.
- `partial domain execution reconciles a durable receipt and never repeats it on retry`.
- `UI recovery rejects an incomplete apply ACK then recovers the exact authorized receipt after reload`.
- `UI recovery retains an ambiguous authoritative receipt outcome across repeated reloads without another apply`.

Falharam inicialmente e passaram em W2:

- `UI recovery reauthorizes the restored attempt and purges it on real denial without another effect`: o setup original esperava self-grant pelo ator revogado. C08 corretamente recusou. O teste mantém essa recusa como assertion e recebe o novo grant como entrada administrativa da fixture antes de exercer HTTP/discovery reais.
- `UI recovery distinguishes a lost first save without draftRef and never guesses its identity after reload`: o CSS de botão sobrepunha `hidden`. Uma linha de `display:none` corrige exclusivamente a visibilidade quando há primeiro save restaurado.

Não foi executada uma suite fictícia de seis verdes em W2. As quatro provas não afetadas continuam atribuídas a W1. W2 altera uma linha de apresentação para `draftOutcome` e o setup da contraprova de regrant. Os corpos dos testes próprios de ACK/ambiguidade são byte a byte iguais; os dois testes originais, motores, host, drivers e fixtures compartilhadas permanecem com os mesmos blobs. [checks.json](checks.json) registra essa relação, hashes e seleções normalizadas completas.

Para cada execução, o GitHub compare prova que W → S acrescenta somente `.ci-run.json`: [W1 → S1](https://github.com/gustavomhss/Orchestra-SF/compare/db56ec7fe2d1bf78dd2b26f13d708a79f9b23c71...1ae238b3119d0759902e100ac2a779001564489a), [W2 → S2](https://github.com/gustavomhss/Orchestra-SF/compare/c38a9eb54297baf20df47d296c8d25471ab341b9...a5a2396c106a7762084ade10740bd7033c238960). Requests SHA256: `c267677fa7287b7c94ff2a96eeb6cc3df2a559a6f36540aab00dad1ea3bf5864` e `c6277031f890db541d6db8b47adb960236c89ac4898c863927af39f0517d3a9e`. `validateRequest`/`locateTestPackage` passaram localmente e no runner.

Há cinco relatórios físicos de browser nos testes aprovados: Bun 1.3.14, Node 24.22.2, Playwright 1.59.1, Chromium 157.0.8103.50, spawn por AppProcess. Todos registram zero contexts restantes, saída 0 de Node/browser, websocket fechado corretamente e socket/diretório removidos. O workflow Bun não exige upload de artefatos; a listagem de artefatos está vazia. Os relatórios estruturados e hashes estão em checks.json; a saída completa permanece nos [logs do primeiro job](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620348596/job/132524430934) e nos [logs da correção](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620823146/job/132525878220).

## Checks estáticos

| Check | Estado e limite |
|---|---|
| `bun typecheck`, em `modules/sucafina` | **BLOCKED**, exit 127: `tsgo: command not found`. Não há claim de zero diagnósticos próprios. |
| `bun run check:guards --base origin/dev` | **BLOCKED**, exit 1 antes das regras: objeto Git `077abf65b584aeaba002e67031eb099283332cd1` ausente. O ref local resolveu para `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`. |
| Guard suplementar `--base HEAD`, HEAD local na base fixa `2ee71fc...` | **PASS**, 78 regras, zero gate/warn findings, zero erros no delta desta fatia. Não substitui o gate contra origin/dev. |
| `node --check` do script frontend extraído; `git diff --check` | **PASS**. Apenas sintaxe/whitespace; nenhum produto executado localmente. |
| Contexto do patch externo | `git apply --check` **PASS** contra os três arquivos pinados de compose-resume. **NOT_APPLIED**, sem typecheck/testes do patch. |

Comandos, saídas relevantes e limitações estão em [checks.json](checks.json). O guard de pré-entrega encontrou três logs brutos proibidos pela regra `agent-scratch`; os arquivos foram retirados do delta, preservando recibos estruturados e links dos jobs, sem ignore, aprovação ou alteração de regra. O run estático anterior `43617372378` não é reaproveitado como green atual. O run histórico da PR43 `43616465145` também não substitui as provas acima. Não foram repetidos greens de ACK/Escape/revogação sem mudança que os afetasse.

## Findings e critérios

| Finding | Disposição desta entrega | criterion_ids preservados |
|---|---|---|
| `IR-EXT-C12-RELOAD` | Consumidor verificado no escopo executado; pronto para revisão/integração. Não fecha a composição histórica/global dos owners. | WP01.DOD.03; WP01.CMP.02; WP01.T05.CHK.03; WP01.T05.DOD.01; WP01.T05.CMP.01; WP02.CMP.10 |
| `IR-EXT-FIRST-SAVE-LOOKUP` | **Aberto**. Bloqueio seguro provado, endpoint requerido. | WP02.QLT.02; WP02.T02.QLT.02; WP01.T03.DOD.01; WP01.T03.CMP.01; WP01.T03.SUC.01 |
| `SHARED-APPLY-LOOKUP` | **Aberto**. Purge/novo acesso provados no caso já reconciliado. A variante original domínio confirmado antes de reconciliar + revogação permanece pendente. | WP01.T03.DOD.01; WP01.T03.CMP.01; WP01.T03.SUC.01; WP01.T05.CMP.01 |

[findings.json](findings.json) contém a reprodução e os limites exatos. Nenhum finding original, plano ou critério foi reescrito.

## Inputs dos outros owners

Revalidado `compose-resume` em `d86d119c15d1149fd6f463e07acce836b197eb4e` (tree `a34d95ee5992bbb9099f073baf66422eded90934`). O avanço desde `e1a1888...` foi documental; os blobs relevantes são iguais: dashboard-http `c6c24f4a66315c75dd8b0903ddd70c89b9b9e19c`, dashboard-decisions `f8914c141ba5c72439f5fdba50e9153c4cd477d4`, hot-topic-draft `d8a151c558227b3bd2612dbb6caba993efa85783`. Há evolução publicada de evidência histórica, mas nenhuma rota de lookup de primeiro save. Ela não foi transplantada para a branch fixa desta fatia.

`astra-wp10` observado em `a1434e7ea7340aa1d1c8ce6bb48958b724218170`; `collab-resume` em `0d9820924b33a8fc7b145f54a675aeef76c98489`; `finance-resume` pinado em `9de58454924b072b6e571b5b4ebcd70f95e596df`. São inputs lidos, não código qualificado por estes runs. Nenhuma política financeira foi alterada.

## Paths e próxima ação

Delta aplicado exclusivamente em:

- `modules/sucafina/Sucafinav1/product/interface/dashboard-workbench.ts`.
- `modules/sucafina/Sucafinav1/test/product/ui-split/ui-recovery/fixture.ts` e `recovery.test.ts`.
- `modules/sucafina/Sucafinav1/docs/sf2h/receipts/ui-split/ui-recovery/`.

Host, contratos, produtores, componentes, shell, drivers e fixtures compartilhadas ficaram readonly. Operações remotas ocorreram somente por GitHub MCP. Não houve merge, force push, testes locais de produto, epic, agentes adicionais ou mudança em outra frente.

Próxima ação de S0/compose: revisar os commits da PR46, executar os checks estáticos obrigatórios em checkout completo com dependências e consumir o incremento no candidato. WP10/composição deve integrar e provar a proposta [first-save-outcome.NOT_APPLIED.patch](patches/first-save-outcome.NOT_APPLIED.patch), ou publicar contrato equivalente, antes de conectar esse lookup ao consumidor. O pedido de descoberta/lookup após purge e suas contraprovas estão em [patches/README.md](patches/README.md). Nenhuma proposta externa foi aplicada à produção ou usada para fabricar um teste verde.
