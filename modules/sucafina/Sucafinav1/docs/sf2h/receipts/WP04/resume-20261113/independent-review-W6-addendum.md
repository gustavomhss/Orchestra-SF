> **Validação final pelo integrador:** produto `dae18b4f43f0daecf46264e876810025684a919d`; Bun 257 pass, Playwright 10 pass, zero falhas/skips/retries, geração oficial e typecheck aprovados. Recibos e escopo em [ci-evidence.json](ci-evidence.json). O texto histórico abaixo conserva a atribuição e o estado da revisão em sua data; estes resultados hospedados não são atribuídos a execução pelo revisor. Permanecem 10 limites nativos e 4 observações humanas.

# WP04 W6 — adendo final de preservação e composição C02

**Conclusão:** não há achado concreto aberto nos deltas finais revisados. Preservação de enums, metadados de arrays e composição C02 estão coerentes nos hashes abaixo. Dois defeitos concretos encontrados durante esta releitura — precedência de erros antes do CAS e fallback quando services estava ausente — foram corrigidos e relidos. Os resultados de CI permanecem pendentes.

Este adendo complementa `WP04-independent-review-W6.md`; para arquivos alterados novamente, os hashes deste documento substituem os do parecer anterior. Os pareceres anteriores ficam preservados. FR-01, FR-02 e FR-03 permanecem fechados estaticamente. O reviewer não alterou produto/testes, não executou testes, typecheck, browser ou LLM, e não usou git/gh nem operações remotas. Apenas artefatos de revisão foram escritos.

## Preservação dos valores registrados

### Enums fora do catálogo atual

Confirmei a causa apontada pela UI: um fornecedor já aceito com type=company ou riskRating=low não tinha option correspondente, de modo que salvar outros campos pelo formulário poderia substituir os valores. scalarFields agora acrescenta somente o valor já gravado que esteja fora do catálogo, com rótulo Recorded value e seleção pela igualdade existente. selectField continua escapando valor e rótulo. O catálogo de fornecedores/quotes e a validação do domínio não são ampliados por essa apresentação.

Li o teste que extrai option[selected] do renderer real e usa os valores extraídos num save real do domínio, mudando o telefone e exigindo preservação dos dois enums. Isso é fonte de contraprova, ainda sem execução.

### Metadados de quotes e linhas PO

Confirmei o problema anterior: o adaptador substituía os arrays antes de capturar business; restore recebia uma cópia que já havia perdido description/notes/attachments ou os campos legados das linhas PO.

A correção retém os metadados antes de compactar as linhas removidas e novas. Quotes existentes são correlacionadas por ID único. Para PO, o renderer emite _rowRef sobre o request e o hash dos campos omitidos description/unit/notes; o índice é uma dica de localização. A referência não depende de CAS, preço ou quantidade. Ao reencontrar pelo digest, duas linhas com digest igual representam os mesmos metadados omitidos. Essa regra permite manter a referência visível depois de preço alterado, reordenação ou remoção que muda o índice.

Valores explicitamente enviados prevalecem. Linhas marcadas _new não herdam metadados anteriores. _new, _remove e _rowRef são removidos antes de business/persistência e não tornam uma linha vazia artificialmente preenchida. O marker é somente uma associação de apresentação; não concede permissão ou substitui CAS. Metadados que já não correspondam ao snapshot corrente produzem erro adjacente, em vez de herança silenciosa.

As duas contraprovas lidas extraem inputs do renderer e chamam domain.execute. PO cobre dois saves com as mesmas referências, reordenação, remoção/inclusão e mais dois saves sem regenerar as referências; cobre marker duplicado/forjado, ausência de efeito após erro, metadata concorrente→409 e requester sem poder de edição→403. Quotes cobrem ordem alterada, exclusão e nova linha reutilizando ID sem herdar notas/attachments, prevalência de valor explícito e duplicata rejeitada sem efeito.

### Defeito encontrado no rascunho: 422 antes de CAS

O primeiro adaptador devolvia erro de retenção antes de conflict() e dos gates de edição. Repro estático: uma PO v1 aberta conserva o marker; outro ator altera notes e grava v2; save v1 não encontra o hash antigo e devolve 422 antes do 409 que abre a revisão de conflito. O resultado de metadata também era consultado antes do 403 para um não editor.

O patch final separa as etapas: a primeira normalização não consulta metadados. Somente após conflito/CAS e permissão da ação é feito o segundo inputs, usando submittedValues original e limitando a retenção à seção sourcing ou PO efetivamente editável. Reli essa precedência e a contraprova adicionada. **Fechado no código; CI pendente.**

## Composição da página C02

### Preparação, autoridade e material

queue-page prepara a seleção e chama o produtor C02 fora da transação da página. A apresentação é criada a partir dos valores da projeção; não reconstrói uma segunda máquina de estados de negócio. queue-view valida referências/contexto e marca a apresentação produzida no processo. O renderer consome essa apresentação e fecha se uma apresentação fornecida for inválida ou não corresponder aos requests autorizados.

Application aguarda productView.current dentro da transação que autentica o ator da página. O cercamento confere principal, revalidação UI, coleção, encarnação/revisão, papéis, canWrite, role map, moeda, quantidade de registros, unicidade e digest material de cada Request. A preparação não pode ser usada depois de alteração relevante ou revogação sem falhar.

A leitura dirigida do caminho UI revalidate→product-authority.resolve confirmou uso de currentSnapshots quando a transação da página já está aberta. As verificações current do registry e domain.view operam sobre esse snapshot. Não encontrei abertura de nova transação/lock nesse caminho. O wrapper source-lifecycle preserva o acesso aos snapshots atuais.

### Período e liberação

O período de página fica em WeakMap por objeto de contexto. Ele não sobrescreve a seleção de período do Workbench armazenada por identidade. contextFor verifica que a seleção retida continua a mesma após a fronteira assíncrona.

releaseSelection remove a seleção e seus filhos pela identidade do objeto scope criado para aquela emissão; uma seleção equivalente de Work/BI possui outro objeto e permanece válida. Application usa finally para chamar finish após sucesso, negativa, exceção ou falha de render. O caminho de falha durante preparação também finaliza a admissão e libera o que foi adquirido.

Li a fonte dos testes de composição real que intercalam mudança material/revogação entre preparação e render, verificam ausência de dados na resposta negada, preservam o período Work anterior e conferem liberação da seleção de página. O teste lifecycle verifica liberação dos filhos sem invalidar a seleção Work/BI equivalente.

### Defeito encontrado no mount: fallback com runtime indisponível

O mount local antes usava somente optional chaining. Com runtime criado e services() ausente — possível quando identity não está disponível — ele retornava undefined. Application seguia sem productView, e o renderer caía na fila legada porque não recebia a propriedade procurementQueueView.

O mount final devolve 503 em Requests/My approvals quando o runtime configurado não fornece services/productView. O modo explicitamente standalone, sem runtime criado, conserva o contrato anterior; esse modo não constitui evidência C02. Reli a correção no hash bb6338… abaixo. **Fechado no código; CI pendente.**

### Montagem browser e navegação

O host de browser monta a aplicação, LocalStore/lifecycle, autoridade e business services reais, com operadores sintéticos. productView é o produtor C02 efetivo. Essa montagem não comprova Entra nem execução nativa de IA.

As duas tabelas C02 agora usam GET para abrir o Request autorizado: links conservam os três atributos de fonte e fazem nova leitura ao navegar. Reli a alteração final do link Requests e a montagem de My approvals. Também li o complemento reversível de filtro por teclado no sexto teste browser: filtra uma busca sem correspondência, volta a All, busca o ID e exige a linha com o montante esperado. Não executei esse teste.

## Limites e selagem

- Não há defeito concreto restante no recorte revisto. Isto não declara CI verde, publicação concluída ou aceite geral de release.
- Os hashes são dos bytes locais congelados. Não certificam commit/tree remoto nem igualdade com o snapshot que o CI executará.
- Fontes de teste são planos de contraprova, não evidência de execução. O teste de metadados não substitui uma jornada browser executada.
- O manifesto registra o escopo preciso por arquivo; a revisão não foi ampliada a outros testes ou áreas.

## Arquivos e SHA256

Caminhos relativos a `/workspace/scratch/1ae351a91c23/repo`. O manifesto contém caminhos absolutos e os recortes de leitura.

| Arquivo | SHA256 |
| --- | --- |
| `modules/sucafina/Sucafinav1/runtime/procurement.ts` | `d98793e89db88819ac35ccee29223a10f4133eeba55a374abca0c343c921f55b` |
| `modules/sucafina/Sucafinav1/test/product/wp04/ui-guidance.test.ts` | `ed7eaee8d3514f48088514a40cd5b71009e8ac5e1b7ba51a2d07e4c60cb1cb53` |
| `modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts` | `00555d0431d25861692d8090256605567feb6d6e4b1c694d260ddb9355c31648` |
| `modules/sucafina/Sucafinav1/src/screen-shell.ts` | `1f399b7a78d5f7914d1327d141ce6abd9d4cec9e99ee6e9342fe283888b4581f` |
| `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts` | `57c8298185c76e92607c63018c6a6ca950f2ba391ad32d644f0539e1e9d95d4d` |
| `modules/sucafina/Sucafinav1/product/procurement/queue-page.ts` | `be9e9ac6d8e5be8d2fecd845874a83e5a2f06f68ecd02933d8b0986bf9207585` |
| `modules/sucafina/Sucafinav1/product/procurement/queue-view.ts` | `2bb95b57920afa8fb102e26eac8bc04e87fab8f6b667329b5be1404425e45728` |
| `modules/sucafina/Sucafinav1/product/procurement/sources.ts` | `690ad63560314587ecb355a7185650796c6c6ddd5e9da2015f34d1966893b311` |
| `modules/sucafina/Sucafinav1/test/product/wp04/queue-view.test.ts` | `17371b9547f3f6d89530aacdbbbe4e2773f52a75635e886ae6fb4387fc38beed` |
| `modules/sucafina/Sucafinav1/test/product/wp04/queue-lifecycle.test.ts` | `d0dd24195886e86e06b5281aab8e3ae266a40274c9c63dd5564325d7cbb5c6b0` |
| `apps/cli/src/sucafina-product/business-services.ts` | `c9fa508f217028cd8b4d51301d37078968971121ed6fb3d75c0838b06bfa8084` |
| `modules/sucafina/Sucafinav1/runtime/application.ts` | `c1ac0f971c3296af6e672a3190c75f631d77b289216eff794f987cf244416bef` |
| `modules/sucafina/Sucafinav1/local/entry.ts` | `bb6338a89c5d6ad85450c5f9ee74a81f1395e66ea47edfe5d0de8f53abbc0efe` |
| `apps/cli/src/sucafina-product/host-context.ts` | `a379060740e02e7d02fea9f6197d3320e4a75b5dd92bc3c1d8bf5cfa4dfdf2a2` |
| `modules/sucafina/Sucafinav1/product/contracts/host-context.ts` | `de63ec47412f45367e0be68eb8ee59c8f8149c8a8c31220e75a319e2197432f2` |
| `packages/app-shell/e2e/sucafina/wp04/host.ts` | `16832c32c55cb9034df25b8058200290af8c0f3ef1845cf64ae5c120b4e594e4` |
| `modules/sucafina/Sucafinav1/product/integration/product-authority.ts` | `2d7f17f0b59eedcf07be5abe7f3672756ca32833a91362c301fe36b0657c1b2f` |
| `modules/sucafina/Sucafinav1/product/integration/ui-authority.ts` | `b6e875b8fc9ff731d225af16f84966bf78f6c1f65aefb852ef52a2983c6ec93e` |
| `modules/sucafina/Sucafinav1/runtime/local-store.ts` | `c8ce4f6d20eb89d2adebc6577692c310b65310be251784b109431bc18a7c26e5` |
| `modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts` | `4bf78ba13cc1533a93408b97125e66b21bbadf26b286176252ab9fd8930f0289` |
| `modules/sucafina/Sucafinav1/product/procurement/port.ts` | `7b67e94e0ca50e553854b048a0372d34f41ca273d4cf46bd6bebb0727413b49f` |

Captura final: 2026-11-13T23:57:19.493195+00:00.

## Publicação informada pelo coordenador

Após a selagem local, `/root` informou a publicação W6 `0506d7c72767249e6482a8c9137df5fef07f0ea0`, tree `8cc54f37dce0c45a31e77dffcd58c1b31dff371e`, e CI 53 sobre snapshot `81af101efd650fa84a36d3c11e09c52d89e0cf20`, afirmando correspondência com os bytes revisados. Essa é proveniência reportada pelo coordenador, sem consulta remota por este reviewer. O resultado do CI segue pendente.
