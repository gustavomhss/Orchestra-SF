# Guia do Workbench da Sucafina

O Workbench reúne trabalho atribuído, documentos e decisões relacionados ao Dashboard, ao Planner e a Procurement. Use-o para consultar contexto, comparar alternativas e registrar uma escolha. Os valores financeiros, pedidos e demais registros oficiais continuam nas páginas do módulo correspondente.

Abra **Workbench** na barra do Dashboard, Planner ou Procurement. As informações e ações disponíveis dependem do seu acesso. Você também pode continuar diretamente no módulo; criar um caso não é necessário para uma atualização operacional simples.

## Encontrar trabalho e documentos

Use **Find a record** para procurar um registro pelo nome ou por um valor visível. Escolha Dashboard, Budget Planner ou Procurement e selecione **Find records**. A busca consulta as páginas disponíveis para o seu acesso; cada resultado abre o registro na página de origem. Ano e plano efetivamente usados na busca acompanham o link. Ao voltar, a consulta é executada novamente para conferir o acesso e os registros atuais. Resultados são limitados a 100; refine o termo quando necessário.

Se alguma página estiver temporariamente indisponível, a busca informa que a lista está incompleta. Uma mudança de acesso limpa os resultados. A consulta continua preenchida para você tentar novamente. A busca encontra registros que as páginas apresentam com uma identidade ou um link de detalhe; não procura conteúdo oculto de documentos ou campos que a aplicação não apresenta.

Quando **My work** estiver disponível na instalação, informe as datas de início e fim e selecione **Find work**. A lista mostra os itens atribuídos que podem ser consultados nesse período. Quando houver um destino disponível, selecione **Open work** para abri-lo; o acesso é conferido novamente. Se a lista estiver vazia, confira o período. Se a instalação ainda não oferecer essa lista, a tela informa a indisponibilidade e mantém as páginas operacionais como caminho de entrada. Erros de seleção preservam o período para correção e nova tentativa.

Quando o serviço fornecer contexto autorizado de uma reunião preservada, o item mostra a referência e a versão da reunião, além da seção ou referência de encaminhamento correspondente. Esses metadados são informativos; não abrem a reunião nem iniciam uma conversa. Se o contexto não puder ser apresentado, o item informa **Review context is unavailable**.

Em **Search documents**, procure documentos que você tem autorização para consultar. Abra o resultado para verificar a origem. Um resultado pode deixar de estar disponível se o acesso ou a fonte mudar.

O recurso **Extract document evidence** permite extrair candidatos de documentos autorizados:

1. Selecione **Find documents**, escolha um documento e selecione **Open document**.
2. Informe o nome e o tipo do campo; a unidade é opcional. Selecione **Create extraction schema**.
3. Escolha o esquema e selecione **Extract candidates**.
4. Confira cada valor e sua localização no documento. Abra a fonte antes de selecionar **Confirm this candidate**.

A extração cria candidatos para revisão; não confirma os valores por conta própria. São aceitos texto UTF-8, DOCX e PDF com camada de texto. Os limites são 20 MiB, 500 páginas de PDF, um milhão de caracteres extraídos, 8 MiB de XML DOCX expandido e 2.000 entradas DOCX; o processamento expira após 15 segundos. Limites de upload da instalação podem ser menores. PDFs digitalizados sem texto não passam por OCR.

## Usar e salvar uma visualização

Na seção **Saved views**, escolha a densidade confortável ou compacta. Para guardar a página e os filtros atuais, informe um nome e selecione **Save this page and filters**. **Use this page as my starting page** define a página inicial dessa área. Você pode abrir uma visualização salva ou removê-la da lista.

Uma visualização só restaura filtros e períodos compatíveis com a página e com o acesso atual. Se a tela informar que o contexto não pode ser restaurado, revise o período e os filtros na página atual e salve uma nova visualização.

Se um registro, plano ou filtro salvo deixar de estar disponível, a lista mostra **Unavailable saved view** ou **Unavailable starting page**, sem repetir os detalhes anteriores. A página inicial indisponível não abre automaticamente. Você pode usar **Remove unavailable view**, ou escolher período, versão e filtros válidos na página atual e selecionar **Replace with this page**. Essa substituição exige uma ação sua e altera apenas a visualização pessoal.

Se a confirmação de salvar, remover ou definir a página inicial não chegar, mantenha a página aberta e use a opção de repetir a mesma solicitação. Nome, densidade e filtros ficam preservados enquanto o resultado é incerto. Abrir outra visualização com uma edição pendente exige confirmar o descarte.

## Registrar e comparar uma decisão

Use **Create a decision** quando precisar manter objetivo, critérios, alternativas e histórico juntos. Informe o objetivo, as datas, a moeda e um critério por linha; depois selecione **Create decision**. A tela abre o caso criado. Você pode editar objetivo, período, moeda e critérios em **Edit decision**.

Se o salvamento de uma edição ficar sem confirmação, os campos ficam preservados e bloqueados. Use **Retry same save** para consultar o resultado da mesma solicitação. Um conflito confirmado antes de salvar mostra os valores atuais e sua tentativa; uma resposta perdida seguida de conflito mantém a tentativa inconclusiva até você conferir o caso salvo.

Depois de um conflito confirmado, compare as entradas e selecione **Use current version and keep my edits**. Essa ação relê a decisão e adota a versão atual sem gravar. Os textos dos critérios acompanham seus IDs mesmo quando a ordem muda. Se outra pessoa adicionar ou remover critérios, marque **I reviewed the added and removed criteria** depois de conferir as diferenças; o texto dos critérios removidos permanece na comparação. Confira o formulário e selecione **Save decision** para gravar. Se a decisão mudar novamente, a tela pede uma nova revisão. **Reload current values for comparison** repete somente a leitura quando ela estiver indisponível.

Em **Dashboard → Vendor Contracts**, a ação **Create decision** de cada contrato abre uma decisão contextual. O contrato e o ano efetivo acompanham a criação; informe a moeda explicitamente. A fonte é conferida novamente ao salvar. No caso criado, **Return to contract** retoma a página, os filtros e o registro de origem. Se o contrato mudar ou seu acesso for revogado, a criação não utiliza silenciosamente a referência anterior.

Quando a confirmação de criação não chegar, os campos permanecem preenchidos e bloqueados para repetir a mesma tentativa. Isso evita transformar uma resposta perdida em uma segunda decisão com conteúdo diferente.

Quando a conversa de uma pergunta estiver disponível, use **Open conversation** para consultar suas mensagens. Se a leitura não terminar em dez segundos, a tela libera a nova tentativa e conserva a resposta ainda não enviada. Depois de um envio sem confirmação, use novamente **Send reply**: o texto fica bloqueado e a mesma solicitação é repetida. Se a primeira tentativa for recusada porque a conversa mudou, **Review changed conversation** relê as mensagens e conserva seu texto; confira-o antes de enviar novamente. Uma resposta perdida seguida de conflito continua inconclusiva, preservando a mesma tentativa.

A confirmação usa somente a resposta autorizada mais recente. Quando ela ainda não estiver disponível para o caso, a ação fica desabilitada com uma explicação; você pode continuar enviando respostas. Uma resposta já registrada na decisão aparece como registrada. Quando a confirmação ou a inclusão no caso estiver disponível e seu resultado ficar incerto, a tela conserva a solicitação original. Se o acesso mudar, a conversa e o rascunho saem da tela; reabra a decisão com seu acesso atual.

Quando houver um serviço de análise disponível, **Frame this decision → Prepare decision framing** usa o objetivo atual e as fontes anexadas para preparar uma contribuição. A preparação relê o caso e verifica sua versão; ela não cria fontes nem registra uma escolha. A contribuição aparece no histórico para revisão.

O detalhe mostra o estado e a versão do caso, seus critérios, alternativas e resultados disponíveis. Em cada alternativa, leia o estado da comparação e as condições. **Known subtotal** e **Known difference** mostram somente o que pode ser calculado com as informações atuais; não equivalem a um total ou diferença completos. Uma categoria pendente ou ausente não é zero. Abra **Coverage and sources** para consultar a cobertura e as fontes.

Em **Ask a question**, escolha um registro do caso, encontre e selecione o destinatário e escreva sua pergunta. A conversa é criada e depois vinculada à decisão. Se o vínculo não puder ser confirmado, mantenha a tela aberta e tente novamente a mesma solicitação. Em **Question conversations**, selecione **Open conversation** para consultar as mensagens autorizadas.

Com pelo menos duas alternativas, use **Compare and choose**. Para pedir uma análise especializada das alternativas salvas, use **Analyze alternatives**, escolha duas alternativas diferentes e selecione **Start specialist analysis**; acompanhe o resultado no histórico de análises. A análise não registra a escolha nem aplica uma mudança. Para comparar e escolher:

1. Selecione uma linha de base e uma alternativa diferente.
2. Mantenha os critérios necessários e selecione **Compare**.
3. Confira o estado da comparação, a diferença completa ou conhecida, as condições não resolvidas e o resultado de cada critério.
4. Selecione **Explore sensitivity** para escolher um critério, carregar suas unidades e avaliar um intervalo, quando essa opção estiver disponível.
5. Para registrar sua decisão, escreva o motivo em **Reason for choosing** e selecione **Record choice**.

Comparar não registra uma escolha. Registrar a escolha guarda seu motivo no caso, mas não altera por si só o Planner nem aprova um pedido. Quando houver uma mudança preparada, use **Review current changes** para conferir destino, versão e valores anteriores e propostos. Somente depois marque a confirmação e selecione **Apply reviewed change**. Se a revisão estiver indisponível ou desatualizada, atualize o caso; consulte o recibo e o estado retornado para saber o que foi efetivamente aplicado.

Se a resposta de uma escolha ou aplicação não chegar, a comparação, o motivo e a solicitação permanecem bloqueados para repetição exata. Use **Retry the same choice** ou **Retry same application**, conforme a ação. Uma aplicação pode retornar conflito depois de o domínio observar um recibo; confira o recibo e o caso atual antes de iniciar outra mudança. A interface não interpreta esse conflito como prova de que nada foi gravado.

Em **Explore a portfolio**, você pode selecionar decisões e alternativas autorizadas, definir qual decisão guardará a avaliação, período, moeda e limite de combinações e selecionar **Preview portfolio**. Leia elegibilidade, estados de comparação, restrições e limitações antes de selecionar **Save this evaluation**. A avaliação salva fica no histórico do caso. Um resultado parcial ou condicionado continua assim no histórico.

## Explicar uma previsão

Na seção **Explain a forecast** de um caso, escolha duas fontes de previsão diferentes, o período e a moeda. Um modelo disponível já vem selecionado; para alterá-lo, abra **Analysis settings**. Selecione **Start analysis** para pedir uma explicação. A tela mostra o andamento e o histórico. Enquanto estiver em preparação, na fila ou em execução, você pode selecionar **Cancel analysis**.

Quando houver um resultado, abra suas fontes e detalhes para entender a contribuição. A contribuição é uma proposta para revisão; **Accept contribution** registra sua aceitação no caso com o motivo informado, não aplica valores no Planner. Se a análise ficar indisponível, desatualizada ou perder acesso à fonte, confira as fontes e o estado atual antes de tentar novamente.

Essa opção depende de duas fontes de Planner anexadas ao caso e de um modelo disponível. Se o formulário não aparecer, continue usando a comparação normal no Planner ou confira as fontes do caso e o acesso disponível.

Enquanto o início de uma análise estiver sem confirmação, as seleções e o modelo ficam preservados para repetir a mesma tentativa. Falhas transitórias na atualização do histórico conservam o resultado aberto e a justificativa digitada. Um resultado desatualizado deixa de poder ser aceito; uma revogação de acesso remove o conteúdo anterior.

### Pedir uma revisão independente

Abra no histórico uma comparação concluída. Quando o resultado, o acesso e um modelo de revisão estiverem disponíveis, selecione **Request independent review**. A revisão usa a comparação salva e o caso atual; acompanhe sua execução própria no histórico. Ela não registra uma escolha nem aplica mudanças nos registros oficiais.

Se o início ficar sem confirmação, use **Retry the same review request**. A tentativa conserva o resultado original que seria revisado. Se esse resultado mudar, confira o histórico antes de pedir outra revisão. Quando a ação estiver indisponível, a tela informa os requisitos; reabra a contribuição atual depois de conferir acesso e disponibilidade do serviço.

## Colar e salvar valores mensais no Planner

No Dashboard, abra o diálogo da linha OPEX ou CAPEX para editar seus campos mensais. Em **Annual Entry** ou **Year amount**, confira o alcance apresentado antes de confirmar a aplicação. Ao abrir um projeto de uma lista filtrada, os filtros de busca, estado e responsável são mantidos no retorno. A navegação a partir do Executivo também preserva o ano e o mês de Operations.

Nas páginas **OPEX** e **CAPEX**, a seção **Edit monthly values together** permite colar um intervalo de valores:

1. Abra a grade de **Budget**, **Actual** ou **Forecast** desejada e selecione a mesma medida em **Measure**. Só as células oferecidas pela página autorizada podem ser editadas em lote.
2. Cole os valores nas células editáveis. A grade usa 12 meses; o intervalo precisa caber nas linhas e células disponíveis.
3. Selecione **Preview changes** e leia os erros ou alterações apresentados.
4. Quando a prévia estiver correta, selecione **Save changes**.

O sistema pode aceitar algumas linhas e sinalizar outras separadamente. Em caso de conflito, a tela mostra o valor atual e a sua tentativa; suas entradas são preservadas. Compare os valores, atualize a página se necessário e faça uma nova prévia antes de salvar.

Se a gravação perder a resposta ou exceder o tempo de espera, a grade fica bloqueada e o botão repete exatamente a tentativa original. Um conflito nessa repetição não confirma que a primeira gravação falhou. Nesse caso, confira o registro persistido antes de iniciar outra alteração; o estado continua inconclusivo até essa reconciliação.

O editor em lote oferece alterações mensais. Para operações anuais, distribuição e reset, use as ações disponíveis no registro da página original. O serviço em lote atual não publica essas operações; por isso elas não são oferecidas como ações do editor mensal.

## Importar com prévia

Em **Dashboard** e **Planner**, abra **Import with preview**. Selecione **Find destinations**, informe as duas datas do período quando precisar filtrar os destinos e escolha um destino. Selecione um arquivo XLSX, XLS ou JSON e, se for apropriado, marque **Create a new version** ou **Remove records missing from the file**.

Selecione **Preview import** e confira as alterações, origens e erros de linha. A prévia não aplica mudanças. Só selecione **Apply reviewed import** depois de revisar o destino e as alterações. O resultado informa se a importação foi aplicada, não precisou alterar campos ou foi recusada. Corrija erros ou atualize a prévia se a fonte mudar. Se a tela não puder confirmar a aplicação, confira o estado atual antes de repetir a ação.

## Quando uma ação falha ou o acesso muda

Nas edições comuns das páginas, uma resposta perdida deixa o resultado **inconclusivo**. A interface preserva sua tentativa e não reenvia esse comando por conta própria. **Inspect current record without resending** consulta a versão atual para comparação; essa consulta não altera a versão original da tentativa nem confirma que ela foi aplicada. Se o serviço ainda não puder recuperar o resultado, mantenha a página aberta e confira o registro com o responsável antes de iniciar outra alteração. O texto digitado nesses formulários não é guardado no navegador; sair da página pode perdê-lo.

As alterações de **Year amount**, **Annual Entry** e **Save month** do Dashboard possuem uma prévia preservada no servidor. Se a resposta da aplicação se perder, selecione **Check saved outcome**. A interface consulta o resultado da mesma prévia; quando ainda não houver resultado confirmado, **Retry reviewed application** repete somente a aplicação já revisada. Campos alterados depois da tentativa continuam pendentes e não entram nessa repetição.

Ao recarregar a mesma página, uma prévia ainda disponível é recuperada após nova conferência de acesso. O navegador conserva apenas as referências da prévia, página, registro e período; valores e justificativas continuam no servidor. Confira os valores anteriores e propostos antes de aplicar a prévia recuperada. Uma aplicação já confirmada reaparece como resultado recuperado, sem outra gravação. Prévia expirada ou desatualizada exige nova revisão.

Mensagens de indisponibilidade, mudança de acesso, informação desatualizada ou edição simultânea indicam que a informação ou a permissão não pôde ser confirmada naquele momento. Atualize a página e confira o registro de origem. Se houver uma edição em andamento, compare os valores atuais com os seus antes de tentar novamente.

Uma atualização que detecta sessão expirada ou mudança de permissão remove a visualização anterior, inclusive diálogos e rascunhos que não podem mais ser exibidos. Já uma indisponibilidade temporária conserva a edição e informa que a atualização falhou. Se você continuar digitando durante um salvamento, o novo texto permanece pendente depois que a tentativa anterior termina.

Uma lista vazia pode significar que não há itens atribuídos no período, decisões acessíveis ou resultados salvos. Uma tela indisponível não confirma que a ação foi concluída. Em caso de dúvida, consulte o registro de origem antes de repetir uma gravação.

