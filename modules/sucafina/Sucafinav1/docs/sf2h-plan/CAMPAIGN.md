# Orchestra SF — campanha integral de produto, IA e equipe residente

**Implementação: PLANNED / NOT_RUN.** O estado da revisão do planejamento é publicado em [formal-review/README.md](formal-review/README.md).

## Resultado contratado

Entregar integralmente o produto Orchestra SF: 28 capacidades existentes, 41 requisitos originais, 18 capacidades de IA, BI, imports, reuniões, exportações, colaboração, rotinas, casos de decisão, portfólio, documentos e memória. Inclui cinco perfis residentes, dezoito skills, um MCP Sucafina com oito packs e 39 operações, além do Atlas SF Business Profile v1. Janela alvo de 120 minutos, com paralelização explícita e sem retirar escopo ou substituir capacidades por demonstrações.

André e o time expressam intenção, investigam evidências, comparam consequências, esclarecem o que falta, registram escolhas, executam pelos fluxos existentes e reavaliam mudanças relevantes sem reconstruir contexto.

Repositório: `gustavomhss/Orchestra-SF`. Baseline de código: `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`. A campanha tem **15 WPs, 74 tasks e 17 contratos**. O conjunto mantém as 28 capacidades originais, os 41 requisitos e as 18 capacidades de IA.

## Escopo integral

- Dashboard e as suas 16 capacidades; Budget Planner e as suas 7 capacidades; Procurement e as suas 5 capacidades.
- Navegação, busca, visões salvas, entrada por responsabilidade, Meu trabalho, leitura/edição/decisão e recuperação de contexto.
- Manutenção contextual, dados e premissas explicáveis, cenários, prévia de importação com impacto, colaboração e relações explícitas.
- Oito gráficos contextuais, revisões preservadas, material de reunião e exportações completas.
- Quatro rotinas de preparação com Relay, assistência contextual sobre diferenças e recorrência interna pelo caminho nativo permitido.
- Composição no módulo real, compatibilidade com estado anterior, concorrência, permissões e revisão independente.
- Casos persistentes, alternativas estruturadas, critérios, premissas, escolhas humanas e propostas aplicáveis por domínio com recibos e recuperação parcial.
- IA real pelo host autorizado: intenção, descoberta de contradição com fontes, alternativas, crítica, perguntas relevantes e reformulação após resposta; cancelamento e resultado desatualizado explícitos.
- Cenários de portfólio com operações suportadas e restrições explícitas; comparação e sensibilidade reproduzíveis.
- Extração de PDF digital, DOCX e texto com referência a página/trecho/campo e confirmação; documentos escaneados sem texto são recusados como não suportados, sem alegar OCR.
- Reavaliação por referência/campo/período, recuperação autorizada de decisões semelhantes e previsto versus observado sem atribuição causal inventada.
- Hoje e mesa de decisão acessíveis a partir de contrato/pedido/projeto; edição operacional direta continua disponível.
- Integração de produto no composition root do host para fornecer identidade, projeto, sessão e serviços de IA/Relay já autorizados; não envolve Azure ou credenciais novas.
- Equipe residente com cinco perfis, dezoito skills distribuídas e carregadas pelo runtime nativo, MCP sucafina-workbench com oito packs/39 operações, memória Atlas empresarial durável e seis provas integradas AM01–AM06.

### Fronteiras do trabalho

- Azure, hospedagem, deploy, identidade corporativa e infraestrutura já conduzidos por outra frente.
- Novos acessos SAP, Fabric, diretórios externos ou integrações como condição para produzir valor.
- Mudanças de alçada, política de compras, autoridade de aprovação ou política financeira sem uma decisão explícita sobre uma divergência concreta.
- Mensagens para terceiros, envio de relatórios, e-mails, Slack ou Teams. Preparar conteúdo dentro do produto não autoriza enviá-lo.
- Novo ERP, editor genérico de BI, novo sistema de tarefas ou chat obrigatório para executar o trabalho normal.
- Mudanças nos engines do Maestro, Relay e Schedule; o produto deve consumir capacidades atuais e mostrar seus limites.

## Paralelização e recursos

Cinco conversas efetivamente abertas; no máximo quatro agentes vivos por conversa, incluindo a coordenadora. São quinze auxiliares e cinco coordenadoras, pico de vinte atores; uso da coordenadora para código consome seus próprios minutos. Runners de CI e concorrência de modelos são recursos externos observados, não slots presumidos.

| Sessão | Frente | WPs |
| --- | --- | --- |
| S0 | Integração e controle | WP00, WP10 |
| S1 | Experiência e domínios financeiros | WP01, WP02, WP03 |
| S2 | Compras dados e BI | WP04, WP05, WP06 |
| S3 | Trabalho de equipe e rotinas | WP07, WP08, WP09 |
| S4 | Decisões IA e portfólio | WP11, WP12, WP13, WP14 |

O escritor e os caminhos de cada frente estão em [ownership.json](ownership.json). Alocações, checkpoints e condições de capacidade estão em [schedule.json](schedule.json). A coordenadora não conta como dois agentes quando implementa e integra.

WP14.T05 S4 10-20; coordenação 20-22; T01 S4 22-34; coordenação 34-35; T02 S4 35-43; transferência exclusiva em 43 para S0-C; T03 S0-C 43-56; T04 S0-C 56-68; consumo/provas 68-75. Não há resgate automático por S0-A, que está no Atlas. Se transferência falhar, S4 continua como escritor único e S1/S3 absorvem sua coordenação em janelas explicitamente revistas; recalcular ETA sem remover escopo.

## Relógio e condições de conclusão

T0 é a primeira execução da integradora; inclui preflight e início das outras quatro sessões. Não reiniciar o relógio depois da qualificação.

Alvo condicional de 120 minutos, não duração medida nem garantia. O replanejamento usa exclusivamente cinco sessões com quatro slots incluindo coordenadora. As reservas abaixo são orçamento de trabalho a validar em GREADY/GNATIVE/G2H/G4; fila de CI, latência do provider, geração Atlas e correções não têm duração inventada.

| Minuto | Gate | Condição |
| ---: | --- | --- |
| 0 | T0 | S0 registra relógio e baseline, publica os cinco prompts e o mapa de escritores. Setup e abertura das outras quatro sessões entram no relógio; não reiniciar T0. |
| 5 | GREADY | Cinco sessões e seus vinte slots máximos, contando cinco coordenadoras, têm presença observada. Confirmar atores, leases e minutos. Slot ausente causa realocação explícita e revisão do ETA; não reduzir escopo. |
| 10 | G0 | C01–C17, schemas, operações dos oito packs, versões, paths, escritores e exemplos normativos congelados por WP00.T02. Manifest de execução ainda distingue fontes planejadas de bundles produzidos. Toda construção determinística é liberada por T02, mesmo com GNATIVE pendente. |
| 20 | GNATIVE | No mesmo candidato de qualificação: caso C09 real com principal/versão/encarnação, sf_finance registrado por AgentV2, sf-explicar-forecast carregada de fonte distribuída com digest, SessionV2.prompt e ponte MCP privada C16 chamam sf_forecast_compare sobre createPlannerPort.compareForecast real; resultado financeiro retorna ao produto com proveniência. UI e MCP usam o mesmo port, principal e base. Teste de chamada direta não concedida e provider homônimo falha. Oito packs têm contratos/concessões listados; operações ainda não implementadas retornam unavailable, não sucesso. AM02 completo dos oito packs é obrigatório em G4. Falha não retém construção determinística. |
| 25 | G1 | C08 protected-store provider publicado, runtime mínimo integrado, primeiros providers dos três domínios e corpus/caso reais. S0-C inicia probes de CI com seleção real e capta fila/setup, sem extrapolar duração do conjunto final. |
| 40 | G2 | Domínios e consumidores iniciais conectados; resolver documental real publicado em T+20 e extração em T+35; fontes de skills dos colaboradores recebidas até T+38. Integração incremental e primeira medição de CI identificadas por SHA. |
| 40 | G2H | Recalcular caminho residual de construção, provas live, revisão e CI a partir de capacidade e durações observadas. Alvo 120 fica CONDITIONAL se qualquer duração/concurrency obrigatória for desconhecida. Se projeção ultrapassar 120, marcar AT_RISK e publicar sequência full-scope continuada com os mesmos owners, sem reclassificar entrega parcial. |
| 55 | G3 | Cinco perfis e dezoito fontes/skills finais empacotados e carregáveis, execução própria do Revisor disponível, inferência real/contradição/simulação e Relay demonstrados. Atlas real importado pela boundary de distribuição, com BCS, resolver e append/read protegido; prova de reinício/ACL continua até G4. Todos os consumidores tardios ainda têm entregas e ETAs explícitos. |
| 75 | G4 | Escopo funcional integral conectado: cinco perfis, dezoito skills executáveis, oito packs operacionais, Atlas/ledger e documentos reais, aplicações C12 por domínio e UI/Relay consumidores. AM01-AM06 têm integração exercida e candidato cumulativo congelado. Nenhuma fixture satisfaz produção/consumo. Reavaliar G2H com seleção final de CI e provas live. |
| 95 | G5 | Primeiro conjunto de aceitação cumulativa do candidato concluído e três pareceres independentes por seção. Falhas vão ao único escritor; o prazo só permanece viável se CI, provas live e correções residuais observadas couberem. |
| 103 | G6 | Último candidato corrigido congelado, se houve alteração; disparar gates cumulativos exigidos e repetições live afetadas com recibo do candidato. Se candidato G4 não mudou, não criar commit artificial para reiniciar provas. |
| 118 | G7 | Receipts completos para o candidato aceito: seleções distintas app/src e app/test-browser, Atlas boundary, demais suites obrigatórias, AM01-AM06, três revisões sem autojulgamento e nenhum achado obrigatório aberto. |
| 120 | G8 | Emitir aceite somente se G7 passar; caso contrário publicar atraso, pendências, próximo ETA, donos e continuação de todo o escopo. Não declarar meta de duas horas cumprida nem encerrar a execução por tempo esgotado. |

G4->G5 reserva 20 minutos e G6->G7 reserva 15 minutos como hipóteses condicionais para o conjunto observado de CI, provas live e rechecks. Timeout 45 minutos é limite de cada job, não previsão. O plano não presume oito runners livres nem extrapola seleção parcial para suíte final. Medir fila, setup, execução e coleta separadamente; desconhecido não conta como zero.

O prazo de 120 minutos continua sendo meta condicionada. Caso alguma capacidade, integração ou prova obrigatória permaneça aberta, o escopo completo continua em execução. O relógio não concede aceite.

## Contratos, tarefas e consumo real

A lista normativa é [campaign.json](campaign.json). Os demais artefatos são derivados por `python tools/render_plan.py`; `--check` detecta divergências. Alterar a fonte canônica e regenerar as cópias no mesmo commit.

depends_on exige contrato ou saída local pronta. integrates_with define produtores reais necessários para concluir, sem bloquear a construção inicial quando fixtures de contrato permitem avançar. Fixture nunca fecha aceite.

S0 publica qualquer mudança de contrato com versão, compatibilidade, consumidores afetados e provas invalida das. Stub é somente scaffolding temporário.

| Contrato | Responsável pela definição | Nome |
| --- | --- | --- |
| C01 | WP00 | Contexto, capacidades e referências |
| C02 | WP00 | Projeções autorizadas dos domínios |
| C03 | WP00 | Comandos e edição |
| C04 | WP00 | Importação com impacto |
| C05 | WP00 | Revisão preservada |
| C06 | WP00 | Colaboração e ação canônica |
| C07 | WP00 | Rotina e resultado |
| C08 | WP00 | BusinessPorts e composição nativa |
| C09 | WP00 | Caso de decisão e referências |
| C10 | WP00 | Simulação e operações de cenário |
| C11 | WP00 | Análise de IA pelo host |
| C12 | WP00 | Mudanças preparadas e recibos |
| C13 | WP00 | Condições e memória autorizada |
| C14 | WP00 | Documentos e portfólio |
| C15 | WP00 | Perfis residentes, skills executadas e contribuições consumidas |
| C16 | WP00 | Chamada SF confiável e servidor MCP privado com paridade |
| C17 | WP00 | BusinessEvidenceRef, BusinessContextService e memória Atlas protegida |

As assinaturas, semânticas, produtores e consumidores ficam em [contracts.json](contracts.json). A equipe residente possui [manifesto canônico](agents-atlas-mcp.json), [guia técnico](AGENTS-ATLAS-MCP.md) e [contratos detalhados](specs/resident-runtime.md). Cada entrega adicional precisa de resultado consumido e prova identificada.

## Axiomas da campanha

### Definition of Done

- **CAMP.DOD.01** — Todos os WPs e tasks da lista canônica em campaign.json estão implementados, integrados, verificados e com os cinco grupos de axiomas aplicáveis satisfeitos.
- **CAMP.DOD.02** — As jornadas J01–J13 funcionam nos entrypoints reais, com persistência, autorização, produtores e consumidores reais, incluindo IA, Relay, documentos, portfólio e memória.
- **CAMP.DOD.03** — Três revisões independentes reconciliadas; nenhum achado obrigatório aberto; checks requeridos válidos para o candidato final e evidência recuperável.
- **CAMP.DOD.04** — As verificações exigidas pelo repositório e a cobertura de paridade estão válidas para o candidato final; o guia por papel, a demonstração e os limites materiais estão entregues.
- **sf2h-integral-20261112.DOD.05** — As 28 capacidades, R01–R41 e todas as capacidades IA01–IA18 estão implementadas, conectadas a produtores reais e verificadas no candidato de produto. A renovação é uma jornada de aceite, não a fronteira do produto.
- **sf2h-integral-20261112.DOD.06** — T+120 é prazo alvo. Caso reste capacidade ou prova obrigatória, a campanha continua aberta com estado e causa concretos; não declarar MVP, DONE parcial ou feature pronta por estar atrás de flag desativada.
- **CAMP.DOD.20** — C06 resolve confirmação por escopo e C10 resolve cobertura de custos; produtores e consumidores reais demonstram as contraprovas CONFIRM-SCOPE e AI-RENEWAL-OMITTED-CATEGORY.
- **CAMP.DOD.90** — RA01–RA06, C15–C17 e as provas AM01–AM06 estão satisfeitos no candidato implementado: perfis/skills realmente carregados, 39 operações com produtores e consumidores reais, MCP com autoridade por chamada e memória Atlas persistida. O planejamento não registra este critério como aprovado.

### Invariants

- **CAMP.INV.01** — Domínios continuam como fontes de verdade. UI, BI, relatórios, importação e IA consomem os mesmos contratos; não mantêm cálculos financeiros ou estados de compra paralelos.
- **CAMP.INV.02** — Papéis, escopo de dados, holders, locks, versões esperadas e transições legais são preservados. Tornar uma ação fácil de encontrar não amplia autoridade.
- **CAMP.INV.03** — Ausência, zero observado, valor herdado, estimativa, valor aprovado e emissão interna mantêm significados distintos; período, versão e moeda não mudam silenciosamente.
- **CAMP.INV.04** — Nenhum conteúdo restrito reaparece em busca, contagem, comparação, gráfico, comentário, snapshot, exportação, prompt ou resultado de rotina. Ler ou aplicar revalida acesso atual.
- **CAMP.INV.05** — Relações são explícitas por identidade; coincidência de nomes não cria vínculo, responsável, permissão ou lançamento financeiro.
- **CAMP.INV.06** — Revisão preservada permanece estável. Atualizar a origem não reescreve a reunião passada; acesso revogado não permite recuperar conteúdo privado por histórico.
- **CAMP.INV.07** — Um único WP pode escrever cada arquivo. Nenhuma execução usa a frente de cloud/deploy, acessos novos ou alterações no engine de Relay como atalho para cumprir este escopo.
- **sf2h-integral-20261112.INV.08** — A IA não escolhe ator/papel, não ganha acesso por relacionamento entre registros, não aprova compras nem altera arbitrariamente snapshots; totais e condições são calculados por motores determinísticos.
- **sf2h-integral-20261112.INV.09** — Contrato, orçamento, forecast e actual não são intercambiáveis. Desconhecido, categoria omitida e pending não são zero. Comparação completa depende de cobertura C10; simulação e premissa aceita não atualizam o domínio oficial.
- **sf2h-integral-20261112.INV.10** — Artefatos confiáveis de decisão e colaboração têm política explícita de importação: entrada não pode forjar autor/confirmação; substituição de registros invalida referências por encarnação, sem ressuscitá-las por ID textual reutilizado.
- **sf2h-integral-20261112.INV.11** — Leituras entre superfícies não ocorrem dentro de uma transaction já aberta. A coleta mantém autorização e versões por seção; a escrita em várias áreas produz recibos separados e estado parcial verdadeiro.
- **CAMP.INV.20** — Versão observada não equivale a validade global; soma correta não equivale a custo completo. Nova categoria relevante, revogação e substituição preservam auditoria e exigem estado correto.
- **CAMP.INV.90** — Perfis empresariais não renomeiam o Maestro nem mudam os engines. Nenhum argumento do modelo cria autoridade; o host revalida identidade e acesso. Leases de arquivo mantêm um único writer por intervalo. Resultado sem scanner, skill carregada ou persistência exigida não pode ser declarado sucesso.

### Quality standards

- **CAMP.QLT.01** — As três atividades — revisar, editar e decidir — têm hierarquia própria, ação principal clara, contexto persistente e progressão previsível; interfaces de leitura não são dominadas por formulários.
- **CAMP.QLT.02** — Fluxos essenciais funcionam por teclado; foco é visível e recuperado; status não depende apenas de cor; tabelas e gráficos têm alternativa legível. Verificar 320, 768 e 1440 px e zoom de 200%, sem prometer conformidade normativa sem auditoria específica.
- **CAMP.QLT.03** — Salvar, cancelar, validar, recusar, carregar, ficar sem dados e conflitar possuem resposta compreensível. Falha ou conflito conserva a entrada local e oferece próximo passo útil.
- **CAMP.QLT.04** — Número relevante informa unidade, referência temporal, origem e limitações. Comparações reconciliam e distinguem descrição de hipótese; narrativa gerada não inventa causalidade.
- **CAMP.QLT.05** — Com corpus sintético e ambiente declarados em G0, medir navegação, edição e atualização de gráficos. A ação mostra resposta perceptível em até 200 ms, inclusive indicador de trabalho; comparar a conclusão com o baseline e investigar regressão superior a 20% no p95 antes do aceite.
- **CAMP.QLT.06** — Critérios e evidências são discriminantes: descrevem qual erro real seria detectado. Testar novamente apenas o que mudou ou o que um gate obrigatório exige.
- **sf2h-integral-20261112.QLT.07** — O produto continua utilizável se a análise de IA demorar, falhar ou for cancelada. Resposta rápida de cálculos, erro junto ao campo, foco preservado e confirmação de gravação efetiva.
- **sf2h-integral-20261112.QLT.08** — A contribuição real da IA é demonstrada em variante de caso não preenchida previamente; modelo deve encontrar fonte/condição relevante, produzir proposta tipada e reformulá-la após contribuição humana.
- **CAMP.QLT.20** — Estado de confirmação e condição financeira são explícitos em UI, rotina, BI, crítica e portfólio, sem inventar permissão, regra fiscal ou valor para preencher ausência.
- **CAMP.QLT.90** — Cada contribuição residente informa perfil, skill/versão/digests, execução, fontes, permissões e estado. Sua saída tipada chega a um consumidor real da UI e pode ser retomada após reload; falha, indisponibilidade e resultado desatualizado têm próximo passo explícito.

### Completeness criteria

- **CAMP.CMP.01** — Cobrir os contratos C01–C17, as 28 capacidades originais, R01–R41, IA01–IA18 e todas as jornadas da matriz, sem descartar comportamento de negócio aceito.
- **CAMP.CMP.02** — Cobrir leituras e escritas autorizadas/recusadas, dados completos/parciais/ausentes, concorrência, reenvio, referência removida, perda de acesso e retomada depois de falha.
- **CAMP.CMP.03** — O ciclo antes/durante/depois é coberto para executivo, contribuidor, Finance/HR e requester/buyer/approver, usando as permissões reais em vez de um usuário administrador único.
- **CAMP.CMP.04** — As contribuições novas são acessíveis pelos entrypoints reais, com estado compatível e assets/receitas incluídos na entrega do módulo; documentos ou receitas que só existem no repositório não contam como funcionalidade.
- **CAMP.CMP.05** — Cada requisito tem tasks responsáveis, jornadas e evidência esperada. Cada task tem owner, fronteira, entradas, saídas, dependências, checks e os cinco grupos de axiomas locais.
- **sf2h-integral-20261112.CMP.06** — Cobrir ciclos de uso antes/durante/depois: primeiro uso com responsáveis, manutenção, importação, planejamento, compra, análise IA, portfólio, reunião/exportação, recorrência e reavaliação.
- **CAMP.CMP.20** — Cobrir material/irrelevante/revogado/substituído, categoria incluída/inaplicável/pendente/omitida/zero e consumo WP06→WP09 da extração obrigatória.
- **CAMP.CMP.90** — Cobrir cinco perfis, dezoito skills, oito packs, 39 operações, seis provas AM01–AM06 e RA01–RA06. Para cada skill registrar entradas, grants, saída persistida, consumidores, casos positivos/negativos e participação nas provas; incluir empacotamento, revogação, isolamento e reinício.

### Success criteria

- **CAMP.SUC.01** — André identifica um assunto que exige atenção, vê a referência dos dados, abre sua origem, prepara uma revisão e retoma os encaminhamentos sem reconstruir o contexto em uma planilha auxiliar no roteiro coberto.
- **CAMP.SUC.02** — Um contribuidor atualiza três valores e uma justificativa, ou confirma a versão sem alteração, preservando contexto; uma segunda pessoa vê a projeção compartilhada correspondente.
- **CAMP.SUC.03** — Finance compara hipóteses de forecast e explica a diferença até os componentes; o exemplo 590000 → 602000/596000 reconcilia sem alterar budget, actual fechado ou versão oficial por efeito colateral.
- **CAMP.SUC.04** — Um aprovador identifica etapa, valor, diferença relevante, razão da escolha e próximo passo em até 30 segundos no roteiro controlado; decisões continuam explícitas e autorizadas.
- **CAMP.SUC.05** — Importar, exportar e preparar material não exige redigitação de valores já disponíveis. Prévia e resultado confirmado concordam; toda omissão, restrição ou pendência é explícita.
- **CAMP.SUC.06** — Rotinas reduzem preparação repetitiva e devolvem saídas verificáveis e ações propostas. Repetir uma execução não duplica ações e não concede aprovação de negócio.
- **CAMP.SUC.07** — O aceite interno observa os resultados acima. Adoção e satisfação reais de André/time permanecem hipóteses a medir quando o uso real estiver disponível, sem alegar pesquisa com pessoas que não participaram.
- **sf2h-integral-20261112.SUC.08** — Pergunta e confirmação são reutilizadas no escopo ainda válido C06; versão global irrelevante não gera recobrança. Mudança comercial ou resolução de custo repercute nas comparações sem duplicar contribuição; a escolha e ressalvas originais continuam explicáveis.
- **sf2h-integral-20261112.SUC.09** — A avaliação controlada registra compreensão e retomada da decisão; metas de tempo são metas a medir, nunca promessa de pesquisa ou economia financeira já realizada.
- **CAMP.SUC.20** — A pessoa evita cobrança irrelevante, identifica a informação que condiciona a comparação e reavalia custo posterior sem perder a escolha original.
- **CAMP.SUC.90** — André e seu time recebem contribuições de especialistas no contexto de trabalho: podem abrir fontes, comparar impactos determinísticos, responder pendências uma vez, contestar a proposta em execução independente e recuperar a decisão e seus resultados sem refazer a análise.

## WPs e tasks

| WP | Objetivo | Sessão | Tasks |
| --- | --- | --- | ---: |
| [WP00](work-packages/WP00.md) | Contratos, baseline e critérios de aceitação | S0 | 4 |
| [WP01](work-packages/WP01.md) | Interface comum e navegação | S1 | 5 |
| [WP02](work-packages/WP02.md) | Dashboard e manutenção dos domínios | S1 | 4 |
| [WP03](work-packages/WP03.md) | Budget Planner e cenários | S1 | 5 |
| [WP04](work-packages/WP04.md) | Procurement orientado à decisão | S2 | 5 |
| [WP05](work-packages/WP05.md) | BI contextual e gráficos | S2 | 5 |
| [WP06](work-packages/WP06.md) | Importação com impacto e recibo | S2 | 5 |
| [WP07](work-packages/WP07.md) | Revisões, reuniões e relatórios | S3 | 4 |
| [WP08](work-packages/WP08.md) | Colaboração, vínculos e Meu trabalho | S3 | 6 |
| [WP09](work-packages/WP09.md) | Rotinas de produto com Relay | S3 | 7 |
| [WP10](work-packages/WP10.md) | Composição, revisão independente e aceitação | S0 | 7 |
| [WP11](work-packages/WP11.md) | Casos de decisão e execução preparada | S4 | 4 |
| [WP12](work-packages/WP12.md) | IA contextual e análise verificável | S4 | 4 |
| [WP13](work-packages/WP13.md) | Cenários de portfólio e sensibilidade | S4 | 4 |
| [WP14](work-packages/WP14.md) | Reavaliação e memória das decisões | S4 | 5 |

Cada task/step é uma unidade com trabalho, entradas, saídas, writer, consumidores, checks e cinco famílias de axiomas próprios. Subdivisão executável com responsabilidade distinta deve ganhar os mesmos cinco grupos. Os índices não substituem a observação do comportamento.

## Evidência e revisão

| Pacote | Escopo |
| --- | --- |
| E01 — Contratos montagem e integridade | Contratos compilados, exports registrados, ownership disjunto, entrypoint real e persistência após reload. C15–C17, AM02, checkpoints, distribuição de skills e Atlas boundary real. |
| E02 — Navegação e estados | 28 entradas, navegação contextual, retorno, primeiro uso, teclado, 320/768/1440 px, rascunho, falha e conflito. |
| E03 — Dashboard completo | 16 capacidades do Dashboard, manutenção, projeções, sinais com fontes e Hot Topics sem duplicação. |
| E04 — Planner financeiro | 7 capacidades do Planner; edição mensal e em lote; FX, HR, locks, versões e separação budget/actual/forecast. |
| E05 — Procurement completo | 5 capacidades de Procurement; PR, sourcing e PO; ranking, alçadas, moedas, fornecedores e estados completos. |
| E06 — BI e tabelas | 8 perguntas analíticas originais e 3 novas; fontes, drilldown e tabela reconciliada com os valores dos gráficos.  BI/tabela consumem C10: categoria omitida não desenha zero; subtotal e limiar condicionados mantêm a mesma condição da UI, crítica e portfólio. |
| E07 — Imports e confiança | XLSX, XLS e JSON; prévia, cancelamento, aplicação, recibo, roundtrip e proteção contra metadados forjados. |
| E08 — Reuniões e exportações | Pauta, revisão congelada, fechamento e ações; 25 registros e notas longas; PPTX e DOCX renderizados e conferidos. |
| E09 — Colaboração e primeiro ciclo | Primeiro ciclo, diretório autorizado, perguntas e respostas, confirmar sem alteração, escopo por período e Meu trabalho.  CONFIRM-SCOPE é obrigatório: alteração só de fevereiro mantém janeiro válido e não recobra; janeiro/dependência material gera uma pendência; concorrência, revogação, substituição e auditoria original são conferidas no produtor e na rotina/fila reais. |
| E10 — Decisão e execução | Caso persistente, alternativas, critérios, escolha, mudanças preparadas e recibos por domínio.  Cobertura C10 é comprovada com inventário completo e categoria inteiramente omitida, zero informado e escolha condicionada preservada; confirmar training = 40000 inverte a comparação210000→250000. |
| E11 — IA real e portfólio | IA real em variante não roteirizada; fontes, contradição, crítica, propostas tipadas e portfólio sob restrições.  Crítica e portfólio consomem a mesma cobertura C10 e não aprovam completude por soma. A variante omitida não deve trazer uma linha pending pré-cadastrada.  C15 exige18 witnesses de skill carregada+outputRef persistido+consumidor real, contribuição distinta dos 5 perfis e Revisor em run próprio; os witnesses podem compartilhar as seis provas integradas. WP01.T05.CHK.30/31 verificam uso pela interface e estados de falha. AM01: 5 perfis/18 skills com trace de carga/uso, modelos efetivos eRevisorindependente. |
| E12 — Memória e reavaliação | Mudança material e irrelevante; escolha preservada; recuperação após commit e resposta perdida; memória e revogação.  Reavaliação após categoria resolvida/custo inversor preserva a escolha original e o estado condicionado de sua base; comparação posterior vem do domínio. AM05: ports reais de Atlas, owner/ACL/restart/ledger/cases e 5 perfis sem seat engenharia. |
| E13 — Relay real | Quatro preparações originais e decisão por Relay; admissão, versão, run e checks reais; nenhuma espera humana inventada.  Revisão usa validade material C06 sem recobrança irrelevante. Dossiê consome DocumentEvidence C14 do WP06 com evidência de candidato, confirmação e atualização/revogação. AM06: admissão Relay eproduto/perfil/skill retornam resultado verificável. |
| E14 — Schedule e retomada | Schedule nativo; timezone, recorrência, pausa, falha, revogação e deduplicação de execução/sinal. AM06: retomada/recorrência/Schedule mantém limites atuais e correlação. |
| E15 — Documentos e injeção | PDF digital, DOCX e texto; trecho de origem e confirmação; documento malicioso, inválido ou sem texto tratado corretamente.  Handoff WP06.T05→WP09.T04 compartilha evidenceRef/versão/trecho; parser só no WP06 e candidato não é fato confirmado. AM03/AM05: referênciasdocumentais/injeção/scanner/isolation/revocation reais. |
| E16 — Integração e regressão | Suites exigidas do epic e pacotes afetados, consumidores reais, compatibilidade, host binding e UI integrada. Oito recipes mínimas, AM01-AM06, oito packs com paridade e Atlas check:generated/typecheck. |
| E17 — Reviews independentes | Três pareceres independentes com achado, impacto, evidência, correção e reteste. Três reviewers novos após encerrar builders: autores ativos corrigem e reviewers não editam produto. |
| E18 — Entrega e proveniência | Candidato de produto, snapshot de CI, request, run, jobs e resultado; guias, demo e matriz completa. Candidato→snapshot→request→selection→run/artifacts, manifests/skillhashes/leases e G2 Htemporal. |

CI aponta SHA e run real; interação aponta entrypoint e ator; export contém arquivo e inspeção; rotina contém run/receita/entrada reais. Screenshot sozinho não prova cálculo, permissão ou persistência. Mudança posterior invalida o conjunto de critérios afetado.

Roteiros de 30 segundos e manutenção rápida são metas de aceite em avaliação controlada, não alegação de pesquisa com André. Registrar participante/avaliador, contexto e tempo; separar inferência de observação.

A matriz [proof-map.json](proof-map.json) vincula cada critério a conjuntos de provas. Um pacote aprovado não aprova automaticamente todos os seus critérios. Perfis, skills e packs têm vínculos próprios no manifesto residente.

## CI e entrega

GitData MCP cria snapshot S descendente do candidato C com .ci-run.json; criar branch ci-run-linux-<id> em S dispara test-ci.yml. Não criar workflow novo nem alterar validator.

Usar script/test-ci-location.ts/resolveTestPackage e script/test-ci-request.ts/validateRequest na árvore S, com o resolvedor do repositório. atlas-boundary é um alias verificado. args=[test-browser] é seleção aceita para Bun. Enviar os três specs Playwright somente depois de commitados e verificar os arquivos e a configuração exatos. Esta reconciliação do plano não executou testes do produto.

As seleções Bun de `src` e `test-browser` têm recibos separados. Provas reais de IA, MCP, Atlas e Relay mantêm a identidade do candidato e não são substituídas por mocks. Aplicam-se o inventário cumulativo, os typechecks e os guards exigidos em AGENTS.

A entrega é um candidato integrado e commitado, com os gates exigidos, revisões reconciliadas e guias de uso. A aprovação deste planejamento não certifica a implementação futura.

## Como iniciar

Use [START.md](START.md) e os cinco prompts no mesmo commit do plano. Cada sessão lê suas WPs completas, os contratos e as restrições comuns antes de escrever. GitHub é acessado pelo MCP existente; não criar novas credenciais.
