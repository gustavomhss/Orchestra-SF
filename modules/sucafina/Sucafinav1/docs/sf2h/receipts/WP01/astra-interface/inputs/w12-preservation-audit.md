# W12 — extensão da auditoria de preservação

**PR:** https://github.com/gustavomhss/Orchestra-SF/pull/31  
**Head:** `cccd00c568aea65bb0c1b5cb4a82c2a236c7e775`  
**Tree:** `b33c50679fa6c2a36a0e309064e1fa57ee4b0a0e`

**Resultado:** nenhum bloqueador de preservação encontrado. Revisão de metadados e diffs do incremento de nossa autoria; não é execução de produto ou aceite nativo/global.

## Reconciliação MCP

| Referência | Head observado |
| --- | --- |
| astra-wp01 | `6f4360bf0bdd444a19a7d4f97e18306ae7618b6f` |
| astra-wp02 | `6ce14163ec6de963b50ada3d610aa8161176adee` |
| sf2-stack | `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0` |
| astra-interface | `cccd00c568aea65bb0c1b5cb4a82c2a236c7e775` |

W11: `a9dfea8907151bbe6a6815d5ff78264c1498026a`, árvore `199d1cc34d412ff9cb8acf1cdb2bb56c6502ccea`. W12 é seu filho direto. PR31 continua aberta contra sf2-stack. Nenhum endpoint de Actions foi consultado.

## Preservação

- **24 commits recuperados** seguem ancestrais: 10 de WP01 e 14 de WP02, desde o merge `23bfad4341008f33fde050bd0d66506fb4035d20`.
- **32 recibos históricos** mantêm modo/tipo/blob. Foram comparadas **192 entradas** entre source original, recuperação, W7, W10, W11 e W12; nenhuma divergência.
- O recovery.json publicado mantém `c268498408c94b1d201ea5d9bf0009cdbc7f8f80`. W7 e W10 permanecem intactos, inclusive suas cópias publicadas.
- Os **dez inputs estrangeiros** mantêm exatamente os blobs já reconciliados nos pins de origem pela auditoria W10. Não houve novo intake estrangeiro em W11/W12.
- prepared-apply.ts conserva `a45436a6fef8598b7ef9eae33d061ddebf0aa43d`, desde o head original de WP02. O binding conserva `6987eddae37ae2c90fe03b2d8e81ea28e8b5221f`. apply.ts continua `4bdd12ac162d61465557363953e25dfd99fad5e8`; answer-reuse.ts continua `134ce5cd8c4f0779380936de6a439c9ea124d932`.
- O campaign.json do pin `dbf9547211d9b0fade619790de7c19c0869b7c7d` mantém SHA256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`, igual ao aprovado. O plano continua como fonte externa imutável.
- **Zero exclusões, zero paths protegidos alterados, zero paths sem ownership classificado.** Os 13 commits após recuperação formam uma cadeia linear, sem merge posterior.
- business-services, business-context, host-context, import-http e document-http conservam os blobs da recuperação. Nenhuma alteração de Protocol/Server HttpApi foi introduzida.

## Deltas W11 e W12

| Intervalo | Paths | Adições | Remoções |
| --- | ---: | ---: | ---: |
| W10 → W11 | 14 | 5867 | 1 |
| W11 → W12 | 12 | 4586 | 9 |
| W10 → W12 | 25 | 10453 | 10 |
| Recuperação → W12 | 134 | 37865 | 2248 |

Os intervalos se sobrepõem e não devem ser somados. As linhas incluem recibos JSON; não medem complexidade do produto.

| Categoria desde a recuperação | Paths | Adições | Remoções |
| --- | ---: | ---: | ---: |
| UI/Dashboard próprios | 15 | 944 | 257 |
| Testes/fixtures próprios | 30 | 3793 | 162 |
| Recibos/findings novos | 76 | 30010 | 0 |
| Manifesto recovery | 1 | 376 | 0 |
| Guia próprio | 1 | 20 | 0 |
| Workflow cirúrgico | 1 | 45 | 0 |
| Inputs estrangeiros exatos | 10 | 2677 | 1829 |
| Protegidos | 0 | 0 | 0 |

W11 acrescenta apresentação passiva do contexto autorizado de revisão em My work, seu helper, oito testes de rendering e documentação. W12 preserva a página original na reemissão do escopo de captura Dashboard, acrescenta uma contraprova real de captura/histórico e documentação. As alterações do observer pertencem ao ownership Dashboard; o issuer público e os inputs estrangeiros permanecem intactos.

## Assertions e alcance das contraprovas

Nenhum arquivo de teste existente foi modificado ou removido entre W10 e W12. Não há nova diretiva skip/only/todo. As nove observações declaradas são aditivas: oito de rendering e uma de identidade real/C08/lifecycle/Dashboard/HTTP. Não foram executadas nesta auditoria.

A única substituição semântica registrada no W10 — disponibilidade de Confirm com confirmação explícita C06/C08 — conserva seu texto e contraprovas. Não se repete nem se amplia essa substituição no W11/W12.

W12 mantém os gates de principal, revisão de acesso, política, continuidade física, igualdade de target/refDigest e fence transacional. A página vem da única combinação de encarnação/tipo/ID persistida; a emissão usa o produtor real e o acesso atual. O teste diferencia Budget Overview de OPEX Detail na mesma fonte física, exige rejeição de substituição e digest forjado, captura/replay com um recibo, leitura autorizada, revogação403 e rejeição de exclusão/recriação. O último estímulo é direto na persistência real e não prova o comando público de exclusão.

## Limites

- Auditoria de metadados/texto do grupo autor; não substitui revisão final independente, prova nativa ou gates S0.
- Não foram executados produto, typecheck, guards, build ou browser; não houve consulta ou disparo de runs.
- As refs remotas representam o momento observado, sem alegação sobre um log completo de escritas históricas.
- Os dez inputs exatos não equivalem à composição completa do host; os findings de outros owners continuam separados.
- Apenas os dois relatórios novos em analysis foram escritos; nenhum arquivo do repositório ou auditoria anterior foi modificado.

Registrado em 2026-11-14T11:15:49.148848+00:00. O JSON contém as entradas, pins, hashes e arquivos de cada incremento.
