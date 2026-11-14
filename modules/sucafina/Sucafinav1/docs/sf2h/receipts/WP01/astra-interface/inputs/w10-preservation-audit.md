# W10 — auditoria de preservação

**Head:** `0c3d98dd1263a305ce294c78ad5939cdda110a78`  
**Tree:** `5c236ef687871149e9150630a16c4ce0ac70c2a7`  
**PR:** https://github.com/gustavomhss/Orchestra-SF/pull/31

**Resultado de preservação:** nenhum bloqueador encontrado nos metadados examinados. Esta revisão é do incremento de nossa autoria; não constitui execução de produto, aceite nativo ou parecer final independente.

## Reconciliação publicada

| Referência | Head | Tree |
| --- | --- | --- |
| PR #25 — astra-wp01 | `6f4360bf0bdd444a19a7d4f97e18306ae7618b6f` | `514e64f2d5bf25cb2bc2cf0caeeeb2526d77e2b6` |
| PR #21 — astra-wp02 | `6ce14163ec6de963b50ada3d610aa8161176adee` | `4a4d1736b051785f22493ba43d116020821e73be` |
| PR #31 — astra-interface | `0c3d98dd1263a305ce294c78ad5939cdda110a78` | `5c236ef687871149e9150630a16c4ce0ac70c2a7` |
| Base sf2-stack | `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0` | `acf3b722ad55c090bef8e9dc2b3fac2d9ad570af` |

GitHub MCP confirmou as PRs, as quatro refs e as árvores. As branches originais astra-wp01/astra-wp02 continuam nos heads do manifesto recuperado. Nenhum endpoint de Actions foi consultado.

## História, recibos e plano

- Os **24 commits** recuperados continuam ancestrais de W10: 10 de WP01 e 14 de WP02. O merge de recuperação permanece `23bfad4341008f33fde050bd0d66506fb4035d20`.
- Os **32 recibos históricos** conservam modo, tipo e blob: 10 de WP01 e 22 de WP02. Foram comparadas 128 entradas entre head original, recuperação, W7 e W10; nenhuma divergência.
- O manifesto publicado `modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP01/astra-interface/recovery.json` mantém o blob `c268498408c94b1d201ea5d9bf0009cdbc7f8f80` de W7. A auditoria anterior também foi preservada.
- O campaign.json no pin `dbf9547211d9b0fade619790de7c19c0869b7c7d` tem SHA256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`, igual ao aprovado; blob `71b56906f8bb190c4d568f60c7511ce1ff63d5f3`, 1503706 bytes. O plano não está incorporado à branch de implementação e não foi editado.
- Os onze commits após a recuperação formam uma cadeia linear; não há merge posterior, exclusão de arquivo ou path intermediário alterado e depois ocultado pelo diff final.

## Contagem dos deltas

Recuperação → W10: **110 paths, +27412/−2238 linhas**. As contagens textuais incluem recibos JSON e não medem complexidade do produto.

| Categoria | Paths | Adições | Remoções |
| --- | ---: | ---: | ---: |
| UI/Dashboard próprios | 12 | 882 | 247 |
| Testes/fixtures próprios, inclusive README | 28 | 3570 | 162 |
| Recibos/findings novos | 57 | 19848 | 0 |
| Manifesto de recuperação | 1 | 376 | 0 |
| Guia próprio | 1 | 14 | 0 |
| Workflow cirúrgico próprio | 1 | 45 | 0 |
| Inputs estrangeiros byte a byte | 10 | 2677 | 1829 |
| Plano/engines/Azure/deploy/identidade/políticas financeiras/Protocol/Server | 0 | 0 | 0 |

Base → recuperação: **185 paths**; base → W10: **271 paths**. W9 → W10: **17 paths, +7181/−9**: 13 documentos/recibos, um consumidor próprio, dois testes e o input apply.ts. Esses intervalos se sobrepõem; não se somam.

A lista completa por categoria está no JSON. Todos os paths pós-recuperação pertencem ao escopo próprio ou aos dez inputs admitidos. business-services, business-context, host-context, import-http e document-http conservam os blobs da recuperação.

## Inputs estrangeiros exatos

Os dez blobs foram reconferidos por GitHub MCP nos pins de origem. Não foi copiada uma closure inteira do host.

| Path | Pin publicado | Blob em W10 |
| --- | --- | --- |
| `product/contracts/outputs.ts` | `4306b310e4d6dac77f9beab461adad4e8e924849` | `4db2e631bd83ccda67442824557881c2ed990c92` |
| `apps/cli/src/sucafina-product/analysis-verifier-documents.ts` | `4306b310e4d6dac77f9beab461adad4e8e924849` | `0c8ba8bcafd5d85c6d5adadc9907b786cd2ac695` |
| `product/decision-memory/case-recall.ts` | `4306b310e4d6dac77f9beab461adad4e8e924849` | `fdc378d5f251511f66bb256b78240f472f1d566c` |
| `product/decisions/change-proposal-store.ts` | `4306b310e4d6dac77f9beab461adad4e8e924849` | `d7f4199cc20f8e02290107bc64034d3956b42692` |
| `product/contracts/context.ts` | `4306b310e4d6dac77f9beab461adad4e8e924849` | `ae2d6b73a24970ba23d21e17694b54fd32d1a700` |
| `product/contracts/output-schemas.ts` | `4306b310e4d6dac77f9beab461adad4e8e924849` | `0d9fc51d26a0ca726d32e74605b555f871d99af6` |
| `product/integration/human-authority.ts` | `7c7e5b086a9de405cd3f8e18e8d631af55cf0979` | `78529a89586ce9f22d2b2cdd2cd0b1c61d20668a` |
| `apps/cli/src/sucafina-product/personal-view-authority.ts` | `ff7a99753d1fd1bc8b68b4f2642fed26e3cadbdf` | `ab705bc54819ab4c6a41d83b6c6170ada2859a9d` |
| `product/collaboration/answer-reuse.ts` | `ea5a6f965c803d436202934872c3650ab8f8eb19` | `134ce5cd8c4f0779380936de6a439c9ea124d932` |
| `product/decisions/apply.ts` | `ba8a09e371ce8d93eb917eabb102caaee5affaf4` | `4bdd12ac162d61465557363953e25dfd99fad5e8` |

prepared-apply.ts conserva `a45436a6fef8598b7ef9eae33d061ddebf0aa43d` no head original de WP02, na recuperação e em W10. O binding comum conserva `6987eddae37ae2c90fe03b2d8e81ea28e8b5221f`. O intake Operations limita-se a apply.ts `4bdd12ac162d61465557363953e25dfd99fad5e8`; a versão mais forte de prepared-apply não foi substituída.

## Preservação das assertions

No delta W10, a única mudança de expectativa semântica é Confirm passar de desabilitado para habilitado após recuperar uma resposta autorizada, acompanhando o issuer publicado já consumido em W9. A contraprova exige ausência de preparação/confirmação automática, readAnswer ainda não confirmado antes do clique, preparação da identidade exata da mensagem recuperada, confirmação real única em C06/C08 e uma única evolução do storageVersion. O attachment indisponível do fixture continua explicitamente indisponível. O caso separado sem selector nem identidade completa mantém Confirm desabilitado.

A outra troca textual de expect em W10 usa aliases estreitados dos mesmos valores do produtor. A remoção de vista conserva count==0 e lista durável vazia e adiciona uma resposta real posterior suspensa para provar a ordem do DOM. A leitura autorizada atrasada conserva igualdade exata do corpo 200 e as duas assertions de purge após logout/403. O caso de confirmação sem identidade completa recebeu título mais preciso; suas assertions negativas permanecem.

Não há teste removido nem nova diretiva skip/only/todo nos deltas W7→W10. As fixtures BusinessServices preservam as assertions e explicitam seu escopo. As assertions físicas do pool, leases, contextos vazios, PID/exit, fechamento do driver e Omni permanecem. Esta é revisão textual; nenhum resultado de execução é inferido.

## Limites

- Nenhum produto, typecheck, guard, build ou browser executado; nenhum dispatch/poll de CI.
- As refs remotas registram o estado observado; não substituem um log de todas as escritas históricas.
- Pins exatos não fecham composição Dashboard/C12, continuidade de escopo ou outras dependências de integração documentadas.
- Nenhuma edição de produto, plano, engine, deploy, identidade, Protocol/Server, branches originais ou sf2-control feita por esta auditoria.
- W7, manifesto de recuperação e recibos históricos intactos; aceite nativo e gates globais/S0 permanecem separados.
- Durante a gravação do relatório, a fatia W11 autorizada começou a alterar http.ts, o helper/teste work-review-context e o guia no working tree. Esses paths pendentes estão registrados no JSON e excluídos da auditoria dos objetos publicados W10.

Registrado em 2026-11-14T10:59:16.963116+00:00. Detalhes em analysis/w10-preservation-audit.json.
