> **Validação final pelo integrador:** produto `dae18b4f43f0daecf46264e876810025684a919d`; Bun 257 pass, Playwright 10 pass, zero falhas/skips/retries, geração oficial e typecheck aprovados. Recibos e escopo em [ci-evidence.json](ci-evidence.json). O texto histórico abaixo conserva a atribuição e o estado da revisão em sua data; estes resultados hospedados não são atribuídos a execução pelo revisor. Permanecem 10 limites nativos e 4 observações humanas.

# WP04 — fechamento estático independente W6

**Conclusão:** FR-01, FR-02 e FR-03 estão corrigidos nos bytes revisados. Não encontrei defeito concreto adicional nos deltas W6 de continuidade histórica, leitura/output de análise e autorização dos CSVs. Não há achado estático aberto neste recorte. Resultados do CI continuam pendentes deste parecer; leitura de fonte não declara testes verdes.

Revisor: `/root/wp04_final_review`, sem autoria nos arquivos de produto/teste revisados. A atuação permaneceu somente leitura: nenhum teste, typecheck, browser, comando git/gh ou operação remota foi executado. Apenas os pareceres e manifestos foram escritos no diretório de revisão autorizado. O repositório é uma materialização local, não um checkout Git.

## Estado dos achados

| Achado | Defeito original e reprodução estática | Fechamento | Execução |
| --- | --- | --- | --- |
| FR-01 · P2 | Sourcing-input esperava request.text() antes de verificar 64 KiB. Um stream acima do limite sem EOF mantinha a leitura aberta; a rota de produto antecede o limite genérico da aplicação. | Helper conta bytes e cancela reader; as duas rotas Procurement o reutilizam. Sourcing limita 65.536 bytes antes do decode UTF-8 fatal/parse. | CI pendente. O fonte conserva stream de 65.537 bytes sem EOF, assert 413, cancelamento e domínio inalterado. |
| FR-02 · P2 | Refresh do shell podia substituir o formulário durante análise ativa. O primeiro patch mantinha dirty, mas uma resposta anterior após cancelamento/novo start ainda podia limpar o guard ou sobrescrever o run atual. | generation, readSequence, runRef capturado e isConnected cercam respostas e finally. Start/cancel invalidam callbacks anteriores. Ativo/incerto mantém dirty; terminal conhecido permite removê-lo. | CI pendente. Contraprova isolada retém terminal run1, cancela, inicia run2 running, libera terminal velho e exige DOM, estado e guard do run2 preservados. |
| FR-03 · P2 | PR submetido em USD podia mostrar valor original rotulado GBP após mudar a moeda base corrente. | procurement-money-v3 preserva a moeda submetida; comparação em outra base permanece indisponível. Moeda ausente/inválida não é inventada e draft segue a base atual. | CI pendente. Produto e teste finance-material são byte a byte iguais ao patch já revisado. |

O checkpoint anterior permanece preservado com as causas e reproduções completas. Seu estado aberto de FR-02 é histórico: este parecer fecha a corrida após releitura da geração/sequência.

## Continuidade histórica W6

Revi readOriginal, resolveHistoricalSource, physicalContinuity e proveContinuity em decision-host; o resolver individual e isCurrent em sources; e o roteamento em business-context.

O WeakMap guarda somente o arquivo original observado pelo produtor, sob o objeto de contexto confiável e o digest do par exato original/current. O produtor preenche a entrada depois de emitir a fonte corrente, construir diferenças, reler o arquivo e repetir os cercamentos de continuidade. Ausência da entrada nega a prova. Não há uma decisão de autorização reutilizável no cache.

proveContinuity revalida o contexto, relê o arquivo protegido e compara seu conteúdo com a observação retida. physicalContinuity resolve novamente a fonte corrente daquele ator, exige a mesma referência e autentica no snapshot corrente. Compara role map, papéis e canWrite; individual.isCurrent verifica escopo, revisão e digest material. A encarnação física deve estar viva e coincidir com as duas fontes. A autoridade é revalidada ao final. A otimização evita repetir a construção da projeção/diferenças; mantém os cercamentos de material e autoridade.

H03 usa domínio/persistência reais: obtém resolução histórica, muda estAmount para 175, verifica mesma encarnação física e de escopo, revisão maior e digest diferente, e exige proveContinuity false para o currentRef anterior. Conserva também a contraprova de remover/recriar o Request e negar fatos/receipts históricos. Esta é avaliação da fonte do teste, sem resultado de execução.

Li review/w6-host-diagnosis.md. Os budgets individuais descritos aparecem na fonte: H02 45 s, H03 35 s, H05 15 s e H06 30 s; H01/H04 mantêm o default. A instrumentação envolve LocalStore real e devolve seus resultados originais. H05 exige namespace acessível, exatamente um receipt, ator/superfície/versão corretos e resultado do domínio exato. As medições W5 do diagnóstico não foram repetidas por este reviewer. Tempos e resultados W6 precisam ser observados no CI.

## analyses.read e analyses.output

A distinção nova é coerente com a fronteira de autoridade. read nega run ausente, inclusive com estado de produto ainda não inicializado. output distingue ausência/fora de autoridade de um run autorizado que ainda não tem resultado pronto. O lookup verifica existência do caso, mesma encarnação, participação, principal, accessRevision e policyVersion.

Estado corrompido permanece unavailable/503. Um run autorizado sem ready/native/output também permanece 503. O caminho pronto conserva decode, digest, caseRef, proveniência/run/session/model/receipt, leitura dupla de fontes/caso/output e reautorização final. Não encontrei ampliação de acesso no novo mapeamento.

Li workbench-analysis completo: exige 403 para read/output de referência forjada e 503 após corrupção do estado, sem nativeSessionId no payload. Esses asserts precisam de execução no CI. O teste negativo não prova execução nativa positiva nem execução do ramo autorizado ainda não pronto, que foi conferido estaticamente.

## Controller e CSVs

Revi applyRefresh do shell real: ele só troca main sem form[data-dirty], diálogo aberto ou foco em formulário. O script W6 mantém dirty desde a preparação, inclusive quando o resultado do start é desconhecido; refresh do histórico não o remove. Os terminais permitidos são explícitos. Falha de leitura ou estado desconhecido mantém o formulário bloqueado. Respostas anteriores precisam corresponder à geração, sequência e run atual antes de alterar controles, dirty ou finally.

O teste Playwright novo usa controller/shell de produção e transporte controlado. Sua contraprova cobre comportamento de UI e ordem de respostas; não prova serviços residentes, modelo, receipt nativo ou qualidade do resultado. O render conserva seleção somente de fontes Procurement observadas, anexadas e com sourcing; o placeholder vazio é explícito.

Em downloads, bankName, accountHolder e bankCountry só entram nas colunas quando o ator possui admin ou supplier admin, os mesmos papéis dos demais campos bancários. supplierCsv só contribui com a parte bancária para esses papéis. Buyer/viewer não recebem nomes nem valores desses seis campos. O teste chama download real após criação/alteração de banco pelo domínio real, cobre quatro papéis, exige 503 se faltar chave para o privilegiado e conserva o estado. Register/PO usam requests visíveis e campos explícitos; o teste contém contraprova de outro requester.

Os rótulos humanos de pré-requisitos também foram conferidos. Durante a selagem, ui-supplier.test.ts recebeu G3 autorizado pelo coordenador. Reli o complemento: ciclo pending/active/blocked/inactive, negações buyer, request ligado criado por comandos, busca/filtro/audit/máscara. Reli G4 no browser: foco após save e reset descoberto/acionado por Tab, Enter, Tab, Space. Não encontrei defeito concreto nesses complementos. G1/G2/G5 fora dos recortes listados não são certificados aqui.

## Evidência e limites

- Hashes foram calculados dos bytes locais após a leitura. Este parecer não certifica commit/tree W6 remoto, publicação ou a igualdade com o snapshot executado no CI.
- O manifesto registra o recorte por arquivo; arquivos grandes receberam releitura dirigida, não nova auditoria integral do repositório.
- FR-01 e FR-03 mantêm hashes dos patches de produto já revisados. Finance-sourcing-integration mudou desde o checkpoint; reli o teste de stream sob o novo hash, sem estender a conclusão a todos os outros deltas.
- Não há novo achado concreto aberto neste recorte. A validação por CI, incluindo testes, browser/typecheck/guards selecionados pelo coordenador, continua distinta deste fechamento estático.
- Catálogo de render, transporte controlado e envelopes adversariais não são prova de execução nativa. Nenhuma medição de jornada humana foi realizada.

## Arquivos e SHA256

Caminhos relativos a `/workspace/scratch/1ae351a91c23/repo`, exceto diagnóstico em review. O manifesto JSON contém caminhos absolutos e o escopo de leitura.

| Arquivo | SHA256 |
| --- | --- |
| `modules/sucafina/Sucafinav1/product/procurement/decision-host.ts` | `2724422b8e7dbeb60b344fbdc437151618957851b571f9e19084c27c958c2f00` |
| `modules/sucafina/Sucafinav1/test/product/wp04/host-integration.test.ts` | `88b08df63cb30a88541bab9f513ac49c8bd942b2a8c4e6493bf4e51da460a8c0` |
| `apps/cli/src/sucafina-product/host-context.ts` | `61976ec0d3bda532ff5244775ffdf10abf181ccb0d31d4ed291419be297a0f52` |
| `modules/sucafina/Sucafinav1/test/product/wp01/workbench-analysis.test.ts` | `a04d5b314b0ace2303cffb2393c1cc5a21d0255991c94a324141e3416eec8507` |
| `modules/sucafina/Sucafinav1/product/procurement/sources.ts` | `9e83e45e2d88f1ed78261c84c7c5c14ae1b0542d8d6400daa6aacfbd01b55910` |
| `modules/sucafina/Sucafinav1/product/host-binding/business-context.ts` | `ea543cc26476c7b20e90b57a54b6d62e8715c3e64063c3878273fc53c2f4cf50` |
| `modules/sucafina/Sucafinav1/product/procurement/sourcing-analysis.ts` | `9622c00f0448204c40e61fcef8a55537ff8425ab7b3c5f5588898f3dfeb71040` |
| `packages/app-shell/e2e/sucafina/wp04/sourcing-controller.spec.ts` | `f37f3349748f65699301e96fc52ee4caa210ce1f05403fb062397f2f7ecd025b` |
| `modules/sucafina/Sucafinav1/src/screen-shell.ts` | `1f399b7a78d5f7914d1327d141ce6abd9d4cec9e99ee6e9342fe283888b4581f` |
| `modules/sucafina/Sucafinav1/runtime/downloads.ts` | `430c42c7c2026edf8bfd3bdecabcc73be52b281c2ef598e9ecf8ca8532c9917c` |
| `modules/sucafina/Sucafinav1/runtime/procurement.ts` | `062a5eff322c004dbc13f7c8b1c216225b260c01731994c7d6ed644a647ba0ce` |
| `modules/sucafina/Sucafinav1/src/supplier.ts` | `e1607db80455888ebcbfff9161ea2684296db8524fd83844265e1c255a9a3313` |
| `modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts` | `8b5250d17f4621ffdcff0502bb2f732705ad9374c7731888a5f1c99bd4563144` |
| `modules/sucafina/Sucafinav1/test/product/wp04/ui-sourcing-analysis.test.ts` | `c6567768c526012d587886342edfcbb16cec4dc8b7064ed5833c6f8d41a14c75` |
| `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts` | `5ad181a1ee1fcb1805f439358c33b977bf26c3e60486775f3431aec34221ddbe` |
| `modules/sucafina/Sucafinav1/product/procurement/http-body.ts` | `8bbbb68be25fd12d8ccebb5993026ebb94a62d31876d9ad85355bc13fbd4c7b5` |
| `modules/sucafina/Sucafinav1/product/procurement/decision-http.ts` | `a16ea242f89df9329d13d7888a534ecfa03bb07192f6168b85cde240ff2ae9b2` |
| `modules/sucafina/Sucafinav1/product/procurement/sourcing-input-http.ts` | `e1c15bb61071fa6b8a1f7358096c862a9330e9c1d78141128c15b89cb0e04347` |
| `modules/sucafina/Sucafinav1/test/product/wp04/finance-sourcing-integration.test.ts` | `72c68f3d26fa1d455f9f2feac0a1aec3673040fd980f3e4686c0ba5042406119` |
| `modules/sucafina/Sucafinav1/product/procurement/monetary.ts` | `b49699f8d77b33e172da91004acc96735ac00911f87a527799752b77df044cd3` |
| `modules/sucafina/Sucafinav1/test/product/wp04/finance-material.test.ts` | `e91f24a82e044f5674c566238dca0d383fa462656f2805708ba92f14e2086517` |
| `AGENTS.md` | `f87f3c732f8aafec8d02501a5f11f050c07d33d350890fb12f69d8b288b830f9` |
| `review/w6-host-diagnosis.md` | `35a66acd310464314b07857964fa65a03eaa1a2c17bbbbf2255207155d2f0820` |

Captura dos bytes: 2026-11-13T23:36:00.392256+00:00.
