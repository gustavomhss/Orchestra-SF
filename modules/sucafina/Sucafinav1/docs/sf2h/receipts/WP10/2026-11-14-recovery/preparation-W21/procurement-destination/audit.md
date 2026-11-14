# W21 — destino Procurement com período por chamada

## Resultado preparado

Correção própria sobre o produto W20 `c3b02c7693c1ff3b702596c7c8458f913972a404`, árvore `f3719144bcaa6cfebcfdbd9cd1283edaae99ae3c`. Foram modificados somente `business-services.ts`, `work-destinations.ts` e o arquivo completo próprio `work-bridge.test.ts`. O manifesto contém os bytes e hashes finais para publicação pelo root.

O check hospedado W20, run `43601767154`, job `132467830629`, terminou em failure. Seu diagnóstico TS2339 em `work-destinations.ts:95` comprova a chamada de método inexistente; esse resultado não valida a correção W21. Nenhum teste, typecheck, build, browser ou import de produto foi executado localmente.

## Causa e fechamento

`createProcurementSourceResolver` expõe `resolve(ref, context)`. O destino chamava `resolveRequestSource`, método do registry de coleções e não do resolver individual. A correção usa a API real e conserva a comparação de recordId, incarnation, versão e período antes de `procurement.read` e dos links de fonte autorizados.

Há uma segunda causa independente: `contextFor` requer o período selecionado. A UI secundária recém-admitida para `{requestRef}` não herda o período do call externo. Além disso, `collect()` chama `work.listPresentation` antes do detail, e essa primeira resolução da coleção também requer período na UI externa. Corrigir apenas o método ou somente a UI secundária não fecha a jornada.

O helper próprio `withProcurementWorkPeriod` usa exclusivamente o `pagePeriods` já existente. Ele envolve `collect()` inteiro, o detail secundário e as duas leituras finais do resolvedor canônico de destino. Não grava no mapa ambiente `periods`, não introduz outro mapa global, cache ou promessa compartilhada e não altera `contextFor` nem os contratos estrangeiros.

O call externo exige a autorização humana exata `collaboration.work.destination` para `{selection, actionRef}`. O secundário conserva a admissão UI real e o intent consumido exato `sf_request_read` para `{requestRef}`; seu período vem do item produzido e precisa coincidir exatamente com o período da seleção. Seu parent deve estar ativo, com a entrada de período original ainda presente. Método, URL, todos os headers, objeto Request, bindings, principal, instalação, projeto, policyVersion, accessRevision, prazo e lease são fixados e novamente verificados após o trabalho. A mesma Request precisa pertencer aos dois calls. O helper recusa sobreposição no mesmo contexto e limpa somente sua entrada por identidade em `finally`; `admitted()` encerra também o lease secundário.

Esse período é contexto de leitura, não uma autorização nem uma prova de existência. O registry canônico continua verificando coleção, autoridade, período, versão e digest; o resolver individual conserva suas verificações de fonte; as duas coletas, comparações de apresentação e testemunhos completos C08 de egress permanecem intactos.

## Provas preparadas para CI hospedado

O arquivo `modules/sucafina/Sucafinav1/test/product/wp10/integration/work-bridge.test.ts` permanece selecionável inteiro. Seus seis testes anteriores e respectivos budgets são byte a byte os mesmos. Foram acrescentados quatro testes de 120 segundos, sem ampliar qualquer budget anterior:

1. Host recomposto e UI nova sem período ambiente: a queue real emite uma coleção, a sonda direta do registry e de work permanece indisponível na nova UI, e a resolução completa do destino seguida de GET exige conteúdo e links reais. As UIs secundárias são observadas no resolver real e precisam terminar; depois do escopo, a ausência de contexto é novamente exigida.
2. Após um item Procurement canônico positivo, um período diferente e outro ator são recusados. O cancelamento real pelo domínio muda a fonte; o testemunho anterior e uma nova leitura deixam de ser aceitos, com sessão e autoridade originais ainda válidas.
3. Um leitor real de coleção prova o scope positivo antes de recusar overlap e contexto irmão na mesma Request. Exceção, alteração de header que não muda a autenticação e encerramento do lease exercitam egress e cleanup.
4. Após leitura canônica positiva, uma exceção introduzida somente depois do resolver individual real limpa os dois escopos. A repetição revoga o acesso Procurement na autenticação real da fixture, mudando o accessRevision antes de retornar; o resultado precisa ser denied e os leases não podem permanecer recuperáveis.

A fixture usa C08, SQLite, source persistence, registry, queue page, work producer, resolver, port e HTTP reais. `Domain.execute` cria e submete a requisição; número, estado, rota pendente e histórico são produzidos pelo domínio. Os observers só registram resultados ou introduzem a mudança causal depois da chamada real. Nenhum item de apresentação, actionRef, captura ou recibo positivo é fabricado.

## Limites precisos

- **A coleção Procurement é efêmera.** O teste recompõe o host e emite uma **seleção canônica nova** pelo produtor da queue. Sua entrada permanece viva enquanto a view a retém. A prova fecha período ausente em UI/host novos; não demonstra persistência de uma referência antiga de coleção, nem relaxa sua expiração ou release.
- A autenticação e a configuração de domínio são inputs explícitos de fixture. Esta prova não é uma jornada de sessão instalada, Entra, browser ou execução nativa.
- Os guards de seleção C08 durável, histórico C17, C12 e source-fence reader anteriores foram preservados. O hunk de business é somente o helper e sua exposição no objeto próprio.
- O status funcional e de tipagem W21 permanece **não executado** até o check e o arquivo completo rodarem hospedados no SHA publicado. Não foi medido ganho de desempenho.
- Esta é autoria e auditoria de builder. A conferência estática auxiliar também é de builder e não substitui os três revisores independentes. Aceites nativo e global permanecem não executados; publicação, PR e integração são responsabilidade do root/S0.

## Integridade

`baseline-manifest.json` ancora os três arquivos originais byte exatos ao frozen W20. `source-manifest.json` ancora os três resultados e seus patches. `failure-provenance.json` preserva a associação run/job/snapshot/log do erro hospedado. `dependencies/` conserva apenas entradas estrangeiras de leitura no mesmo commit para conferir a fixture; nenhuma foi escrita no produto.
