# Fechamento da auditoria adversarial

**34 achados originais tratados: 33 implementados nesta campanha e SYS-03 já resolvido pela #716 na base.** Este documento fecha as correções da [PR #717](https://github.com/gustavomhss/Orchestra-SF/pull/717); a auditoria histórica permanece preservada para comparação. O estado da integração é verificável pelo recibo da própria PR.

**Base:** `e115b667d845822a1df5f523bbfd828ab57ca978`.  
**Código final qualificado:** `d522399b7542bb3fc2a12c516213be7f76098678`.  
**Gate final:** [45261780999](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45261780999).  
**Alvo:** `dev`.

## Resultado entregue

A identidade Orchestra foi mantida: glass, transparência, sombras, geometria, fontes e tokens nativos. As mudanças corrigem continuidade do material, contraste essencial, eixos de formulários, densidade de estados vazios, hierarquia de revisão, semântica financeira e relações que se perdiam durante a rolagem móvel. O novo fundo opaco é local às células fixas que precisam cobrir os números durante a rolagem.

As revisões mostram o antes original e a proposta exata; moeda recebida ou ausência explícita; mudanças em primeiro plano; campos inalterados e proveniência em detalhes acessíveis. Teams preserva o rascunho diante de interrupção com a mesma autoridade, enquanto logout, revogação e mudança de principal continuam limpando o conteúdo. O aviso de interrupção só desaparece após READY/OPEN e transcrições prontas. Não há envio automático.

Avaliação de talento começa pelos campos da tarefa; retornos usam destinos canônicos com owner/filtros. Consentimento de pesos depende da exceção original e é renovado após revisão. Upload escolhe o registro autorizado e mantém CAS/arquivo. Fonte obsoleta explica a recusa e oferece releitura sem substituir o HTTP 409 original por sucesso sintético.

## Matriz dos 34 achados

| Item | Correção | Evidência |
| --- | --- | --- |
| SYS-01 | Contenção integral do material de Teams com administração expandida. | [system](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45208327945) |
| SYS-02 | Contorno essencial do campo Team ID com contraste medido nos temas base. | [system](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45208327945) |
| SYS-03 | Cancelamento esperado já corrigido pela PR716 integrada à base. | [#716](https://github.com/gustavomhss/Orchestra-SF/pull/716) |
| SYS-04 | Consumidores de warning usam o token semântico nativo. | [system](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45208327945) |
| REF-01 | Estados terminais de ausência sem área de gráfico/footer vazia. | [system](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45208327945) |
| REF-02 | Hierarquia de Teams prioriza conversa e reduz instruções repetidas. | [system](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45208327945) |
| SUP-01 | Seletor de Add server corrigido; largura, padding e margens móveis nativas. | [system](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45208327945) |
| SUP-02 | RAG com recuperação local e isolamento de respostas por escopo. | [rag](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45215159876) |
| SUP-03 | Upload seleciona registro autorizado e mantém seu CAS sem transcrição manual. | [files](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45236527715) |
| B1 | Revisão de orçamento apresenta o valor anterior conhecido. | [budget](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230251834) |
| B2 | Valores preservados agrupados por registro e campos semânticos autorizados. | [reading](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45233056529) |
| B3 | Um formato de relatório, uma seleção de seções e uma ação de geração. | [reading](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45233056529) |
| B4 | Continuação para a revisão preservada exata e entrada por referência existente. | [reading](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45233056529) |
| B5 | Fonte com loading/erro, cancelamento, isolamento de identidade e recuperação de obsolescência. | [reading](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45233056529) |
| B6 | Moeda original ou ausência explícita em projeto e contrato. | [people](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230257909), [finance](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45228241086) |
| B7 | Milestone com antes/proposto verdadeiros e fonte completa. | [people](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230257909) |
| B8 | Avaliação de talento antes dos dados cadastrais secundários. | [people](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230257909) |
| B9 | Retornos canônicos com owner e filtros, inclusive acesso direto. | [people](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230257909) |
| B10 | Mês completo em EN/PT, janeiro/setembro/dezembro e largura de 320 px. | [opex](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45237067947) |
| B11 | Eixo e largura de tarefa consistentes entre formulários equivalentes. | [people](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230257909), [operations](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45227008271) |
| B12 | Exceção de pesos depende da resposta original e exige novo consentimento após revisão. | [weights](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45232580119) |
| B13 | Diferenças em primeiro plano, inalterados recolhidos e Effects sem repetição integral. | [operations](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45227008271), [requests](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45234374202), [people](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230257909) |
| BA-01 | Rascunho não enviado preservado após interrupção com mesma autoridade. | [teams](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45223658325) |
| BA-03 | Alocação existente corretamente apresentada como edição. | [behavior](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45226990144) |
| BA-04 | Identidade da versão associada às ações na rolagem móvel. | [behavior](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45226990144), [comparison](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45261772401) |
| BA-05 | Nome de negócio primário e referência técnica disponível em contexto. | [finance](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45228241086), [requests](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45234374202), [operations](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45227008271) |
| BA-06 | Razões exatamente iguais agrupadas sem colapsar diferenças reais. | [decisions](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45227015499) |
| BA-07 | Cabeçalhos e coluna Month fixos com fundo opaco nativo local. | [comparison](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45261772401) |
| BA-08 | Cinco valores KPI alinhados mesmo com rótulos PT de duas linhas. | [behavior](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45226990144) |
| BA-09 | Referência e ação de aprovação sem compressão desnecessária. | [requests](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45234374202), [behavior](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45226990144) |
| BF-01 | Revisões financeiras com moeda, precisão e meses localizados. | [finance](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45228241086) |
| ROOT-01 | Período, valor, unidade e marca assinada associados no mobile. | [readingBi](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230262835) |
| ROOT-02 | Previous/Current em células móveis de largura completa, sem quebrar palavras. | [reading](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45233056529) |
| ROOT-03 | Guard nativo com explicação localizada e recuperação contextual autorizada. | [readingBi](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230262835) |

A classificação histórica continua sendo **1 P1, 23 P2 e 10 P3**. Os refinamentos suplementares estão nos relatórios de cada frente, sem inflar essa contagem original.

## Qualificação final

O gate do código composto passou nas seis verificações: tipos do aplicativo, tipos dos E2E, 28 casos semânticos / 122 asserções, 132 casos DOM / 1.822 asserções, 78 regras de guardrail e regeneração idêntica dos sete arquivos de paleta. São **160 casos / 1.944 asserções** nos dois grupos de regressão, além das verificações do wrapper. Não houve erro de guard ou override aprovado.

Dois avisos de guardrail apontam retirada de asserções de arquivos que viraram registros/delegadores. Os oráculos foram realocados e conferidos contra os originais; os mapas e a revisão estão em [final-gates.json](fixes/final-gates.json). Limites existentes e zero retries foram preservados. Separar jornadas independentes aumenta a duração agregada possível da suíte, declarado nos mapas.

Os runs abaixo se sobrepõem e **não devem ser somados como casos únicos**. Subconjuntos aprovados de execuções mistas são identificados expressamente; falhas históricas não são apresentadas como passes.

| Grupo | Run | Resultado | Escopo |
| --- | --- | --- | --- |
| gates | [45261780999](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45261780999) | passed | 6 gates; 28 casos semânticos / 122 asserções; 132 casos DOM / 1.822 asserções; 78 regras; 7 paletas idênticas. |
| system | [45208327945](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45208327945) | passed | 53 casos; contraste e geometria nos temas base, escopo em documento de sistema. |
| rag | [45215159876](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45215159876) | passed | 30 casos. |
| teams | [45223658325](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45223658325) | passed | 13 casos; controles negativos45205412569/45221722913;33 testes adicionais em45223698792. |
| reading | [45233056529](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45233056529) | passed | 1 caso;409 original exato e recuperação; fonte positiva e geração Office não qualificadas. |
| readingBi | [45230262835](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230262835) | qualified-subset | Somente o caso BI/guard passou neste run misto; falha da outra jornada superada por Reading8. |
| decisions | [45227015499](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45227015499) | passed | 3 casos, inclusive EN/PT e320px. |
| finance | [45228241086](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45228241086) | passed | 2 casos; valores e meses exatos em EN/PT. |
| behavior | [45226990144](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45226990144) | qualified-subset | 6 casos passaram; falhas históricas de Finance/Requests superadas pelos runs focais. |
| requests | [45234374202](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45234374202) | passed | 1 caso;8 comandos/8 POSTs originais,322080ms. |
| people | [45230257909](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230257909) | passed | 5 casos; navegação, avaliação, estrutura, projeto e milestone. |
| weights | [45232580119](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45232580119) | passed | 1 caso;422/422/200, consentimento false/false/true e3chaves distintas. |
| operations | [45227008271](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45227008271) | qualified-subset | 3 casos completos CAP13/CAP15/CAP16; demais casos mistos identificados em product. |
| budget | [45230251834](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230251834) | qualified-subset | Orçamento e2casos de tópicos passaram; corpos preservados, falhas restantes qualificadas separadamente. |
| opex | [45237067947](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45237067947) | passed | 1 caso,137726ms; escrita e releitura PT;12 combinações de período/idioma/largura. |
| topics | [45237060264](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45237060264) | passed | 2 casos,167176/65875ms; duas escritas no mesmo registro e referências/foco originais. |
| files | [45236527715](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45236527715) | passed | 5 casos: Import, Documents, Upload, Export e Scenario; ClamD real, CAS, bytes e revogação originais. |
| comparison-diagnostic | [45236795001](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45236795001) | diagnostic-failure | Falha histórica: esperado innerText versus textContent do matcher; conteúdo idêntico. Corrigido com useInnerText, mantendo os oráculos; substituído pelo run final. |
| comparison | [45261772401](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45261772401) | passed | 1 caso; 57.609 ms; 8 PNGs e 76 células/checkpoints com fundo opaco, valores/identidades preservados e zero POST. |

A comparação final produziu oito PNGs originais: resumo/mensal, claro/escuro e ambos os extremos do scroll a 320 px. O teste confirmou 76 células/checkpoints com alpha 255, opacity 1 e posição sticky; nomes/IDs/valores originais intactos, sem POST, erro de console ou erro de página. A revisão independente do extremo direito mensal claro confirmou a eliminação do texto atravessando a coluna fixa.

Files fechou cinco jornadas com ClamD real. As seis capturas finais de upload em 1440/390/320 px foram inspecionadas; os três controles desktop terminam no mesmo eixo, delta 0 px. Recibos conferem CAS, File preservado, bytes exatos do download assinado e revogação 403. A jornada separada de evidência conserva schema, extração, confirmação e negativas de acesso originais.

## Fonte e rastreabilidade

O código foi lido e alterado pelo GitHub e executado no test-ci Linux existente. A inspeção local ficou restrita aos artifacts originais, imagens, recibos e hashes. A PR se limita a **packages/app-shell e documentação**. Backend, workflows de CI e mecanismos de autorização não foram alterados; requests e wrappers de execução existem somente em snapshots descartáveis.

Cada prova conserva seu source/snapshot. As frentes documentam equivalência das partes relevantes quando o candidato posterior contém mudanças disjuntas. Após o código qualificado, a consolidação acrescenta somente documentação; a árvore de produto é confrontada antes do merge. A PR usa o SHA esperado e seu recibo é verificado na dev.

## Limites da conclusão

O inventário histórico cobre **70 áreas e 165 padrões de rota**, com 48 áreas de conteúdo, 12 parciais e 10 apenas em guard. Não representa todas as combinações de dados, permissão, dispositivo e estado.

A abertura positiva de fonte não foi obtida porque o produtor protegido devolveu HTTP 409; a recusa e a recuperação da interface foram validadas. UI50 qualifica seleção, conteúdo, notas e controles de geração; essa jornada não qualifica geração/download DOCX/PPTX. Estados de decisão condicionados a pré-requisitos continuam explícitos. O upload nativo qualifica Supplier/TXT; outras classificações, formatos e falhas específicas mantêm os limites de revisão de fonte registrados em sistema.

Teams usa SSE finito na instalação de teste, não Microsoft real. Contraste foi medido nos temas base claro/escuro; a paridade dos gerados não certifica todas as paletas ou wallpapers. Não houve certificação universal de acessibilidade, leitor de tela, IME, zoom real, teclado virtual físico, Safari ou Firefox. Tempos são amostras, e resultados verdes não provam ausência estatística de flakiness. O timeout histórico de preparação F02 não foi transformado em diagnóstico sem evidência.

Registros completos, hashes de ZIP/PNG, capturas efetivamente vistas, fontes, falhas históricas e mapas de oráculos estão em [comportamento](fixes/behavior.md), [produto](fixes/product.md), [sistema](fixes/system.md) e [leitura/revisões](fixes/reviews.md). [closure.json](closure.json) contém a matriz estruturada. As observações SO1–SO6 preservam suas disposições: não inventar base financeira, não confundir pessoas/owners, manter contraevidência e não usar geometria histórica ou um único run como certificação universal.
