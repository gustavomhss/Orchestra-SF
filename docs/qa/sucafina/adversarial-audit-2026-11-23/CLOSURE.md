# Fechamento da auditoria adversarial

**PR:** [#717](https://github.com/gustavomhss/Orchestra-SF/pull/717) · **Base de implementação:** `e115b667d845822a1df5f523bbfd828ab57ca978`.

As correções dos **34 achados originais** estão implementadas: **33 nesta campanha** e **SYS-03 já resolvido pela #716 na base**. O fechamento ainda aguarda os últimos recibos de Files e da comparação mensal; esta versão é um registro de trabalho, não um recibo de merge. A auditoria histórica em FINDINGS/README permanece preservada e deve ser lida com este fechamento.

A identidade Orchestra foi mantida: glass, transparência, sombras, geometria, fontes e tokens nativos. As alterações se limitam a `packages/app-shell` e documentação. Backend, contratos de autoridade e workflows de CI não foram alterados; requests e wrappers de execução existem apenas em snapshots descartáveis.

## Resultado por achado

| Item | Correção | Evidência |
| --- | --- | --- |
| SYS-01 | Contenção integral do material de Teams com administração expandida. | system |
| SYS-02 | Contorno essencial do campo Team ID com contraste medido nos temas base. | system |
| SYS-03 | Cancelamento esperado já corrigido pela PR716 integrada à base. | base716 |
| SYS-04 | Consumidores de warning usam o token semântico nativo. | system |
| REF-01 | Estados terminais de ausência sem área de gráfico/footer vazia. | system |
| REF-02 | Hierarquia de Teams prioriza conversa e reduz instruções repetidas. | system |
| SUP-01 | Seletor de Add server corrigido; largura, padding e margens móveis nativas. | system |
| SUP-02 | RAG com recuperação local e isolamento de respostas por escopo. | rag |
| SUP-03 | Upload seleciona registro autorizado e mantém seu CAS sem transcrição manual. | files |
| B1 | Revisão de orçamento apresenta o valor anterior conhecido. | budget |
| B2 | Valores preservados agrupados por registro e campos semânticos autorizados. | reading |
| B3 | Um formato de relatório, uma seleção de seções e uma ação de geração. | reading |
| B4 | Continuação para a revisão preservada exata e entrada por referência existente. | reading |
| B5 | Fonte com loading/erro, cancelamento, isolamento de identidade e recuperação de obsolescência. | reading |
| B6 | Moeda original ou ausência explícita em projeto e contrato. | people, finance |
| B7 | Milestone com antes/proposto verdadeiros e fonte completa. | people |
| B8 | Avaliação de talento antes dos dados cadastrais secundários. | people |
| B9 | Retornos canônicos com owner e filtros, inclusive acesso direto. | people |
| B10 | Mês completo em EN/PT, janeiro/setembro/dezembro e largura de320px. | opex |
| B11 | Eixo e largura de tarefa consistentes entre formulários equivalentes. | people, operations |
| B12 | Exceção de pesos depende da resposta original e exige novo consentimento após revisão. | weights |
| B13 | Diferenças em primeiro plano, inalterados recolhidos e Effects sem repetição integral. | operations, requests, people |
| BA-01 | Rascunho não enviado preservado após interrupção com mesma autoridade. | teams |
| BA-03 | Alocação existente corretamente apresentada como edição. | behavior |
| BA-04 | Identidade da versão associada às ações na rolagem móvel. | behavior, comparison |
| BA-05 | Nome de negócio primário e referência técnica disponível em contexto. | finance, requests, operations |
| BA-06 | Razões exatamente iguais agrupadas sem colapsar diferenças reais. | decisions |
| BA-07 | Cabeçalhos e coluna Month fixos com fundo opaco nativo local. | comparison |
| BA-08 | Cinco valores KPI alinhados mesmo com rótulos PT de duas linhas. | behavior |
| BA-09 | Referência e ação de aprovação sem compressão desnecessária. | requests, behavior |
| BF-01 | Revisões financeiras com moeda, precisão e meses localizados. | finance |
| ROOT-01 | Período, valor, unidade e marca assinada associados no mobile. | readingBi |
| ROOT-02 | Previous/Current em células móveis de largura completa, sem quebrar palavras. | reading |
| ROOT-03 | Guard nativo com explicação localizada e recuperação contextual autorizada. | readingBi |

## Qualificação

Os runs abaixo se sobrepõem. Seus totais não devem ser somados como casos únicos. Um subconjunto aprovado em run misto é identificado expressamente; falhas históricas continuam documentadas.

| Grupo | Run | Resultado e escopo |
| --- | --- | --- |
| gates | [45237283693](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45237283693) | passed: 6 gates;28 casos semânticos/122asserções;130 casos DOM/1801asserções;78 regras;7paletas idênticas. |
| system | [45208327945](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45208327945) | passed: 53 casos; contraste e geometria nos temas base, escopo em documento de sistema. |
| rag | [45215159876](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45215159876) | passed: 30 casos. |
| teams | [45223658325](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45223658325) | passed: 13 casos; controles negativos45205412569/45221722913;33 testes adicionais em45223698792. |
| reading | [45233056529](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45233056529) | passed: 1 caso;409 original exato e recuperação; fonte positiva e geração Office não qualificadas. |
| readingBi | [45230262835](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230262835) | qualified-subset: Somente o caso BI/guard passou neste run misto; falha da outra jornada superada por Reading8. |
| decisions | [45227015499](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45227015499) | passed: 3 casos, inclusive EN/PT e320px. |
| finance | [45228241086](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45228241086) | passed: 2 casos; valores e meses exatos em EN/PT. |
| behavior | [45226990144](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45226990144) | qualified-subset: 6 casos passaram; falhas históricas de Finance/Requests superadas pelos runs focais. |
| requests | [45234374202](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45234374202) | passed: 1 caso;8 comandos/8 POSTs originais,322080ms. |
| people | [45230257909](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230257909) | passed: 5 casos; navegação, avaliação, estrutura, projeto e milestone. |
| weights | [45232580119](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45232580119) | passed: 1 caso;422/422/200, consentimento false/false/true e3chaves distintas. |
| operations | [45227008271](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45227008271) | qualified-subset: 3 casos completos CAP13/CAP15/CAP16; demais casos mistos identificados em product. |
| budget | [45230251834](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230251834) | qualified-subset: Orçamento e2casos de tópicos passaram; corpos preservados, falhas restantes qualificadas separadamente. |
| opex | [45237067947](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45237067947) | passed: 1 caso,137726ms; escrita e releitura PT;12 combinações de período/idioma/largura. |
| topics | [45237060264](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45237060264) | passed: 2 casos,167176/65875ms; duas escritas no mesmo registro e referências/foco originais. |
| files | [45236527715](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45236527715) | pending: Cinco jornadas independentes, scanner ClamD real. |
| comparison | [45236795001](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45236795001) | diagnostic-failure: Oráculo usou innerText como esperado e textContent como leitura; corrigido focalmente sem mudar os dados. Nova qualificação pendente. |

## Integridade e acabamento

As revisões mostram o antes original, proposta exata, moeda recebida ou sua ausência. Dados inalterados e proveniência continuam acessíveis. A leitura móvel mantém período/valor, identidade/ação e antes/depois relacionados. As fontes, paletas e materiais nativos foram preservados; o fundo opaco novo é local às colunas fixas que precisam cobrir os números durante a rolagem.

Teams preserva o rascunho apenas quando a autoridade permanece válida. Logout, revogação e mudança de principal continuam limpando o conteúdo; não há envio automático. O aviso de interrupção só é retirado após READY/OPEN e transcrições prontas. O controle negativo demonstrou a falha antes da correção.

A confirmação de pesos depende da resposta original de exceção, com novo consentimento e nova chave após revisão. Upload usa registro autorizado e CAS original; download, scanner, bytes e revogação são conferidos nas jornadas de Files. A leitura de fonte obsoleta mantém o409 original e oferece releitura; não se substitui a recusa por um200 sintético.

## Limites da conclusão

O inventário histórico cobre70áreas e165padrões de rota, com48áreas de conteúdo,12parciais e10apenas em guard. Não é uma afirmação de que todas as combinações de dados, estado, permissão e dispositivo foram executadas.

A jornada UI50 qualifica seleção/conteúdo/notas e os controles de geração; não qualifica geração/download de DOCX/PPTX. A abertura positiva de fonte não foi obtida porque o produtor protegido devolveu409; a interface de recusa e recuperação foi validada. Teams usa SSE finito na instalação de teste, não Microsoft real. Contraste é medido nos temas base claro/escuro, e não em todas as paletas ou wallpapers. Não há certificação universal de acessibilidade nem promessa de ausência estatística de flakiness.

Os limites por caso, snapshots, hashes de artefatos, capturas inspecionadas, falhas históricas e mapas de testes constam nos documentos de [comportamento](fixes/behavior.md), [produto](fixes/product.md), [sistema](fixes/system.md) e [leitura/revisões](fixes/reviews.md). [closure.json](closure.json) contém a matriz estruturada. O estado de integração verificável é o recibo da [PR #717](https://github.com/gustavomhss/Orchestra-SF/pull/717).
