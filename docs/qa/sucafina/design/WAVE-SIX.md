# Sexto lote — 14 áreas nativas Sucafina

O lote UI57–UI70 refina 14 áreas e seus 25 padrões de rota existentes. Mantém a identidade nativa do Orchestra e a autoridade dos serviços originais. A implementação está no [PR #713](https://github.com/gustavomhss/Orchestra-SF/pull/713), destinado a `dev`.

## Escopo e autorização

O usuário pediu o mesmo trabalho das sessões anteriores, com atenção ao design e UX, e determinou: “eu trabalho acaba no merge.” A autorização abrange implementação, revisão e merge; não é registrada como inspeção pessoal de todas as capturas.

A base inicial foi `a5eee3584da531d087a419b8f3ef29d3881117c7`. O lote incorpora o PR #710 em `65349c1c723a8c626135d5b8032b929f5c635193` por resolução de arquivos e os três documentos exatos do PR #714 em `27f04c1cc723e42d5010b8f672a640b4792787ff`. O avanço visual #715 em `5b48dab52621037168ad4e3a6243c79a4fe5ad6e` foi incorporado preservando seus 23 blobs sem sobreposição e combinando a regra de espaçamento de Administração local. A [auditoria de composição](wave-six/DEV-COMPOSITION.md) registra as decisões.

A campanha tinha 41 áreas integradas. Este lote acrescenta 14 áreas de design, totalizando 55 após o merge. UI42–UI56 continuam na frente independente [#613](https://github.com/gustavomhss/Orchestra-SF/pull/613). Essa contagem inclui apresentações contextuais indisponíveis de UI64/UI66; não significa 55 capacidades operacionais habilitadas.

## Áreas e decisões

| Área | Tela | Melhoria | Limite preservado |
| --- | --- | --- | --- |
| UI57 | Histórico, recibo e revisão de importação | Recibo primeiro, diferenças originais e detalhes sob demanda. | Consultar o histórico não reaplica a importação. |
| UI58 | Documentos | Upload recolhível, busca e seleção autorizada claras. | Scanner, origem e CAS originais. |
| UI59 | Evidências | Candidatos compactos, valor e trecho original antes da confirmação. | Extração é candidata até confirmação humana; revogação invalida a fonte. |
| UI60 | Documento em cenário | Fonte confirmada, destino do Planner e prévia legível. | Prévia sem aplicar alterações; subtotal não comprova cobertura total. |
| UI61 | Sinais de memória | Condições independentes; materialidade e sinais com ações explícitas e cancelamento local. | Cancelar a espera nesta tela não comprova interrupção do produtor. |
| UI62 | Casos semelhantes | Caso atual, pergunta privada, candidatos e recusa específica da fonte. | Referências atuais e autorizadas; indisponibilidade não equivale a ausência de casos. |
| UI63 | Resultados / Outcomes | Escolha registrada independente de condição; referência opaca e cobertura explícita. | O caso exercitado tem cobertura incompleta; não comprova comparação numérica. |
| UI64 | Rotinas | Etapas progressivas na folha e apresentação contextual na entrada indisponível. | F01 do catálogo negado, folha ausente. Rota histórica de admissão preservada, sem fluxo positivo qualificado. |
| UI65 | Resultado da rotina | Orientação sem seleção e retorno no mesmo contexto. | Não há execução C07 nem resultado C08 positivo qualificado. |
| UI66 | Recorrência | Indisponibilidade específica e retorno a Rotinas, inclusive em tela estreita. | Port Schedule ausente; folha, CRUD e execução não habilitados. |
| UI67 | Contexto da instalação | Identidade de servidor, projeto, instalação e operador; atualização visível. | Identidade do proprietário real; reflow não representa auditoria de zoom. |
| UI68 | Exportações | Formato autorizado e uma ação principal de download. | XLSX verificado em bytes; demais formatos sem afirmação de download qualificado. |
| UI69 | Administração local | Resumos independentes, revisão antes de salvar e ações adaptadas a 320 px. | Notificações/backups continuam indisponíveis; cancelar revisão conserva o rascunho. |
| UI70 | Contribuições / residentes | Inventário, filtro e detalhes de perfis e skills. | Capacidade instalada não comprova carga, execução ou contribuição verificada. |

## Design e navegação

Tipografia, materiais, tokens e controles continuam sendo os do shell nativo. O breadcrumb identifica o capítulo e a página atual. O menu nativo de contexto e acesso preserva a seleção do proprietário. Rótulos acessíveis, disposição dos formulários e empilhamento das ações ajudam a usar as telas em larguras estreitas.

Recibo, diferenças, candidato e fonte aparecem antes de metadados técnicos. Seleção ainda não feita, resposta vazia, fonte indisponível e acesso negado conservam significados distintos. Os temas claro/escuro e textos EN/pt-BR são exercitados nos estados descritos nos relatórios; não se afirma o produto cartesiano de todas as rotas, temas, idiomas e falhas.

## Correções de funcionamento

- Os requests materializam referências e períodos em objetos simples antes do codec fechado. Símbolos privados do estado reativo não chegam à fronteira de wire; o schema não foi relaxado.
- O contrato original do catálogo de memória admite input ausente. O binding agora preserva `undefined` somente depois de o schema original admiti-lo. Outros valores continuam sujeitos ao JSON estrito.
- Condições recebidas não ficam ocultas por uma consulta de sinais ainda pendente. Materialidade e sinais começam por ações explícitas e têm cancelamento local com descrição precisa; o mesmo caso e suas condições permanecem visíveis.
- A recusa original `similarity-source-unavailable` mantém a pergunta e os candidatos autorizados; não produz lista vazia ou correspondência presumida. As precondições de publicação Atlas não são inferidas apenas da existência de uma escolha.
- O seletor de documentos pode oferecer outra origem autorizada após uma negativa da fonte inicial; continua bloqueado em envio e resultado desconhecido.
- A descoberta de rotinas não anuncia catálogo operacional quando não pode comprovar os pré-requisitos globais do planejamento original. A entrada contextual conserva F01 negado e zero folhas UI64. A rota histórica de admissão preserva sua autorização.
- Metadados comuns de memória são observados quatro vezes por chamada de disponibilidade, em vez de 20; o contexto original faz duas chamadas, passando de 40 para 8 leituras. As cinco operações mantêm admissões e finalizações independentes, duas observações coincidentes e ausência de cache entre chamadas. Essa é redução de chamadas verificada, não benchmark de latência.

Exportações, documentos e cenários usam wrappers, permissões, fontes e fences originais. A descoberta não exporta, simula, prepara rotina, confirma evidência nem cria condição. O fixture restrito de Operations conserva suas permissões. A prévia positiva UI60 usa uma instalação nativa separada, política original e ClamD real.

## Evidências

- [Validação e limites](wave-six/VALIDATION.md).
- [Importações, documentos, cenário e exportações](wave-six/records/VALIDATION.md).
- [Memória, contexto e administração](wave-six/memory/VALIDATION.md).
- [Rotinas, resultados, recorrência e contribuições](wave-six/routines/VALIDATION.md).
- [Galeria real](wave-six/evidence/README.md) e [procedência](wave-six/evidence/manifest.json).
- [Mapa exato](wave-six/scope.json).

Toda execução usa o Linux GitHub Actions e o workflow original `test-ci`, em snapshots descartáveis. Pedidos de CI e wrappers temporários não entram no produto. Guards e prazos originais permanecem; o `sf-ci` amplo não foi executado.

O [PR #713](https://github.com/gustavomhss/Orchestra-SF/pull/713) é a autoridade sobre o estado efetivo de integração e o SHA do merge.
