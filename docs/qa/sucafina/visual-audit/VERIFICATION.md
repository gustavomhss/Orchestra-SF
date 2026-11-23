# Verificação do refinamento visual — PR #710

## Resultado e escopo

Esta entrega aplica o refinamento visual ao shell Orchestra, às áreas Sucafina, aos componentes compartilhados e ao perfil Teams. O inventário de origem contém 70 áreas, 165 padrões de rota, 25 superfícies compartilhadas, cinco camadas Teams e 38 arquivos de diálogos. Essas categorias se sobrepõem e são um inventário de escopo; não significam que todas as combinações de rota, dados, permissão e estado foram renderizadas.

A auditoria original em [README.md](README.md), [coverage.json](coverage.json) e [findings.json](findings.json) continua preservada como registro anterior às correções. O estado atual deve ser lido neste documento e nos recibos vinculados abaixo.

## O que mudou

### Composição, materiais e hierarquia

O refinamento usa os materiais e as paletas nativas do Orchestra: superfícies de conteúdo, chrome e elementos flutuantes mantêm sua transparência, borda e profundidade próprias. Evita empilhar novos cartões com blur para organizar conteúdo que pode ser resolvido com alinhamento, tipografia e espaçamento. Os sete arquivos gerados de paleta foram comparados byte a byte com a saída do gerador canônico.

Cabeçalhos, títulos, ações, filtros, estados e rodapés passaram a usar uma hierarquia consistente. A leitura de corpo usa a escala nativa de 13 px e entrelinha 1,6; conteúdo secundário, títulos e indicadores mantêm papéis distintos. Formulários e revisões receberam agrupamento, insets e intervalos coerentes, com rótulos associados aos controles. Tabelas densas conservam a rolagem horizontal própria; a página não passa a depender de overflow horizontal global.

Revisões de alteração alinham valor original, fonte atual e proposta por campo. Somente diferenças reais recebem destaque. Ausências, valores desconhecidos, versões, identidades e referências de origem permanecem acessíveis. As confirmações de exclusão têm hierarquia e tratamento destrutivo explícitos.

### Áreas de negócio

Finanças, Pessoas, Portfólio, Operações, Planner e Procurement receberam cabeçalhos, filtros, tabelas, detalhes, formulários e revisões ajustados. Unidades, datas, meses e opções passaram a ser apresentadas de forma legível em inglês e português brasileiro, mantendo valores de API e seletores originais.

Foram corrigidos problemas concretos que a inspeção identificou: seletores legados sobrescrevendo o padding dos cabeçalhos de revisão; ações de editar/excluir escondidas por um seletor posicional em Projetos; referências de catálogo exibidas como único rótulo; e linhas de Versões desproporcionalmente altas no mobile. Em 320 px, as quatro ações de cada versão formam uma grade de duas colunas; o teste mede a altura de linha e conserva a rolagem nativa da tabela.

A revisão independente encontrou risco de nomes iguais esconderem mudanças de identidade. CAP20, CAP25, CAP21 e CAP19 agora mantêm nome e ID exato no valor comparável. A regressão de cotação troca A por B com fornecedor e total iguais e exige diferença explícita, CAS, um POST e leitura posterior. UI69 compara uma lista ordenada de chaves de mensagem tipadas; a tradução acontece apenas na renderização.

### Fluxos e telas compartilhadas

Work, Search, Saved Views, Decisões, revisões, Importação, Documentos, Memória, Rotinas e colaboração usam a mesma organização de título, contexto, ações e estado. Campos de negócio continuam visíveis; referências técnicas podem ser abertas em disclosures. O quadro Search recebeu bordas e raios completos depois da separação de consulta e resultados. A agenda passou a mostrar o estado de seleção de fonte necessário em vez de permanecer em carregamento após o reset de contexto.

Integrations agrupa as contas e os provedores disponíveis, mantém referências e ações nativas, e apresenta orientação e campos de autenticação com espaçamento consistente. A abertura da orientação e o fechamento do diálogo têm alvos de 44 px nas variantes verificadas. Providers tem diálogo de erro proporcional ao conteúdo e foco real em tentar novamente, permitindo Escape na transição para erro.

Skills em modo somente leitura são exibidas como documento, com a fonte exata disponível separadamente. Home, contexto e administração local foram reorganizados com rótulos legíveis, mantendo dados e referências.

A validação visual também revelou um defeito funcional na apresentação de revisões preservadas: o estado reativo acrescentava metadados internos ao objeto e a segunda leitura estrita passava a rejeitar uma projeção válida. A leitura agora usa o critério explícito `unwrap(content) !== content`: somente nesse caso copia o conteúdo normalizado antes da mesma decodificação estrita. Uma entrada plain segue diretamente para o decoder, sem perder propriedades não enumeráveis. A regressão exige que uma propriedade extra não enumerável no `Period` fechado de uma entrada plain seja rejeitada. Campos extras externos ao `Period` continuam sujeitos ao schema original, inclusive os que ele ignora; a projeção inteira não é declarada como um objeto fechado. Escopo, período, unidades, fontes e valores falsy mantêm as regras originais, e uma revisão somente de fonte continua não numérica.

Os estados vazios de escolhas receberam a mensagem de ausência correta, com remoção do texto duplicado no histórico. Rascunho, Pendente e Condicionada usam as traduções existentes ou declaradas, mantendo fallback literal para estados de origem desconhecidos. Em análises, os campos e o objetivo permanecem acessíveis quando falta catálogo; a ação de preparar continua desabilitada pelas mesmas pré-condições.

A última revisão de originais expôs dois problemas específicos adicionais. Em relatórios, um seletor genérico fazia checkboxes ocuparem a largura de um campo de texto e separava seus rótulos do fieldset; o formulário agora organiza seus campos em duas colunas no desktop e uma no mobile, mantém as opções em linhas próprias e usa o botão nativo. No gráfico financeiro, o SVG de 700 unidades encolhia os textos de 12 px para cerca de 4 px em 320 px. A escala legível foi preservada dentro de uma região focável com rolagem horizontal própria, separada dos botões de fonte. Os meses, valores, unidades e cálculos das barras continuam iguais; a jornada mede o tamanho renderizado do texto no viewport e percorre a rolagem até os valores à direita. Na comparação preservada, a tabela e sua coluna de rótulos têm um mínimo de largura que evita palavras fragmentadas em poucas letras no mobile, dentro da região rolável já existente.

### Perfil Teams

O entrypoint Teams ativa os atributos de tema usados pelos componentes nativos. Marca, paleta, superfícies, estados de acesso, administração, configuração e conversa acompanham dark/light. No mobile, composer e envio ficam visíveis na entrada padrão antes de foco ou rolagem; o histórico pode ser expandido e usa a rolagem externa normal. Os botões do composer têm alvos de 44 px nas variantes verificadas. O aviso de stream interrompido foi deduplicado, e a confirmação nativa de descarte de rascunho foi preservada.

As medidas finais em 390 e 320 px verificam o composer e o envio sem clipping de ancestral, sem overflow horizontal da página e sem usar foco programático como prova de visibilidade inicial.

## Como a validação foi feita

Todo build e teste de produto foi executado no GitHub Actions pelo workflow original `test-ci`, com o controle Omni exigido pelo repositório. Não houve execução local do produto, clone local, substituição do workflow ou criação de status de CI. Os snapshots de teste contêm apenas a requisição e, quando necessário, instrumentação de captura; esses arquivos temporários não fazem parte do produto integrado.

Cada execução registra a revisão de produto e a revisão do snapshot. A suíte ampla da aplicação passou em uma revisão integrada anterior; alterações posteriores receberam testes focados nas superfícies afetadas e nova verificação de tipos, regras e paleta. Não se atribui retroativamente a execução ampla ao último commit.

As capturas foram extraídas dos artefatos originais e deduplicadas por SHA-256. Os recibos distinguem triagem por folhas de contato, abertura em tamanho original, aliases de imagem, capturas automáticas de encerramento e imagens de falha. Repetições do mesmo screenshot em diretórios diferentes não viram novas telas aprovadas.

## Execuções e comprovantes

A tabela resume os gates selecionados para fechamento. Os SHAs de produto e de snapshot estão em [verification-runs.json](verification-runs.json); cada run também preserva os logs originais. As quantidades de testes não devem ser somadas entre linhas, pois há regressões que reaparecem nos gates focados. As capturas de um run intermediário continuam históricas quando um estado foi alterado e reexecutado depois.

| Frente | Resultado observado | Fonte |
|---|---|---|
| Gate7 — tipos, regras, paleta e regressões focadas | 7 verificações; 13 + 100 testes; zero falhas, zero gates e 12 avisos consultivos (WARN) | [Run 45101173066](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45101173066) |
| Suíte ampla da aplicação | 2.433 testes unitários + 686 de browser; zero falhas | [Run 45086591000](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45086591000) |
| Áreas de negócio nativas | 18 jornadas selecionadas em fontes registradas; 20 regressões focadas. As duas jornadas Finance têm reexecução final própria | [Core6](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45092054425), [Operações](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45090642771), [Planejamento](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45090646525), [regressões](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45092056833); recorte completo em [business.json](verification/business.json) |
| Financeiro final | 2/2 jornadas nativas; prazo original de 15 s, resposta, CAS e leitura posterior preservados | [Run 45101169602](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45101169602); [finance-final-runtime.json](verification/finance-final-runtime.json) |
| Work, Search e Saved Views | 3 jornadas dentro do run de 4 casos; 22 capturas originais | [Run 45090124098](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45090124098) |
| Decisões | 1/1 jornada original; 22 originais EN/PT/mobile revisados | [Run 45095084001](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45095084001) |
| Importação e Documentos | 2/2; ClamD real, escrita/leitura, logout, revogação e recuperação | [Run 45090119567](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45090119567) |
| Teams | 12/12; desktop, 390 e 320 px | [Run 45085918666](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45085918666) |
| Providers | 7/7; autenticação, foco e Escape | [Run 45085462036](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45085462036) |
| Shell / automação / componentes compartilhados / Escape | 27 / 91 / 21 / 23 casos aprovados | [Shell](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45081603035), [automação](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45081600619), [compartilhados](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45088732308), [Escape](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45088359630) |
| Núcleo e inicialização de processos | 61 aprovados; 3 skips condicionais preexistentes; zero falhas | [Run 45093895615](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45093895615) |
| Desempenho do renderer | 6/6; 90 transições sem estado incorreto ou revisão ausente | [Run 45083785208](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45083785208) |
| Matriz final de fluxos — Matrix8 | 5/5 jornadas originais; zero falhas, skips, retries ou flaky; cancelamento UI69 e comparação UI49 qualificados nos limites registrados | [Run 45101586772](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45101586772); [matrix-final.json](verification/matrix-final.json) |

O Gate7 usa as três configurações de tipos mantidas no repositório — aplicação, Core e E2E. A verificação das regras parte da base `dev` explicitamente fixada; os avisos consultivos são preservados no JSON. A paleta é regenerada pelo script original e seus sete arquivos devem permanecer byte a byte iguais. Os controles de processo registram as chamadas Omni e zero delegações no gate.

## Recibos de revisão

Os recibos abaixo identificam nomes de capturas, hashes e o nível de inspeção. Uma folha de contato permite triagem; a aprovação de um recorte em tamanho original é registrada separadamente. Capturas de erro e encerramento automático não contam como novas telas aprovadas.

| Recibo | Conteúdo e limite |
|---|---|
| [business.json](verification/business.json) | Finanças, Pessoas, Portfólio, Operações, Planner e Procurement; fontes e identidades exatas. |
| [shared-foundation.json](verification/shared-foundation.json) | Shell, diálogos e base visual compartilhada; histórico das verificações. |
| [teams.json](verification/teams.json) | Tema e superfícies Teams, medidas de composer/mobile e limites de fixture. |
| [agents-escape.json](verification/agents-escape.json) | Evento Escape com tooltip e diálogo, restauração de foco e ausência de escrita. |
| [identity-review.json](verification/identity-review.json) | Revisão independente da comparação de IDs, ausência e valores tipados. |
| [work-search-views.json](verification/work-search-views.json) | Work, Search e Saved Views; 22 capturas originais e contratos de leitura/gravação. |
| [files-imports.json](verification/files-imports.json) | Importação UI55–57, originais dark/light e narrow. |
| [files-documents.json](verification/files-documents.json) | Documentos UI58–60, scanner, confirmação, revogação e recuperação. |
| [shared-components.json](verification/shared-components.json) | Integrations, Inbox, Board, Search, Recovery e superfícies compartilhadas. |
| [rag.json](verification/rag.json) | Controles RAG superiores e inferiores, com classificação de fixture visual. |
| [core-workspace-alignment.json](verification/core-workspace-alignment.json) | Proveniência do Core canônico e validação física do workspace privado. |
| [ui69-producer-review.json](verification/ui69-producer-review.json) | Parecer histórico de fonte UI69; o seletor de cancelamento foi contradito pelo runtime Matrix6 e corrigido depois. |
| [root-review.json](verification/root-review.json) | Inspeções diretas do integrador com hashes dos pixels observados. |
| [workflow-admission.json](verification/workflow-admission.json) | Revisão dos estados recusados pelo produtor original. |
| [ui41-restored-controls.json](verification/ui41-restored-controls.json) | Contrato original de UI41 restaurado e observado no run Decisions5. |
| [decisions-historical-review.json](verification/decisions-historical-review.json) | Revisão histórica de Decisões anterior aos últimos rótulos/estados. |
| [matrix4-historical.json](verification/matrix4-historical.json) | Falhas intermediárias da Matrix4, causas identificadas e limites observados. |
| [final-code-gate.json](verification/final-code-gate.json) | Tipos da aplicação/Core/E2E, 78 regras, paleta e 113 regressões na fonte 10a7aaa; 12 avisos consultivos. |
| [final-source-review.json](verification/final-source-review.json) | Revisão independente da fonte 78c48fd e das fronteiras de origem/autoridade; deltas posteriores têm recibos próprios. |
| [preserved-model-regression.json](verification/preserved-model-regression.json) | Registro histórico das três regressões do Gate5; os quatro casos atuais aparecem no Gate7. |
| [decisions-final.json](verification/decisions-final.json) | Decisões finais: 22 originais EN/PT, estados vazios e controles de análise restaurados. |
| [matrix5-historical.json](verification/matrix5-historical.json) | Matrix5 histórica, com falhas de QA e achados visuais preservados. |
| [matrix5-root-analytics.json](verification/matrix5-root-analytics.json) | Inspeção direta UI45/46, defeito de legibilidade e limite do foco de captura anterior. |
| [matrix5-context-exports.json](verification/matrix5-context-exports.json) | Contexto local e exportação indisponível, capturados antes da falha UI69. |
| [matrix5-proposal-similar-cases.json](verification/matrix5-proposal-similar-cases.json) | Proposta e casos semelhantes: seis originais e referências exatas. |
| [ui50-ui69-source-review.json](verification/ui50-ui69-source-review.json) | Revisão independente dos observers de leitura e do nome acessível do seletor. |
| [chart-legibility-source-review.json](verification/chart-legibility-source-review.json) | Correção de escala do gráfico e revisão independente da preservação dos dados. |
| [preserved-plain-admission.json](verification/preserved-plain-admission.json) | Decoder condicional, regressão de chaves não enumeráveis de Period e preservação de entrada plain |
| [finance-response-deadline.json](verification/finance-response-deadline.json) | Prazo original de 15 s para observar gravação financeira; expectativas e readback preservados |
| [matrix6-bi-legibility.json](verification/matrix6-bi-legibility.json) | Quatro originais BI Matrix6 com fonte legível e wheel até extremo direito; execução global 4/1 |
| [matrix6-ui69-visual.json](verification/matrix6-ui69-visual.json) | UI69 Matrix6: 11 originais / 12 checkpoints; cancelamento ainda não qualificado |
| [matrix6-workflow-visual.json](verification/matrix6-workflow-visual.json) | Histórico Matrix6 4/1: UI50 aprovado; UI49 mobile rejeitado naquela rodada; correção de largura qualificada depois na Matrix8. |
| [matrix6-root-review.json](verification/matrix6-root-review.json) | Três originais adicionais abertos pelo integrador: gráfico mobile nos dois extremos e formulário de relatório. |
| [finance-final-runtime.json](verification/finance-final-runtime.json) | Financeiro com prazo original restaurado: dois casos nativos, gravação e leitura posterior. |
| [matrix-final.json](verification/matrix-final.json) | Matriz final: cinco jornadas nativas, comparação mobile legível e cancelamento UI69. |
| [matrix7-ui69-contract.json](verification/matrix7-ui69-contract.json) | UI69: cancelamento, retorno ao formulário e zero POSTs para `configure-summaries` na origem e no mount da instalação, antes do CSS final de UI49. |
| [matrix-final-root.json](verification/matrix-final-root.json) | Inspeção final do integrador na fonte 6fb74f4, com o original de320px, seu hash e limites explícitos da comparação móvel. |

## Composição e revisão do PR

A fonte final de produto registrada nesta entrega é `6fb74f4cf7db0aaa172acf4a5a383cdb3e67af44`, utilizada pela Matrix8 no snapshot `44c1a977d31322b41a3d80bb0239205748d7fde9`. A base explícita de comparação e guardrails é `a5eee3584da531d087a419b8f3ef29d3881117c7`. Os resultados mantêm essa proveniência; o Gate7 é o run `45101173066`, executado sobre a fonte `10a7aaa` antes do último CSS de UI49.

O [PR #710](https://github.com/gustavomhss/Orchestra-SF/pull/710) registrará o gate final do head que incorporar este documento e seus recibos, com o SHA e o resultado daquela execução. Esse gate documental permanece uma etapa futura neste registro; os resultados já concluídos conservam suas fontes próprias.

A base inicial era `346af44f4aac7bf1eb9821d4c5482bacf233a706`. Durante a entrega, a `dev` avançou para `a5eee3584da531d087a419b8f3ef29d3881117c7` com 13 paths de infraestrutura e documentação, sem interseção com as mudanças de UI. Essa base foi incorporada preservando seus blobs; a verificação final usa esse SHA explícito como base de guardrails.

A revisão de integração do PR identificou dois pontos tratados nesta entrega: o contrato original do catálogo vazio de UI41, e a extração única de filesystem no Core. UI41 conserva os campos montados e a preparação desabilitada quando faltam opções/modelo/operação admitidos. Os quatro blobs Core agora são idênticos à fonte Design `6e1795cf559a9918ab4ecab5f77eadbb7f8c635e`, usando somente `app-node-filesystem`. Não existe uma segunda extração `app-node-system`. O helper E2E também revalida o workspace físico privado com `prepareSfLocalWorkspace` antes de publicar os metadados de descoberta.

A revisão final também identificou duas regras originais que precisavam ser preservadas: o prazo de 15 segundos para observar a gravação financeira e a inspeção de propriedades não enumeráveis pelo decoder de revisões. O prazo foi restaurado com limpeza do timer e da observação, sem retirar as assertivas de resposta, payload, CAS ou leitura posterior. O modelo de revisão passou a ser idêntico ao blob `c217a35f6014a9e78c25fde371507decf92626eb` da fonte Design `9ea7345587465822daabfecb635d48d96f643b19`, com regressões para a entrada plain e o proxy real.

As mudanças funcionais e campanhas de instalação dos PRs #613, #673 e #713 não foram absorvidas integralmente nem declaradas qualificadas por esta revisão de UI. Seus contratos e hunks precisam ser preservados na composição posterior do candidato de release, incluindo os atributos de admissão Wave Five e as regras `[hidden]` das novas superfícies que o revisor identificou como divergência entre branches. O merge de acabamento não constitui aceite dos gates de go-live ou autorização de virada de produção.

Referências: [coordenação de sobreposição](https://github.com/gustavomhss/Orchestra-SF/pull/710#issuecomment-7088132472), [finding UI41](https://github.com/gustavomhss/Orchestra-SF/pull/710#pullrequestreview-6015334664), [prazo da resposta financeira](https://github.com/gustavomhss/Orchestra-SF/pull/710#pullrequestreview-6015569694), [decoder da entrada plain](https://github.com/gustavomhss/Orchestra-SF/pull/710#pullrequestreview-6015787146) e [revisão final 6016022844](https://github.com/gustavomhss/Orchestra-SF/pull/710#pullrequestreview-6016022844).

## Limites da evidência

- Teams, RAG e parte das superfícies compartilhadas usam a aplicação original compilada com fixtures HTTP fiéis ao contrato. Isso qualifica apresentação e comportamento do componente; não comprova login num tenant Microsoft, autorização real de provedor, execução de modelo, embeddings ou geração ao vivo.
- As jornadas Sucafina nativas usam instalações isoladas e os produtores originais. Os testes não concedem permissões artificialmente. Quando o catálogo F01 original recusa uma rota, o recibo identifica a recusa e registra `leafRendered: false`; essa captura não é aprovação visual do conteúdo que não foi admitido.
- O fluxo de análise sem catálogo completo conserva os controles originais montados, a mensagem de ausência e a preparação desabilitada. A revisão do PR apontou que esconder o formulário divergia do oráculo original; a correção restaura o produto e suas assertivas. Não foi criado modelo, credencial ou destino para simular sucesso.
- Importação e Documentos qualificam upload, scanner real, confirmação, leitura posterior, revogação e recuperação nas condições registradas. O documento usado é texto UTF-8; PDF/DOCX/OCR e aplicação de cenário Planner não são inferidos. Os recibos listam os recortes mobile que não mostram todos os controles inferiores.
- As capturas não representam uma auditoria WCAG completa nem a execução de todas as combinações das 165 rotas. Contraste amostral, glass, hierarquia e foco receberam as verificações descritas nos recibos.
- Em UI69, o leitor original de resumos oferece sua configuração autorizada, enquanto a projeção de perfil/jobs/backups responde explicitamente `503 local-operator-reader-not-bound`. A revisão de resumos, seu cancelamento e o retorno ao formulário foram qualificados. A assertiva de ausência de escrita cobre especificamente requisições POST para `installation.mount + "/api/ui/local-admin/configure-summaries"` na `installation.origin` observada; não é uma contagem de todos os POSTs da aplicação. A leitura de perfil ou backups continua indisponível naquele produtor.
- A integração privada F04 dependente de um host G08 e seu manifesto real não foi fabricada para tornar uma execução verde.
- A comparação de desempenho usa execuções hospedadas distintas. Foram observadas 90 transições sem estado incorreto, revisão ausente ou substituída; medianas menores são uma observação, não uma atribuição causal de ganho de velocidade. Os dados estão em [performance-comparison.json](performance-comparison.json).

## Histórico e integridade

Falhas intermediárias permanecem registradas nos runs originais. Os recibos apontam a correção e a execução posterior que a qualifica. Expectativas antigas de texto/roles, uma falha na observação de resposta HTTP pelo CDP e uma configuração de captura no local errado foram corrigidas sem relaxar status HTTP, schemas, contagem de comandos, revisões de origem, CAS ou readback. Estados realmente indisponíveis são testados como indisponíveis, com pré-condição observada.

A Matrix5 registrou 3 casos aprovados e 2 falhas. O nome acessível de Office format já estava correto no AX; o teste passou a selecionar o combobox por esse nome exato. Na administração local, a observação agora acompanha os cliques originais de leitura depois que o contexto e o formulário assentam, mantendo as respostas 503/200, schemas e todas as assertivas. Os prints daquela rodada também revelaram os defeitos de layout do formulário de relatório e de escala do SVG; ambos receberam correção de produto e nova qualificação, sem reclassificar os resultados anteriores.

A Matrix6 registrou 4 casos aprovados e um timeout: o teste aguardava o nome exato `Cancel`, embora o controle original fosse `Cancel review`. O seletor foi corrigido pelo nome observado e seu clique recebeu limite de 15 segundos; as assertivas de fechamento, retorno ao formulário, zero POSTs para `configure-summaries` na origem e no mount da instalação e zero erros de página permanecem ativas. Os originais dessa rodada qualificam a escala do gráfico e o formulário de relatórios, mas a comparação inferior em 320 px ainda comprimia os rótulos. Esse recorte foi rejeitado e sua largura recebeu a correção registrada; o resultado anterior continua sendo 4/1.

A Matrix8 posterior, run `45101586772`, terminou com 5/5 jornadas aprovadas, zero skips, retries ou flaky. O cancelamento UI69 alcançou o retorno ao formulário e a assertiva delimitada de zero POST para `configure-summaries`. Três originais da comparação inferior UI49 foram abertos individualmente: dark em 320 px e dark/light em 1440 px. A fragmentação dos rótulos foi corrigida; a captura móvel está no início da rolagem horizontal e não comprova a coluna Current nem as referências no extremo direito. Os valores e a proveniência das primeiras linhas permanecem legíveis nos originais desktop.

O antigo fixme de Escape em Agents dependia de um tooltip WIP ausente em produção. A regressão ativa usa o tooltip real da navegação compacta, observa tooltip e diálogo no evento Escape, exige restauração de foco e ausência de escrita. Os skips dos runs históricos não foram reclassificados como passes.

Os avisos de guardrail são registrados, sem supressões ou labels de aprovação. A regra de timeout é consultiva; a qualificação final precisa continuar com zero achado de bloqueio e zero erro de configuração. Os budgets de jornada incluem inicialização, instalação e vários estados reais; não foram aumentados para contornar as falhas observadas. O limite original de 15 segundos da observação de resposta financeira foi restaurado. Esse prazo limita a espera do teste; não declara cancelamento de um fetch que já esteja em curso.

Os paths locais nos recibos identificam o local de inspeção. As referências duráveis são os commits, URLs de execução, IDs de artefato e hashes registrados. O merge não inclui capturas binárias, credenciais de teste, `.ci-run.json`, wrappers temporários de verificação ou alterações em regras de autorização.

