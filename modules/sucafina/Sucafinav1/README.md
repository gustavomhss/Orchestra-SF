# Sucafina — composição WP10

Este módulo pertence à instalação Sucafina. O candidato WP10 compõe outputs publicados dos domínios no host existente do Orchestra. A entrega está **em revisão, com pendências de integração**. Commit e PR publicados não representam homologação, execução nativa, aceite global ou deploy.

A entrada é `createModule(mount, services)` em [index.ts](index.ts). O factory [local/entry.ts](local/entry.ts) usa o processo, listener, identidade e armazenamento da instalação. [O pacote WP10](docs/sf2h/receipts/WP10/) reúne pins, mapa dos 171 critérios, requests, evidências e deltas para S0 e os demais owners. O planejamento em `docs/sf2h/control/` permanece normativo.

## Trabalhar com os dados

Comece pela superfície da tarefa: Dashboard para acompanhar pessoas, orçamento, riscos, operações e ações; Planner para versões, valores e cenários; Procurement para pedidos, fornecedores, propostas, contratos e compras. A mesma pessoa pode ter permissões diferentes em cada superfície. Perfil de agente, cargo exibido ou conhecimento de um ID não concede acesso.

Antes de comparar, confira período, moeda, fontes e cobertura. Uma referência identifica também encarnação e versão da fonte. Reutilizar um ID após excluir ou importar um registro não recupera a autoridade anterior. Atualize a seleção quando a origem mudar.

| Estado ou valor | Interpretação |
| --- | --- |
| Zero informado | A fonte contém zero; preserve unidade, moeda e período. |
| Ausente ou indisponível | Não há evidência suficiente. Não substituir por zero. |
| Estimado ou hipotético | Hipótese explícita; não equivale a evidência confirmada. |
| Subtotal conhecido | Soma dos componentes conhecidos no recorte permitido; não comprova custo total com categorias pendentes. |
| Comparação completa | O domínio declara cobertura completa e compatibilidade. Preserve fontes e limitações. |
| Comparação condicionada | Há dados conhecidos e condições que impedem uma conclusão completa. Mantenha-as no relatório e na decisão. |
| Moeda/período incompatível | Não somar ou ranquear como equivalentes; conversão e alinhamento precisam de fonte autorizada. |
| Fonte stale ou substituída | Reabrir a origem e refazer a preparação. Resultado antigo não autoriza nova escrita. |
| Resultado historical | Deve conservar identidade original e diferenças atuais autorizadas; o percurso integrado ainda está pendente neste candidato. |

Cálculos, cenários e rankings vêm das portas de domínio. Texto do agente não se torna cálculo oficial pela aparência da resposta. Proposta, prévia e contribuição aceita também não são recibos de aplicação.

## Guia por pessoa e tarefa

| Responsabilidade | Percurso | Conferir |
| --- | --- | --- |
| Liderança/revisão executiva | Selecionar período/seções, revisar fontes, preservar revisão, preparar material | Cobertura, comentários vinculados, limitações e versão preservada |
| Planejamento | Abrir versão, conferir hipóteses, comparar cenários e critérios | Moeda, horizonte, subtotal, custos pendentes e origem das operações |
| Solicitante/comprador | Abrir pedido autorizado, conferir propostas, comparar sourcing, preparar mudança | Estado, condições comerciais, aprovação e recibo efetivo |
| Responsável por ação | Abrir trabalho/pergunta/dependência, responder ou confirmar | Registro original, seleção atual, gravação e conflito |
| Revisor de decisão | Conferir caso, contribuição e condições; escolher ou solicitar análise | Caso/versão, comparação, rationale e separação entre proposta/aplicação |
| Administrador | Configurar grupos/grants, conferir serviços e recuperação | Identidade efetiva, escopo por superfície, store e transporte |

Os perfis `sf_maestro`, `sf_finance`, `sf_procurement`, `sf_portfolio` e `sf_reviewer` recebem apenas skills/operações admitidas pelos manifestos e pela autoridade atual. O bundle contém 18 skills; catálogo não demonstra carga real ou consumo. O mapa distingue pares montados, consumidores e provas ainda não executadas.

### Preparar, revisar, decidir e acompanhar

1. Abra fontes permitidas e fixe período, moeda, objetivo e critérios do caso.
2. Prepare a análise a partir da escolha humana. Se fonte, skill ou serviço estiver indisponível, conserve o motivo e resolva a dependência.
3. Revise contribuição, fontes e condições. A confirmação humana deve corresponder ao conteúdo apresentado.
4. Escolha a alternativa e prepare a mudança. Confira alvo, versão e prévia; preparar não aplica.
5. Aplique pelo fluxo autorizado e consulte o recibo. Em conflito, preserve sua intenção, reabra o estado atual e prepare novamente. Não repita uma escrita cegamente.
6. Acompanhe perguntas, condições, confirmações e resultados no mesmo caso. Resposta posterior pode exigir reavaliação; não modifica silenciosamente a escolha anterior.

Este é o roteiro de homologação a executar após resolver os deltas de consumidores. O adapter HTTP do host admite a preparação com a ação humana correspondente ao conteúdo selecionado. Preparação e aplicação de portfólio, resultados históricos e rotinas ainda dependem das portas descritas no pacote de revisão. Botões ou descriptors não comprovam esse percurso completo.

### Revisões, relatórios e BI

Uma revisão preservada mantém o conteúdo selecionado. Mudanças posteriores pertencem à revisão seguinte e à comparação explícita. Relatórios devem conservar a cobertura selecionada e limitações, sem ampliar dados permitidos à pessoa.

O host compõe as portas publicadas de revisão, comentários e BI no mesmo store. Liga Dashboard BI01/BI07/BI08, Planner BI01–BI04, Procurement BI05/BI06, cenário BI09–BI11 e portfólio BI09/BI10. Cenário e portfólio exigem resultados e seleções persistidos; BI11 exige sensibilidade real. As tabelas de decisão preservam as limitações dos produtores: ainda não há plano publicado de waterfall/timeline para BI09/BI10. A preparação contextual aceita uma seleção humana explícita de Dashboard BI01/BI07/BI08 ou um pointer de artefato previamente salvo. Teste de registro não substitui observação de gráfico, download ou uso por uma pessoa.

### Documentos, importação e exportação

Anexos exigem armazenamento privado transacional, scanner real, limites configurados e a mesma instância autoritativa de persistência. A resolução de schema se vincula ao documento autorizado, mesmo quando a seleção começa por ID de evidência. Sem esses serviços, upload e extração ficam indisponíveis.

Revise a prévia antes de confirmar importação. O parser não executa macros ou fórmulas como código. Referências privadas de outro store e configuração de acesso não entram pela importação pública de negócio. Substituição de fonte invalida seleções antigas. Confira formato e cobertura do download; título ou link não comprova conteúdo.

### Erros e recuperação

| Situação | Comportamento esperado |
| --- | --- |
| Outra pessoa salvou depois da leitura | Conflito com estado atual; confirmação anterior não autoriza sobrescrita. |
| Permissão revogada durante a operação | Recusa no retorno ou commit; sessão/recibo não é grant. |
| Scanner ou serviço documental indisponível | Indisponibilidade explícita, sem escrita fictícia. |
| Interrupção antes do commit | Zero efeito parcial; conferir estado antes do retry. |
| Resposta perdida após commit | Retry idêntico recupera identidade durável; mesma chave com outro conteúdo é conflito. |
| Memória sem fonte atual autorizada | Não mostrar precedente inteiro como válido. Recuperar recibo difere de autorizar recall. |
| Rotina sem admissão C07 real | Permanecer pendente; publicação ou Session avulsa não substitui admissão governada. |

A memória usa `createMemoryEmit` e `createMemoryRead` reais do Atlas protegidos pelo C08; ledger Sucafina é oficial. Gitleaks é resolvido pelo toolkit canônico com caminho absoluto e versão observada. Novos appends exigem fontes frescas e fence das três superfícies. Recuperação do recibo revalida caso/evento sem nova varredura.

O host limita custo de ancestralidade antes de IO e não reutiliza autorização entre releituras. Referências exatamente iguais são resolvidas uma vez dentro de cada chamada de contexto; o orçamento é aplicado antes da deduplicação e a próxima chamada volta a ler as fontes. Grafo acima do orçamento técnico retorna indisponibilidade. Política/project, histórico com diferenças de domínio e variantes C17 ainda pendentes não são cobertos por uma prova de caso com fonte inalterada.

## Roteiro sintético reproduzível

Use homologação autorizada e dados inventados, rotulados como sintéticos. Este guia não inicia servidor, envia notificações ou cria compras reais; os passos abaixo ainda precisam de observação no candidato correspondente.

1. Configure editor e viewer com grants explícitos. Viewer lê somente seu recorte e não escreve mesmo conhecendo o ID.
2. No mesmo período/moeda, inclua valor confirmado 100, zero confirmado e valor ausente em registros distintos. Observe três significados distintos.
3. Prepare renovação com duas alternativas e uma categoria pendente. Subtotal não deve aparecer como total completo.
4. Abra ação em duas sessões autorizadas; salve na primeira e tente versão antiga na segunda. Observe conflito sem perda silenciosa.
5. Preserve revisão; altere origem; confira conteúdo preservado e comparação seguinte. Inclua 25 registros e campo negado ao viewer.
6. Grave evento, reinicie processo e confira recuperação durável/recall. Revogue fonte: o registro revogado deve ser suprimido.
7. Após fechar bindings, execute preparação, análise nativa e consumo. Registre perfil, skill, handler, principal, caso, versões, digests, recibo e ação do consumidor.
8. Exercite indisponível, conflito, cancelado e revogado. Medição visual/p95 exige ambiente fixo e repetições comparáveis; tempo de CI não é benchmark de UX.

Dados de fixture, markup, catálogo e autoridade fabricada não contam como jornada nativa. O revisor deve registrar o que aconteceu, inclusive a primeira etapa bloqueada.

## Composição, persistência e operação

O host compõe autenticação, ambiente, fontes, casos, domínios, documentos/imports, colaboração, revisões, BI e runtime residente. UI, ponte MCP privada e consumers usam contratos compartilhados e revalidam identidade, política e revisão de acesso.

A composição de análise registra os 18 pares canônicos de produtor/verificador quando os serviços documentais estão disponíveis. Inclui enquadramento com e sem import, extração documental, BI contextual, memória atual, dossiê de compra, contestação atual, sensibilidade, portfólio e reavaliação. Os últimos três usam produtores publicados de prova, critérios e materialidade, conectados ao C08 da instalação. O contrato canônico preserva as 39 operações. Os seis serviços de C07 continuam sem a porta pública instalada de publicação/admissão/execução/resultados: seus wrappers retornam indisponibilidade e o host não os anuncia como ferramentas chamáveis. Discovery relata apenas bindings instalados; não relata execuções nativas ou cobertura integral de cada variante.

Quatro rotas humanas, acessíveis pelas três superfícies do Workbench, registram cobertura de baseline, regra de critério, seleção de portfólio e condição: `decision-coverage`, `decision-criteria`, `decision-select-portfolio` e `decision-condition`. Exigem POST da mesma origem, payload completo, ação humana específica e caso atual. Classificação de custo usa projeção real do Planner; prova de categoria não aplicável continua indisponível. A métrica `planner:known-subtotal-difference` permanece condicionada. Seleção e unidade não são deduzidas do texto do critério.

O link **Controles da decisão** nas áreas Dashboard, Planner e Procurement abre o consumidor próprio desses registros. Escolha um caso autorizado e o forecast que deseja classificar. Para cada categoria, selecione os componentes incluídos ou descreva a pendência; o subtotal permanece condicionado enquanto a cobertura não estiver completa. Para registrar um critério numérico, escolha dois cenários armazenados e um parâmetro, confira as unidades emitidas pelo Planner e informe o limite. Uma regra não transforma uma métrica condicionada em confirmada. O acompanhamento de condição exige uma escolha registrada, dois cenários distintos, uma fonte atual e um responsável do caso. Ele registra o vínculo; agendamento e execução Relay continuam sujeitos à integração C07. A página revalida acesso e fontes em cada leitura/gravação; versões divergentes exigem reabrir o caso.

Na rota financeira `sf_finance` / `sf-comparar-cenarios`, a criação de alternativa usa a escolha humana de portfólio capturada na admissão da análise e vinculada ao pedido e input completos. Selecione as duas alternativas no Workbench e indique qual deseja usar antes de iniciar a análise. Posição na lista e título não selecionam o cenário. Uma escolha posterior não autoriza um run antigo; alteração da seleção invalida a captura. Sem essa escolha, a comparação pode continuar, mas a criação de alternativa fica pendente. A rota de portfólio continua restrita a um candidato explicitamente vinculado.

A execução utiliza somente o cenário da alternativa escolhida, com operações humanas admitidas. Combinação de múltiplos candidatos de portfólio continua recusada. A captura do bridge acompanha run e saída atomicamente em C08. O writer privado confere o delta de preferences e a identidade do comando; o último guard síncrono verifica binding original, revogação, geração, expiração e Request antes do commit. O replay durante publicação usa um contexto privado do run; a UI comum não recebe essa autoridade. Após a limpeza do run, replay depende de seleção durável equivalente. PreparedChangeSet suporta substituição explícita de valor de requisição Procurement contida na escolha e nos alvos humanos permitidos; prepara e revalida o comando sem executá-lo. Promoção de portfólio, outras operações de alteração, histórico de memória/contestação e resultados C07 mantêm pendências explícitas.

O adapter próprio de preparação de análise e o encaixe da fila Procurement foram compostos com os deltas publicados da tranche recuperada. O renderer de AlternativeDraft, a aplicação C12 e as jornadas completas ainda exigem as verificações e correções indicadas no pacote de revisão; os contratos compartilhados consumidos permanecem sujeitos à revisão dos respectivos owners/S0.

Seleções humanas de BI, memória, contestação, sensibilidade e reavaliação são persistidas por request e digest exatos, com principal, projeto, política, revisão de acesso e versão do caso. Não existe escolha mais recente implícita. O prefixo privado só aceita o writer de preparação; leitores revalidam fontes e autoridade. A validade padrão é de uma hora, com até 4096 seleções e 1024 artefatos BI; expiração, capacidade ou mudança material retornam indisponibilidade/conflito. Nova preparação humana, com os mesmos fatos revalidados, pode renovar uma seleção expirada por CAS. Runs admitidos antes dessa renovação não podem usar a nova validade.

A cobertura base usa classificações humanas e componentes calculados pelo Planner para o horizonte exato do caso. Categorias pendentes continuam pendentes. Uma declaração humana de não aplicabilidade não substitui o produtor de prova dessa categoria. O registro de condições materiais e de observações de meses encerrados usa C08, CAS e fences das fontes. Review pode consumir observações comparáveis reabertas; preparar uma condição de watch não cria admissão ou agenda nativa.

Procurement compartilha a mesma instância de colaboração, observador C06, fila, preparação de dossiê e leitores de evidência/recibo C12. O CI do incremento W4 comprovou C06/dossiê e recusas de HTTP; a aplicação C12 permanece bloqueada pela incompatibilidade de callbacks WP04/WP11 e por timeouts observados. Montagem do handler não equivale a uma aplicação concluída.

C08 conserva doze namespaces, versões, migração, CAS, transações entre superfícies e proteção de escritas privadas. [runtime/local-store.ts](runtime/local-store.ts) fornece SQLite durável. Dados/BLOBs/auditoria/notificações relacionados confirmam juntos; callbacks transacionais não são repetidos cegamente.

A instalação fornece `authenticate`, `environment`, `persistence` e limites positivos. Corpo, query e header actor não criam identidade. Não presumir Microsoft, aplicação registrada, scanner, servidor macOS ou transporte corporativo a partir do repositório.

[local/README.md](local/README.md) descreve operação histórica e pré-requisitos. Homologações anteriores, `runtime/ACCEPTANCE.json`, atalhos ou LaunchAgents não são evidência WP10. Nenhum processo instalado, merge em dev ou deploy faz parte desta entrega.

## Validação e revisão

**Não executar testes de produto localmente nesta campanha.** [CI.md](docs/sf2h/control/handoff/astra/CI.md) define o workflow existente `test-ci.yml` com requests explícitos. Sucafina usa `modules/sucafina`; CLI usa `apps/cli`. Snapshot de teste deriva do produto e acrescenta somente `.ci-run.json`.

O guard da entrega evidencial confere ancestralidade e adições restritas aos recibos de WP10, sem alteração do candidato nem dos recibos anteriores. Ele executa guards reais sobre a entrega. Essa verificação não substitui os gates de produto ou o aceite global.

O check próprio hospedado executa `bun typecheck` nos packages pertinentes, geração Atlas, `check:generated`, diff dos gerados, typecheck da boundary, `check:spawn-imports` e `check:guards --base origin/dev`. Guards/allowlists não são relaxados. Cada resultado identifica produto, snapshot, tree, request, run, job e tentativa.

O mapa preserva 171 critérios, inclusive dependências de owner, nativo e global. As seis provas AM, oito seleções finais e epic ficam para a campanha global após todo o bundle. CI cirúrgico não substitui esses gates.

Três revisores independentes examinam candidato congelado e recibos. Triagem e autorrevisão não são parecer final. S0 revisará e integrará a PR contra `sf2-stack`; este WP não faz merge em dev nem deploy.

## Alterações da composição

- Inputs fixados por commit/blob; arquivos estrangeiros arquivados preservados.
- Operações residentes intersectadas com skills selecionadas; inventário MCP lido sem conectar provedores.
- Serviços de Dashboard/colaboração/revisão/BI ligados; reinicialização Atlas conserva os demais descriptors.
- Produtor e verificador de análise registrados juntos; bindings ausentes explicitamente indisponíveis.
- Seleções humanas duráveis para revalidação de análise; writer privado, CAS de caso e isolamento de principal.
- Contestação nativa exige author e reviewer em runs e sessões distintos, receipt da skill e reviewTarget exato; prova de execução nativa permanece pendente.
- Schema documental vinculado ao documento autorizado; ajustes de tipos/consumidores restritos aos paths próprios.
- Atlas protegido por source fence, recuperação durável, revogação, proteção de outbox e orçamento de ancestralidade.
- Guia, matriz e deltas rastreáveis sem atribuir aceite nativo/global à implementação.
