# Sucafinav1

Módulo exclusivo desta instalação, fora do workspace e do binário distribuído do Orchestra. Fontes: `../Intent.md`, `../Desenho.md`, `../Spec.md` e `../Plano.md`; transições de procurement em `../porta/act.ts`. A autorização posterior do proprietário para agentes paralelos substitui apenas a restrição de despacho do plano.

## Entrada e composição

A entrada atual é `createModule(mount, services)` em `index.ts`. Compõe 16 páginas de Dashboard, sete de Planner e cinco de Procurement e valida a cobertura do registo. O handler responde a GET, HEAD e POST; fora do mount devolve `undefined` para continuar o router existente. `installation.ts` preserva a entrada anterior de leitura para compatibilidade e não é a entrada das operações novas.

O host entrega `authenticate`, `environment`, `persistence` e um limite positivo `maxJsonBytes`. `authenticate` recebe a superfície e o mapa atual de grupos dentro da transação; devolve somente identidade e papéis confirmados no diretório. O corpo, a query e um header de actor nunca estabelecem identidade. Os nomes de grupos começam vazios e são configurados por superfície. A identidade local do servidor não substitui uma pessoa do diretório. `environment` entrega instante, gerador de IDs, diretório real e, quando necessário, chave bancária.

Para a homologação neste Mac, [local/README.md](local/README.md) descreve o factory externo carregado por `orchestra serve --installation` e o launcher com ambiente, banco e credenciais isolados. O módulo usa o mesmo processo e listener dessa nova instância; o aplicativo existente permanece em execução. A ativação Microsoft foi adiada por orientação do proprietário. Sem uma aplicação real registrada, o perfil corporativo permanece fechado. Para uso nesta homologação foi acrescentado um perfil explícito de operador local, autenticado por credencial privada de uso único e identificado na interface; a rota `/sucafina/status` informa o perfil ativo. `runtime/host.ts` preserva a composição direta anterior para outros hosts; não altera um processo já em execução.

## Persistência e serviços privados

`runtime/contract.ts` define a fronteira transacional: dados, versões, sequências, auditoria e notificações são confirmados juntos; falha ou cancelamento não deixa escrita parcial. O adaptador deve serializar concorrência e executar o callback uma vez, sem repetição cega. Escritas obsoletas devolvem conflito com o registo guardado. O adaptador Map de `test/fixture` é exclusivamente uma fixture e não comprova durabilidade após reinício. A homologação implementa `runtime/local-store.ts`, um SQLite privado com confirmação conjunta de estado e BLOBs, codec que preserva valores de auditoria e registros de autenticação separados. `runtime/entra-client.ts` implementa o protocolo Microsoft; `runtime/local-identity.ts` mantém os tokens cifrados no servidor e prepara refresh antes da transação de negócio.

Anexos exigem `assets.persistence` como a mesma instância autoritativa de `persistence`, armazenamento privado transacional, scanner real e chave de assinatura. A confirmação dos objetos privados e dos metadados deve ser atómica, incluindo remoções. Os links expiram e são vinculados à identidade, ao registo e ao objeto. Procurement depende de limite de upload configurado; a ausência não cria um valor por defeito. Sem estes serviços, o módulo não simula armazenamento nem sucesso de upload.

`runtime/operations.ts` fornece entrega de notificações com claim durável e chave de idempotência, lembretes a partir dos períodos configurados, backup e restauro verificado. O host fornece transporte, relógio, lease, resolução real de destinatários e agendamento. Importar o módulo puro não inicia tarefas. O factory local liga manutenção periódica, backups privados e uma caixa de notificações durável para a identidade real do operador local. O perfil Microsoft mantém os avisos em fila até haver transporte corporativo configurado. Backup de Dashboard e Procurement conserva 35 dias; Planner não recebe retenção numérica inventada. O restauro preserva a monotonicidade dos números emitidos e não reproduz notificações já tratadas.

## Funcionalidade disponível

As páginas usam formulários HTTP, autorização de servidor, controlo de versão e auditoria. Incluem orçamento, pessoas, operações, segurança, portefólio, riscos, contratos, stakeholders, performance, versões e linhas do Planner, pedidos, sourcing, fornecedores e emissão de PO. Os controlos administrativos ficam dentro das páginas existentes. As permissões de linhas de orçamento usam chaves qualificadas, como `opexOwners:7` e `capexProjects:7`, para impedir colisões entre coleções; permissões antigas com ID simples exigem nova seleção explícita pelo admin. O recorte do requester abrange listas, totais e detalhe; salário, talento e dados bancários têm controlos próprios. A ligação entre conta e líder continua por definir na fonte e não é inferida pelo módulo.

Os downloads produzem XLSX, DOCX, PPTX, CSV e PO HTML reais. O parser de workbook não executa fórmulas nem macros. `WORKBOOK_LIMITS` define os tetos técnicos de bytes, expansão ZIP, células e estrutura XML; o host pode reduzi-los com `workbookLimits`, sem alterar os limites de negócio dos anexos de Procurement. A pré-visualização de importação antecede a confirmação. A importação JSON de Dashboard preserva configuração de acesso e referências privadas já existentes; remoção de contratos com ficheiros ou introdução de referências de outro armazenamento exige o fluxo de restauro privado verificado. Os relatórios usam dados e cálculos locais, sem ERP ou geração por IA. Para distribuir a instalação, manter `Sucafinav1/` e `porta/act.ts` como diretórios irmãos: a porta é uma dependência de código versionada, não um serviço remoto. O pacote de entrega deve incluir ambos. As dependências de runtime estão declaradas em `package.json`; instalar com `bun install --frozen-lockfile`.

## Validação e entrega

Executar `bun typecheck` neste diretório verifica a entrada, implementações, testes e a porta importada. Os testes executam somente no GitHub Actions, conforme as instruções do repositório Orchestra. Não executar `bun test` localmente.

A validação hospedada copia `Sucafinav1/` e `porta/` para uma fixture num worktree temporário do Orchestra e usa `bun run test:ci script <ficheiros exatos da fixture> --os linux`. Não inclui dados reais, segredos ou `node_modules`. O teste de browser usa Chrome e grava evidência de ecrã. O guardrail do snapshot usa `bun run check:guards --base origin/dev`.

O ficheiro `runtime/ACCEPTANCE.json` acompanha o aceite e distingue testes de ativação real. A suíte completa do módulo em Linux aprovou 467 testes, com dois casos de UID posteriormente aprovados em runner com root; o gate do host corrigido em macOS Intel aprovou 94 testes. Typechecks locais, build, auditoria e guardrails também foram verificados. A homologação isolada está montada em `http://localhost:4110/sucafina/status`, com SQLite privado e scanner real. A ativação Microsoft foi adiada pelo proprietário; o perfil corporativo continua fechado enquanto faltarem aplicação e grupos reais. O perfil de homologação local usa a conta real do macOS e armazenamento separado, sem fingir um diretório Microsoft. No perfil local, os avisos são entregues à caixa de entrada do aplicativo; destinatários que não pertencem a esse perfil permanecem pendentes. E-mail e Teams exigem configuração externa, sem fallback nem recibos de envio fictícios. Evidências e hashes estão no pacote de entrega.

O acesso atual foi conferido visualmente no Chrome deste Mac, na aba CIO Dashboard. O atalho `../Abrir Sucafina.command` prepara uma sessão local autenticada; não usa a rota técnica de status como tela inicial. A correção do acesso local passou em 45 testes hospedados, incluindo as 28 telas no Chrome.

## Operação local e manutenção

A barra superior oferece Notifications, Backups e Sign out. Os avisos internos são persistidos e podem ser marcados como lidos; o logout revoga a sessão local antes de apresentar a página de saída. Não há envio externo automático.

A manutenção gera backups diários das três superfícies com cópias privadas dos anexos e manifestos verificados. Dashboard e Procurement conservam pelo menos 35 dias; Planner não recebe um prazo numérico presumido. O painel Backups permite executar a manutenção, capturar uma cópia e restaurar uma cópia verificada mediante confirmação e revisão atual. A seleção para restauração é fixada antes da retenção, e o estado corrente também é copiado antes da troca. Credenciais de autenticação e arquivos de chaves ficam fora dos backups de negócio.

Os serviços deste Mac podem ser preparados por `local/install-startup.command --prepare <checkout-Orchestra-absoluto> <diretório-privado-absoluto>`. Após conferir o plano e adotar somente os três processos privados anteriores, a ativação instala três LaunchAgents exclusivos da instalação no login do dono: servidor, scanner e atualizador. O aplicativo Orchestra existente não é substituído. O atalho verifica os serviços e o scanner antes de abrir uma sessão autenticada. Consulte [o guia local](local/README.md) para a sequência operacional e os limites de armazenamento local.

## Dashboard WP02: revisão e manutenção contextual

O Dashboard conserva as 16 páginas e seus comandos de domínio. A vista executiva mostra o período de cada bloco e a origem dos sinais. Em **Attention**, a pessoa pode usar **Prioritize** para colocar um sinal antes dos demais. A preferência fica na URL desta vista e sobrevive ao recarregamento; dentro de cada grupo, a ordem continua sendo a data registrada, seguida dos registros sem data. O total exibido cobre os sinais elegíveis dos registros acessíveis. **Open record** abre o registro canônico e conserva o contexto de período.

| Papel e acesso atual | Jornada |
| --- | --- |
| Leitor autorizado | Abrir fatos e registros das páginas concedidas, consultar origem, competência e ausência, escolher prioridades de visualização e abrir o histórico ainda autorizado. |
| Contribuidor com escrita no registro | Abrir **Edit**, alterar os campos autorizados, revisar a prévia quando exigida e confirmar a gravação. Atribuições de linhas e recortes de período continuam sendo verificados no domínio. |
| Revisor com grant de preservação | Abrir **Revisão e ações**, carregar as opções, pré-visualizar a pauta e preservar a reunião ou um retrato de registro. |
| Participante de caso com grants de edição, preparação e aplicação | Editar um rascunho de Hot Topic, preparar uma escolha já registrada no caso, revisar valores atuais e propostos e confirmar explicitamente a aplicação. |

Um conflito de versão conserva o formulário. **Load current version and keep my edits** carrega a revisão atual autorizada, mostra os valores persistidos e mantém o rascunho para comparação. A pessoa precisa salvar e confirmar novamente. Se uma justificativa for editada enquanto a gravação anterior ainda está em andamento, a interface informa que o envio anterior foi salvo e que as alterações novas continuam pendentes.

No rascunho de Hot Topic, **Carregar versão atual e manter minhas alterações** recupera a mesma identidade de rascunho e mostra a versão anterior, a versão atual e os valores digitados. A confirmação **Revisei a versão atual do rascunho e quero manter meus valores** habilita um novo envio. Um segundo rascunho com o mesmo caso e Hot Topic não é confundido com o primeiro; perda de acesso ou substituição da origem mantém a gravação bloqueada.

Em **Security overview**, P1 identifica o mês de IT Operations e os incidentes abertos identificam a data da observação corrente. Cada KPI mostra a competência da sua última medição disponível até o mês executivo, inclusive quando essa medição vem de um mês anterior. Valor ausente permanece indisponível e zero continua sendo um valor medido.

O painel **Revisão e ações** usa as opções descobertas pelo servidor. Os campos de data delimitam o período; **Carregar opções** atualiza registros, reuniões preservadas, casos participados e escolhas existentes. A captura de um registro conserva os valores e a data da observação. Reabrir um retrato exige acesso atual à mesma identidade física; a substituição ou remoção da fonte pode torná-lo indisponível. Um registro atual de pessoas, ações ou performance não ganha um histórico retroativo por trocar o ano da página.

### Roteiro de revisão de uma ação

1. Abra **Hot Topics & Actions**, expanda **Revisão e ações** e carregue as opções.
2. Pré-visualize a pauta. Com o grant correspondente, preserve a reunião ou selecione um registro para preservar seu retrato.
3. Selecione um caso do qual participa e um rascunho existente, ou **Novo rascunho** com o Hot Topic de origem. Edite ação, responsável, prazo, prioridade e notas e salve o rascunho.
4. A preparação exige que o rascunho faça parte de uma escolha já registrada no caso. Selecione essa escolha e confira o motivo registrado. O painel não cria uma escolha financeira nem preenche custos desconhecidos.
5. Use **Preparar escolha**, selecione a alteração preparada e abra **Revisar alterações**. Confira os valores atuais e propostos, marque a confirmação e use **Aplicar alterações**.
6. Consulte o Hot Topic canônico e o comprovante no caso. Reenvios da mesma intenção usam a mesma correlação; mudança de conteúdo, fonte, revisão ou autorização exige nova revisão e pode ser recusada.

### Composição e validação desta revisão

O host liga Dashboard, revisão preservada e aplicação de Hot Topics às mesmas fontes, autoridade e persistência C08. A captura e o vínculo da alteração preparada são metadados privados: o navegador envia seleções e intenção humana, e o domínio resolve o comando final. A seleção de operações residentes conserva apenas operações concedidas simultaneamente pelo perfil e por uma skill selecionada.

As rotas `sf_dashboard_read` e `sf_kpi_explain` usam o mesmo port pela UI, pela admissão nativa e pela bridge MCP privada. A prova AM02 direta carrega bytes reais de skill em `SessionV2`, observa o `SkillLoadReceipt` persistido e compara resultados e proveniência, incluindo o consumidor BI. Essa prova não representa uma geração por LLM nem o gate global GNATIVE.

Para esta revisão WP02, `bun typecheck` do pacote `modules/sucafina`, os guards contra `origin/dev` e a seleção explícita de testes são executados no GitHub Actions. O índice de fechamento fica em `docs/sf2h/receipts/WP02/completion-20261114/README.md` e identifica o commit de produto, o snapshot de testes, o request e os runs. Os recibos anteriores em `docs/sf2h/receipts/WP02/` conservam os resultados e SHAs de suas próprias tentativas. O commit evidencial posterior apenas acrescenta recibos, sem alterar o produto testado.
