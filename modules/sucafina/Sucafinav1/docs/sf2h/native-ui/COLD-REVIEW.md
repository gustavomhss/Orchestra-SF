# Cold review adversarial — fechamento do planejamento nativo SF

## Resultado e alcance

A baseline `sf-sidebar-plan@2f143330a0a44d34eb764ebfb851804c504edb6d` **não estava pronta para despacho de executores**. Os três pareceres iniciais encontraram 24 problemas de planejamento: um crítico, 17 altos e seis médios. As severidades medem risco de falha ou retrabalho na implementação proposta; não são uma classificação de vulnerabilidades confirmadas do produto.

A revisão produziu correções no próprio pacote: contratos de transporte e componentes, catálogo de operações, superfícies com campos/ações/rotas/copy, ordens pequenas com propriedade de arquivos, dependências separadas e provas delimitadas. O registro de validação e a revisão cruzada abaixo identificam o que foi efetivamente conferido. Nenhum resultado documental concede PASS a uma capacidade operacional.

**Estado final deste pacote:** `PASS_DOCUMENTARY_REVIEW`. Os findings identificados no recorte foram fechados documentalmente, os contratos corrigidos foram relidos por outros autores e a validação estrita terminou sem erros ou avisos. Isso congela o desenho deste pacote; não autoriza execução nem declara produto qualificado.

### Fontes imutáveis

| Fonte | Identidade | Uso |
| --- | --- | --- |
| Plano examinado | `2f143330a0a44d34eb764ebfb851804c504edb6d` | Baseline dos findings; PR76 |
| Código de composição inspecionado | `faa30fddb7e7b61696b66fd069f51cf18c51125f` | HTTP, identidade, desktop, rotas, host e serviços |
| Renderers das 28 capacidades | C27 `b10c424a6b318879fc30f11d03ba1cfeffda7d1a` | Campos, ações, redaction e apresentação herdada |
| Comparação dos renderers | Seis blobs idênticos entre C27 e `faa30fdd` | Nenhum drift conhecido nesses seis arquivos; ver [comparação](execution/surface-source-comparison.json) |
| Planejamento canônico | `dbf9547211d9b0fade619790de7c19c0869b7c7d` | 15 WPs, 74 tasks e 1.610 critérios preservados |
| Blob de campaign.json | `71b56906f8bb190c4d568f60c7511ce1ff63d5f3` | Identidade exata usada para conferir o índice |

Os registros C27/C28 de fontes/HOLD continuam históricos. Não são alegações sobre HEADs móveis. A execução verifica novamente somente os blobs e fatos que consome, sem refazer toda a pesquisa quando o código é idêntico.

## 1. Findings da baseline e decisões de correção

### Arquitetura e autorização

O [parecer de arquitetura](reviews/architecture-review.md) contém os caminhos, pins, evidência direta, cadeia causal e condições de prova de cada item.

| ID | Severidade | Defeito do plano recebido | Decisão incorporada |
| --- | --- | --- | --- |
| AR-01 | Crítica | Same-origin web não cobre `oc://renderer`; `Platform.fetch` não possui sessão SF | D01: broker main por operação, Session isolada, login na mesma partition, sender/owner/generation e download reais |
| AR-02 | Alta | Novo prefixo API atrás de gate que retorna 404 antes do handler | Montagem em local/entry após identity.prepare/bootstrap e antes de business; Request original |
| AR-03 | Alta | Primeiro acesso nativo não executa bootstrap das páginas legadas | Helper original nas três superfícies; mapa ausente é diferente de mapa vazio/revogado |
| AR-04 | Alta | Client precisava conhecer mount antes de descobri-lo | Um discovery metadata no HttpApi global, filtrado pelo projeto selecionado, com injeção CLI → Server |
| AR-05 | Alta | Endpoints, payloads e schemas finais ainda seriam escolhidos pelos executores | Catálogo fechado; reutilizar handlers JSON/bytes e geração existente, com projeções e seams estritamente necessários |
| AR-06 | Alta | Idempotency-Key omitido em operações POST de leitura | Key por leitura e por intenção de escrita; resposta incerta exige reconciliação, sem retry automático |
| AR-07 | Alta | Request reconstruída e lock reentrante poderiam invalidar admission | Preservar identidade de Request, preparação fora do lock, redaction/current e finish originais |
| AR-08 | Alta | Provider dentro da boundary de chapter perde draft ou vaza resposta antiga | Provider estável acima da boundary; owner/auth epoch e descarte de resposta tardia |
| AR-09 | Média | Retorno de login por opaqueRef sem produtor ou ciclo de vida | Bridge única e estado original validado, sem URL livre ou segundo vault |
| AR-10 | Alta | Catálogo, permissão e runtime disponível podiam ser confundidos | Availability independente; bindings tipados de BusinessPorts; sem converter HOLD/infraestrutura em sucesso ou lista vazia |

Essas correções estão em [CONTRACTS](execution/CONTRACTS.md), [catálogo](execution/contract-catalog.json) e nas fichas F01/F02/D01/Axx/I00. Microsoft, desktop, Schedule e demais serviços ainda precisam das provas reais de execução. Um esquema existente não comprova instalação ou readiness.

### UX e paridade

O [parecer de UX](reviews/ux-review.md) confronta o inventário com comandos e critérios originais e registra a inspeção das 17 pranchas.

| ID | Severidade | Defeito do plano recebido | Decisão incorporada |
| --- | --- | --- | --- |
| UX-01 | Alta | Excluir draft de Procurement desaparecia, confundido com cancelamento | `delete/deleteDraft` e `cancel` têm controles, revisão e pós-condições distintos |
| UX-02 | Alta | Import/export de membros atribuídos a Team Structure | Operações permanecem Talent Review com admissão original; Estrutura oferece somente link autorizado |
| UX-03 | Alta | Hoje obrigatório apaga a entrada pessoal canônica | Deep link válido → preferência válida do mesmo owner → Hoje permitido → primeiro destino permitido |
| UX-04 | Alta | Rotas insuficientes para etapas de compra e relações sem caso | Rotas explícitas de criação/detalhe/review; relação direta não exige caseRef |
| UX-05 | Média | Notebook e ciclo de draft sem decisão única | Layout por largura útil e mínimos; tabela única de navegação/refetch/expiry/revogação/resultado incerto |
| UX-06 | Média | Prancha de BI omite Actual e mostra IDs técnicos como copy | Séries/cutoff/lacunas do DTO e títulos de negócio; adendo normativo no PDF |

A comparação do bbox da prancha 16 **não confirmou overflow** do título de aprovação. Essa suspeita foi retirada e não foi contabilizada como defeito. Revisão adversarial exige contraexemplo, não quantidade de acusações.

As 28 capacidades e 42 entradas adicionais estão em [surface-manifest](execution/surface-manifest.json). Os campos herdados ficam presos aos selectors de fonte e suas permissões, sem elevar campo read-only a editor. Copy nova tem literais en/pt-BR; copy herdada sem tradução mantém o literal original conforme COPY-01, decisão explícita e auditável.

### Execução e eficiência

O [parecer de execução](reviews/execution-review.md) contém os oito achados e a conferência independente dos pointers canônicos.

| ID | Severidade | Defeito do plano recebido | Decisão incorporada |
| --- | --- | --- | --- |
| EX01 | Alta | Freeze era uma futura tarefa de design dos executores | Contratos/rotas/exports/props e recuperação definidos no planejamento |
| EX02 | Alta | Megapacotes XL e teto arbitrário de três autores | Ordens por fluxo, componente, adapter e prova; capacidade observada limita apenas o despacho |
| EX03 | Alta | Um DAG confundia autoria, integração e qualificação | Três relações distintas; piloto deixa de bloquear toda autoria independente |
| EX04 | Alta | Harness só começava após o piloto que precisava dele | F04 inicia junto da fundação; prova instalada é dependência explícita |
| EX05 | Alta | Allowlists vagas e ausência de ficha fechada por missão | Arquivos exclusivos, exports, entrypoints, contratos, stop rules e handoff por ordem |
| EX06 | Média | Contagem de critérios não fecha ação por ação | Matriz de superfícies/ações/rotas até owner e prova; índice original é preservado |
| EX07 | Média | Seleção e deduplicação de validação não chegavam à ficha | Specs exatos e política canônica de invalidação/deduplicação, sem segunda fila |
| EX08 | Média | Cada modelo teria de reler e reinterpretar o pacote inteiro | Protocolo comum + ficha + referências locais pinadas, com axiomas herdados |

## 2. Fatiamento final e mecanismo de velocidade

O [manifesto](execution/manifest.json) contém **78 ordens**: uma integração, quatro fundamentos, um transporte desktop, cinco composições compartilhadas, quinze adapters, **47 fatias de interface**, duas provas transversais e três revisões finais independentes. São unidades de entrega; não são 78 sessões ou runners presumidos.

Além de separar Serviço, Segurança, Riscos, Performance, Pauta, Revisões, Relatórios, Fornecedores, Settings, Análises, Rotinas, Recorrência e Residentes, a rodada final separou Hoje, Meu trabalho, Busca, Visões salvas, Hot Topics, OPEX Dashboard, CAPEX Dashboard, FX, Versões e Talent. Páginas de colaboração têm composição própria; os componentes S05 continuam puros e reutilizáveis.

O paralelismo não exige dois autores no mesmo arquivo. Cada ordem recebe uma allowlist; I00 aplica fragments em um conjunto finito de registries. Consumers escrevem contra contratos tipados congelados, sem criar stubs ou outra cópia do produtor. Cada output pode chegar a ARTIFACT_READY e liberar capacidade após handoff, mesmo que integração ou prova espere uma dependência legítima.

O piloto usa fila e aprovação de uma PR persistida, com duas identidades, erro/retomada e prova web/desktop. Os incrementos U10.queue, U13.pr-approval e Q02.pilot evitam aguardar todo BI, importações ou catálogo de componentes para verificar a ligação inicial. O piloto não substitui o ciclo completo de compra nem fecha M31/MI07.

A evidência é reaproveitada somente com a chave canônica idêntica. Componente comum recebe sua prova uma vez; cada tela ainda demonstra seu binding e efeito específico. Full suites e revisões finais continuam obrigatórias no candidato correto. Nenhuma estimativa de ganho linear ou prazo em horas foi inventada.

## 3. Revisão cruzada das correções

Os autores dos três pareceres passaram a produzir partes da correção. Portanto, seus pareceres originais **não aprovam automaticamente o que escreveram depois**. A rodada cruzada examina arquivos de outro autor, e o root reconcilia as decisões comuns.

A revisão cruzada detectou diferenças materiais adicionais: estado `filter-empty` versus `filtered-empty`, detalhe removido confundido com coleção vazia, logout/expiry conflitantes, contrato de contexto apontando para um símbolo NEW inexistente, ausência de handler com owner, grupos de componentes divergentes dos exports, contratos tipados de rotina existentes mas não expostos, callbacks sem payload/retorno fechado e páginas atribuídas a um componente puro sem composer. Cada correção deve estar identificada nos pareceres cruzados, com a referência final examinada.

- [Arquitetura sobre correções alheias](reviews/cross-arch.md)
- [Execução sobre correções alheias](reviews/cross-execution.md)
- [UX sobre correções alheias](reviews/cross-ux.md)

As assinaturas completas são especificação em [component-signatures.ts](execution/component-signatures.ts), [host-signatures.ts](execution/host-signatures.ts) e [route-signatures.ts](execution/route-signatures.ts), complementadas pela semântica em [COMPONENT-CONTRACTS](execution/COMPONENT-CONTRACTS.md) e CONTRACTS. Não são produto implementado.

### Reconciliação adicional do integrador

| Checagem concreta | Decisão de fechamento |
| --- | --- |
| Closure superfície → operações → owner do adapter | Dependências A01/A10/A13 acrescentadas nos consumidores reais; grupo de fundação F01/F02 explícito, sem esconder ciclo ou inventar callback implícito |
| Índices mensais da UI e do produtor | Grid usa 0–11 como os campos b/a/f originais; rótulos de mês são apresentação, não outro índice de escrita |
| Review para comandos legados | Tokens/digests só quando o produtor os emite; criação e confirmação versionada têm formas próprias, sem recibos ou refs fabricados |
| Leitura contextual de Schedule | Nova porta de detalhe tem DTO fechado; sem binding real, editar continua indisponível. Lista não é usada para fabricar recurrence/timezone atuais |
| Provider e store de draft | Registry retido pelo owner; UI recebe facade sem restauração de autoridade. Reautorização e transferência de quarentena pertencem ao provider |
| Conexão remota desktop | Registro NEW e explícito sob confirmação nativa da origem antes de rede; bind continua limitado a identidades aprovadas, sem presumir registry existente |

## 4. O que foi verificado e o que não foi

O relatório [PLAN-VALIDATION.json](execution/PLAN-VALIDATION.json) registra os resultados documentais sobre os arquivos finais: IDs, counts, paths normalizados, sobreposição de writers, grafos, referências, operações, superfícies e pointers. O índice mantém 1.610 IDs únicos/resolvidos contra o blob canônico e todas as 74 tasks. A integridade do índice não prova que todos os critérios serão atendidos pelo futuro código.

O PDF final mantém 17 pranchas identificadas e acrescenta uma página de correções; cada prancha avisa que o adendo e os contratos prevalecem. As páginas adicionada e estampada foram renderizadas e inspecionadas. As 17 pranchas originais foram lidas na revisão inicial desta rodada.

Não foram executados produto, teste de produto, typecheck do repositório, build, geração de client, servidor, CI, deploy ou operação Azure. A branch de planejamento e o texto da PR76 são o único destino externo desta entrega. O briefing, o plano canônico e as branches de produtores permanecem fora da alteração.

## 5. Condições de execução e encerramento

As decisões de arquitetura, divisão, contratos, rotas, copy nova, estados e propriedade de efeitos pertencem ao plano. Antes de escrever, I00 resolve fatos reais: candidato/material, autoridade, leases, atores, capacidade, bindings e disponibilidade. Fato mutável não pode ser inventado antecipadamente para simular um plano completo.

Uma mudança posterior de fonte produz delta e invalidação somente dos consumidores atingidos. Uma contradição descoberta bloqueia o output afetado com contraexemplo e dono; não libera o executor para redesenhar ou afrouxar uma regra. Trabalho independente continua.

Native/Relay/Schedule, Microsoft/B2B do perfil suportado, scanners, persistência, M31/MI07, P03, Reports e os gates herdados continuam exigindo evidência dos responsáveis no candidato apropriado. Esses itens não foram apagados nem convertidos em “fora de escopo”. Eles não impedem autoria contra contratos já definidos, mas impedem afirmar qualificação antes da prova.

O plano revisado pode ser usado como pacote de autorização de implementação; a execução continua dependendo dessa autorização e da custódia vigente. Não há alegação de risco zero, GLOBAL_RELEASE ou FINAL de produto por revisão documental.
