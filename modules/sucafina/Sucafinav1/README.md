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

Este é o roteiro de homologação a executar após resolver os deltas de consumidores. A UI publicada pelo WP01 ainda admite a ação humana errada na preparação de análises; alguns bindings de decisão, portfólio e rotina também faltam. Botões ou descriptors não comprovam esse percurso completo.

### Revisões, relatórios e BI

Uma revisão preservada mantém o conteúdo selecionado. Mudanças posteriores pertencem à revisão seguinte e à comparação explícita. Relatórios devem conservar a cobertura selecionada e limitações, sem ampliar dados permitidos à pessoa.

O host compõe as portas publicadas de revisão, comentários e BI no mesmo store. Registra Dashboard BI01/BI07/BI08 e Procurement BI05/BI06. A preparação da skill contextual usa artefatos persistidos e seleção humana explícita para BI01/BI07/BI08; aceita o período exato, sem atribuir outros filtros a esses produtores. Demais rotas pendentes constam nos deltas. `sf_bi_view` não demonstra os onze views nem execução da skill. Teste de registro não substitui observação de gráfico, download ou uso por uma pessoa.

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

O host limita custo de ancestralidade antes de IO e não reutiliza autorização entre releituras. Grafo acima do orçamento técnico retorna indisponibilidade. Política/project, histórico com diferenças de domínio e variantes C17 ainda pendentes não são cobertos por uma prova de caso com fonte inalterada.

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

A composição de análise registra até 15 dos 18 pares de produtor/verificador, condicionada aos serviços documentais. Inclui enquadramento sem import, BI contextual, memória atual, dossiê de compra e contestação atual. Sensibilidade, portfólio e reavaliação dependem dos produtores de proof, critérios e materialidade ainda em composição. Discovery relata bindings disponíveis; não relata execuções nativas. PreparedChangeSet, histórico de memória/contestação e resultados C07 mantêm suas recusas explícitas quando falta a porta real.

Seleções humanas de BI, memória e contestação são persistidas por request e digest exatos, com principal, projeto, política, revisão de acesso e versão do caso. Não existe escolha mais recente implícita. O prefixo privado só aceita o writer de preparação; leitores revalidam fontes e autoridade. A validade padrão é de uma hora, com até 4096 seleções e 1024 artefatos BI; expiração, capacidade ou mudança material retornam indisponibilidade/conflito. A renovação de uma seleção expirada ainda requer implementação própria.

Procurement compartilha a mesma instância de colaboração, observador C06, fila, preparação de dossiê e leitores de evidência/recibo C12. O CI do incremento W4 comprovou C06/dossiê e recusas de HTTP; a aplicação C12 permanece bloqueada pela incompatibilidade de callbacks WP04/WP11 e por timeouts observados. Montagem do handler não equivale a uma aplicação concluída.

C08 conserva doze namespaces, versões, migração, CAS, transações entre superfícies e proteção de escritas privadas. [runtime/local-store.ts](runtime/local-store.ts) fornece SQLite durável. Dados/BLOBs/auditoria/notificações relacionados confirmam juntos; callbacks transacionais não são repetidos cegamente.

A instalação fornece `authenticate`, `environment`, `persistence` e limites positivos. Corpo, query e header actor não criam identidade. Não presumir Microsoft, aplicação registrada, scanner, servidor macOS ou transporte corporativo a partir do repositório.

[local/README.md](local/README.md) descreve operação histórica e pré-requisitos. Homologações anteriores, `runtime/ACCEPTANCE.json`, atalhos ou LaunchAgents não são evidência WP10. Nenhum processo instalado, merge em dev ou deploy faz parte desta entrega.

## Validação e revisão

**Não executar testes de produto localmente nesta campanha.** [CI.md](docs/sf2h/control/handoff/astra/CI.md) define o workflow existente `test-ci.yml` com requests explícitos. Sucafina usa `modules/sucafina`; CLI usa `apps/cli`. Snapshot de teste deriva do produto e acrescenta somente `.ci-run.json`.

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
