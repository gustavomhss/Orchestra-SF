# Guia do Workbench da Sucafina

O Workbench reúne trabalho atribuído, documentos e decisões relacionados ao Dashboard, ao Planner e a Procurement. Use-o para consultar contexto, comparar alternativas e registrar uma escolha. Os valores financeiros, pedidos e demais registros oficiais continuam nas páginas do módulo correspondente.

Abra **Workbench** na barra do Dashboard, Planner ou Procurement. As informações e ações disponíveis dependem do seu acesso. Você também pode continuar diretamente no módulo; criar um caso não é necessário para uma atualização operacional simples.

## Encontrar trabalho e documentos

Em **My work**, informe as datas de início e fim e selecione **Find work**. A lista mostra os itens atribuídos que podem ser consultados nesse período. Se ela estiver vazia, confira o período; se disser que o serviço está indisponível ou que o acesso mudou, atualize a página e confirme suas permissões.

Em **Search documents**, procure documentos que você tem autorização para consultar. Abra o resultado para verificar a origem. Um resultado pode deixar de estar disponível se o acesso ou a fonte mudar.

O recurso **Extract document evidence** permite extrair candidatos de documentos autorizados:

1. Selecione **Find documents**, escolha um documento e selecione **Open document**.
2. Informe o nome e o tipo do campo; a unidade é opcional. Selecione **Create extraction schema**.
3. Escolha o esquema e selecione **Extract candidates**.
4. Confira cada valor e sua localização no documento. Abra a fonte antes de selecionar **Confirm this candidate**.

A extração cria candidatos para revisão; não confirma os valores por conta própria. São aceitos texto UTF-8, DOCX e PDF com camada de texto. PDFs digitalizados sem texto não passam por OCR.

## Usar e salvar uma visualização

Na seção **Saved views**, escolha a densidade confortável ou compacta. Para guardar a página e os filtros atuais, informe um nome e selecione **Save this page and filters**. **Use this page as my starting page** define a página inicial dessa área. Você pode abrir uma visualização salva ou removê-la da lista.

Uma visualização só restaura filtros e períodos compatíveis com a página e com o acesso atual. Se a tela informar que o contexto não pode ser restaurado, revise o período e os filtros na página atual e salve uma nova visualização.

## Registrar e comparar uma decisão

Use **Create a decision** quando precisar manter objetivo, critérios, alternativas e histórico juntos. Informe o objetivo, as datas, a moeda e um critério por linha; depois selecione **Create decision**. A tela abre o caso criado. Você pode editar objetivo, período, moeda e critérios em **Edit decision**.

O detalhe mostra o estado e a versão do caso, seus critérios, alternativas e resultados disponíveis. Em cada alternativa, leia o estado da comparação e as condições. **Known subtotal** e **Known difference** mostram somente o que pode ser calculado com as informações atuais; não equivalem a um total ou diferença completos. Uma categoria pendente ou ausente não é zero. Abra **Coverage and sources** para consultar a cobertura e as fontes.

Com pelo menos duas alternativas, use **Compare and choose**:

1. Selecione uma linha de base e uma alternativa diferente.
2. Mantenha os critérios necessários e selecione **Compare**.
3. Confira o estado da comparação, a diferença completa ou conhecida, as condições não resolvidas e o resultado de cada critério.
4. Selecione **Explore sensitivity** para escolher um critério, carregar suas unidades e avaliar um intervalo, quando essa opção estiver disponível.
5. Para registrar sua decisão, escreva o motivo em **Reason for choosing** e selecione **Record choice**.

Comparar não registra uma escolha. Registrar a escolha guarda seu motivo no caso, mas não altera por si só o Planner nem aprova um pedido. Quando houver uma mudança preparada, use **Review current changes** para conferir destino, versão e valores anteriores e propostos. Somente depois marque a confirmação e selecione **Apply reviewed change**. Se a revisão estiver indisponível ou desatualizada, atualize o caso; consulte o recibo e o estado retornado para saber o que foi efetivamente aplicado.

Em **Explore a portfolio**, você pode selecionar decisões e alternativas autorizadas, definir qual decisão guardará a avaliação, período, moeda e limite de combinações e selecionar **Preview portfolio**. Leia elegibilidade, estados de comparação, restrições e limitações antes de selecionar **Save this evaluation**. A avaliação salva fica no histórico do caso. Um resultado parcial ou condicionado continua assim no histórico.

## Explicar uma previsão

Na seção **Explain a forecast** de um caso, escolha duas fontes de previsão diferentes, o período, a moeda e um modelo disponível. Selecione **Start analysis** para pedir uma explicação. A tela mostra o andamento e o histórico. Enquanto estiver em preparação, na fila ou em execução, você pode selecionar **Cancel analysis**.

Quando houver um resultado, abra suas fontes e detalhes para entender a contribuição. A contribuição é uma proposta para revisão; **Accept contribution** registra sua aceitação no caso com o motivo informado, não aplica valores no Planner. Se a análise ficar indisponível, desatualizada ou perder acesso à fonte, confira as fontes e o estado atual antes de tentar novamente.

Essa opção depende de duas fontes de Planner anexadas ao caso e de um modelo disponível. Se o formulário não aparecer, continue usando a comparação normal no Planner ou confira as fontes do caso e o acesso disponível.

## Colar e salvar valores mensais no Planner

Nas páginas **OPEX** e **CAPEX**, a seção **Edit monthly values together** permite colar um intervalo de valores:

1. Escolha **Budget**, **Actual** ou **Forecast** em **Measure**.
2. Cole os valores nas células editáveis. A grade usa 12 meses; o intervalo precisa caber nas linhas e células disponíveis.
3. Selecione **Preview changes** e leia os erros ou alterações apresentados.
4. Quando a prévia estiver correta, selecione **Save changes**.

O sistema pode aceitar algumas linhas e sinalizar outras separadamente. Em caso de conflito, a tela mostra o valor atual e a sua tentativa; suas entradas são preservadas. Compare os valores, atualize a página se necessário e faça uma nova prévia antes de salvar.

## Importar com prévia

Em **Dashboard** e **Planner**, abra **Import with preview**. Selecione **Find destinations**, informe as duas datas do período quando precisar filtrar os destinos e escolha um destino. Selecione um arquivo XLSX, XLS ou JSON e, se for apropriado, marque **Create a new version** ou **Remove records missing from the file**.

Selecione **Preview import** e confira as alterações, origens e erros de linha. A prévia não aplica mudanças. Só selecione **Apply reviewed import** depois de revisar o destino e as alterações. Corrija erros ou atualize a prévia se a fonte mudar. Se a tela não puder confirmar a aplicação, confira o estado atual antes de repetir a ação.

## Quando uma ação falha ou o acesso muda

Mensagens de indisponibilidade, mudança de acesso, informação desatualizada ou edição simultânea indicam que a informação ou a permissão não pôde ser confirmada naquele momento. Atualize a página e confira o registro de origem. Se houver uma edição em andamento, compare os valores atuais com os seus antes de tentar novamente.

Uma lista vazia pode significar que não há itens atribuídos no período, decisões acessíveis ou resultados salvos. Uma tela indisponível não confirma que a ação foi concluída. Em caso de dúvida, consulte o registro de origem antes de repetir uma gravação.
