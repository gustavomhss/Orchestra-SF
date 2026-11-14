# S22 — proposta de leitura consistente por caso

**Proposta estática do autor; desempenho ainda não qualificado por Actions.**

S22 passou os12casos diretos de reader/source/readscope, escolha atual e implantação70000; os dois históricos duráveis excederam180000ms. A mudança agrupa somente o callback de verificação das alternativas da fixture numatransação real `commit:false`, sem reterobservações entre invocações.

O verificador individual permanece byte a byte igual. Cada helper e cada callback de autenticação continuam executados; as leituras aninhadas observam cópias isoladas de uma fonte consistente. Uma tentativa de escrita aninhada envenena a transação raiz, mesmo que o callback capture a rejeição. A transação não retorna sucesso nem persiste mudança nesse caso. A última revalidação assíncrona ocorre dentro da transação; após seu fechamento sóhá verificações síncronas de signal, Request e digest do binding. Todos os irmãos são aguardados mesmo quando um recusa, evitando leitores que sobrevivam ao escopo.

## Arquivos candidatos

| Arquivo | Blob anterior | Blob candidato |
| --- | --- | --- |
| `test/product/wp11/renewal-case-read-scope.test.ts` | `None` | `75a2cbcd0c3907fc2d14f18f2b35f131331ecfb2` |
| `test/product/wp11/renewal-choice-fixture.ts` | `9514f80dc7e8dbb9c8acf1822bbd4f1ea067c0e1` | `2da82bf379910826f4558b5b330c97cdaf6806df` |
| `test/product/wp11/renewal-operation-verifier.ts` | `f85c1c8e7196aff1381513b2d5ed2109641d6a45` | `df3c335c95bf9d8d06d00474ff0bc391dd852b4e` |

O mesmo callback agrupado é usado em `renewal-human-choice-fixture.ts`, cujo verificador separado é exercitado no trecho posterior à confirmação da nova cotação. Os grants humanos, intents, escolhas, recibos e regras de retry permanecem intactos.

| Arquivo adicional | Blob anterior | Blob candidato |
| --- | --- | --- |
| `test/product/wp11/renewal-human-choice-fixture.ts` | `18d95b84d01b26048af9a442c44cb32e8f14e9f5` | `3bbcabb4272ba2d083aa39b03142498178e95193` |

## Quatro casos novos

- O callback real aceita operações e alternativas sem operações, sem alterar nenhum dos três snapshots duráveis.
- Um comando canônico é válido, mas a tentativa aninhada de commit é negada; o callback captura o erro e mesmoassim a verificação global recusa e os snapshots permanecem iguais.
- Um commit canônico posterior invalida a próxima invocação, sem reutilizar o escopo anterior.
- Revogação de autoridade durante o callback de fonte causa recusa.

## Limites

Os sete testes diretos de admissão de fonte e todos os testes já existentes ficam intactos. A prova direta de CAS entre observações top-level permanece separada: o consumidor agrupado demonstra consistência por bloqueio e recusa de escrita dentro do escopo. Não é cache, simulação financeira, C10, ChoiceRecord ou aplicação. Nenhuma fórmula ou autorização foi copiada. Nenhum timeout foi alterado.

O timer sourceOnly de S19 excluía o parse da transação externa; o de S22 inclui as transações. Outros tempos também variaram. Os perfis apontam a fronteira de custo masnãoisolam causalmente o ganho. Somente Actions no novo W/S poderá qualificar as durações. Nenhum teste de produto, importexecutável, Bun ou mutação remota foi realizado nesta proposta.
