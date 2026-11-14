# WP06 — mapa140 qualificado no W5 publicado

PR do grupo: https://github.com/gustavomhss/Orchestra-SF/pull/34. Produto `c4a2f4ebeb88f5915e51569b921be06b3c37ddad`, árvore `5cc00703f04845c62448a2a3239683d266d8d548`. A condição de publicação foi fechada por GitHub MCP. **Entrega de componente e reuso demonstrado; WP integral, provas humanas/nativas e aceite global não declarados.**

## Comparação e produtores

W4 `64432477` → pai documental `b9826431` → W5 `c4a2f4eb`. O compare completo contém36 paths: oito arquivos de código previstos,17 recibos de texto e11 PNG. Merge-base=W4, dois commits, sem truncamento ou paths adicionais. Os oito blobs foram lidos no W5 e conferidos byte a byte, incluindo H09 `a7183983` e driver owner `76188b9f`. Não há mudança de configuração Playwright ou descoberta genérica.

O refresh Collaboration PR33 `5ec1630993e4fa66684539db11af939b44ec8ecd` conserva exatamente dossier `ed88a6ff4f6c42eecfd80ba13824e8122fcc774e` e sourcing-evidence `2eb9ee92719402d137aca96c4861c086c6526971`. A identidade foi relida por MCP; não se infere merge amplo de Collaboration nem aceite de rotina/nativo/global.

## Execuções e reuso

| Prova | Resultado e tratamento |
|---|---|
| Corpus81 |31 históricos/137 passes+2 skips;26 W1/63 passes;1 W3/2 passes;22 W4/99 passes;1 Atlas pendente. São301 passes Bun de componente em80 arquivos, atribuídos às execuções originais. |
| Browser imports |14 passes W2, run43580401528, reutilizados no W5 por fechamento de renderer/script/CSP. |
| Browser Documents |8 passes W4, run43582881446, reutilizados no W5; HTTP sintético explicitado e PNG publicado. |
| Native import-analysis |2 passes W3, run43580976466, reutilizados no W5; mesmo orçamento/assertions e falha de timeout W1 preservada. Não equivale a GNATIVE global. |
| W5 host/browser |Run43584405211: **8 pass / 3 fail**,11 casos/3 arquivos. H01–H08 passaram; startup, H09 e lifecycle falharam. H09 não alcançou host porque a aquisição Chromium falhou. Aggregate FAIL mantido. |
| W5 typechecks/guards |Run43584394810: CLI e guards PASS; Sucafina/aggregate FAIL somente na fixture Atlas WP14, procurementEvidenceWrites ausente. |

H01 é agora prova direta do segundo consumidor `business.procurementDossier`: sourcing/FX/refs atuais, leitura sem mutação e interleavings reais de alteração/revogação. Os cinco casos reais de dossiê CLI W4 continuam uma prova distinta. H02/H03/H05/H06 confirmam o fluxo afetado pela restauração CAS; isso não altera o FAIL agregado do run que contém H09 bloqueado.

## Estrutura do mapa

O JSON consolidado preserva os140 IDs e textos exatos, todas as tasks, consumidores, proof bindings, notas históricas e obrigações. Há328 casos conhecidos deduplicados (325 originais+2 interleavings CLI+H01 direto) e326 registros de evidência atual:324 passes de componente e2 skips. Os registros atuais referenciam os testes e checks; nenhuma lista inteira é repetida por critério. Cada critério distingue evidência positiva, skip, histórico sem qualificação positiva e consumidor owner pendente.

A comparação publicada fecha a condição anteriormente pendente no parecer W4→W5. Os resultados continuam nos SHAs/run IDs em que foram observados; não existe um run único de326 casos nem um green global inferido.

## Pendências preservadas

Atlas exige reparo e prova do responsável. H09 exige aquisição real do browser e execução de seu corpo; não recebeu prova positiva pelo sucesso dos outros oito casos. AM-02/06/05/03, scanner instalado, modelos/provedores reais, GNATIVE, medidas humanas e epic do bundle final continuam com as exigências originais. Nenhum critério, política, alçada, scoring ou significado de estado foi reduzido.

Fonte imutável do plano: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; campaign SHA256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. S0 conserva revisão e integração final. Nenhum teste/typecheck/produto foi executado localmente ou repetido para produzir este adendo.

## Mapa integral dos140 critérios

Os textos abaixo são os aprovados. A contagem indica observações de componente ligadas ao critério; não indica que todas as condições desse critério foram aceitas. O JSON registra os IDs de casos/checks, consumidores, notas e ressalvas históricas. AMs e exigências globais permanecem mesmo quando há casos de componente passando.

| ID | Critério exato | Pass/skip ligados | Ressalvas adicionais |
|---|---|---:|---|
| WP06.DOD.01 | As famílias de import/export do baseline possuem catálogo de comportamento, prévia com manifesto e recibo, ou limitação original explicitamente preservada; cada fluxo aponta a prova discriminante. | 21/0 | Aceite integral não declarado |
| WP06.DOD.02 | A simulação usa o adapter puro de cada domínio e o mesmo comando da aplicação; o coordenador C04 e suas contribuições de UI estão publicados para montagem real pelo WP10. | 7/0 | Aceite integral não declarado |
| WP06.DOD.03 | O handoff entrega provas locais de parse/manifesto/recibo e uma suíte de conformidade para adapters e entrypoints reais; fixtures de contrato não são declaradas integração concluída. | 11/0 | Aceite integral não declarado |
| WP06.DOD.04 | Importações existentes e extração de PDF digital, DOCX e texto foram integradas; candidatos extraídos preservam fonte e exigem confirmação. | 10/0 | Aceite integral não declarado |
| WP06.DOD.10 | As entregas residentes atribuídas a WP06 têm produção, consumo e provas reais completos. | 42/0 | Aceite integral não declarado |
| WP06.DOD.40 | Imports e documentos saem de writers disjuntos e são consumidos reais; resolver 20 e extração 35 não esperam a task de roundtrip. | 3/0 | PARTIAL_HISTORICAL_CLAUSE |
| WP06.INV.01 | Preview e cancelamento não alteram dados, versões, sequências, auditoria ou arquivos persistidos; aplicação ocorre somente após ação explícita e rechecagem do contexto-base C04. | 7/0 | Aceite integral não declarado |
| WP06.INV.02 | Permissões, locks, IDs, branco/zero, sigilo salarial, remoções permitidas e regras financeiras pertencem ao domínio; o importador não as substitui nem as contorna. | 19/0 | Aceite integral não declarado |
| WP06.INV.03 | Backup JSON comum preserva configuração confiável e referências privadas existentes e não injeta novos anexos/localizadores; um arquivo não expande acesso ou autoridade. | 12/0 | Aceite integral não declarado |
| WP06.INV.10 | WP06 conserva autoridade, dados oficiais e ownership; não assume identidade técnica ou novo acesso empresarial. | 13/0 | Aceite integral não declarado |
| WP06.INV.40 | Arquivo/documento só tem um escritor; transferência 53 não modifica origem/ACL nem permite inventar evidência. | 6/0 | PARTIAL_HISTORICAL_CLAUSE |
| WP06.QLT.01 | A prévia explica por registro/campo o que muda, é incluído, será removido, permanece inalterado ou é ignorado, e separa impacto previsto de resultado aplicado. | 18/0 | Aceite integral não declarado |
| WP06.QLT.02 | O recibo nasce do resultado confirmado, identifica contexto e diferenças reais e não pode anunciar sucesso parcial oculto ou números apenas simulados. | 10/0 | Aceite integral não declarado |
| WP06.QLT.03 | Falhas de formato, autoridade e revisão têm tratamento distinto, mantêm arquivo/opções/entrada local quando apropriado e não expõem dados restritos. | 12/0 | Aceite integral não declarado |
| WP06.QLT.10 | Interfaces são concretas, versões/digests são verificáveis e falhas possuem causa e estado explícitos. | 14/0 | Aceite integral não declarado |
| WP06.QLT.40 | Handoff inclui revisão/trecho/hash e consumer real; recepção não equivale a prova final. | 9/0 | Aceite integral não declarado |
| WP06.CMP.01 | A cobertura inclui XLSX/XLS originais, abas e colunas suportadas, fórmulas com resultado zero, datas, IDs, export/import roundtrip, roster e JSON do Dashboard. | 19/0 | Aceite integral não declarado |
| WP06.CMP.02 | A cobertura inclui newVersion, removeMissing, referências desconhecidas, campos ignorados por lock/papel, permissões por owner, salário e conflito em qualquer registro afetado. | 16/0 | Aceite integral não declarado |
| WP06.CMP.03 | A cobertura inclui preview, Apply explícito, cancelamento, falha sem aplicação parcial, reprévia e recibo, com portas reais a compor pelo WP10. | 12/0 | Aceite integral não declarado |
| WP06.CMP.04 | Importações existentes e extração de PDF digital, DOCX e texto foram integradas; candidatos extraídos preservam fonte e exigem confirmação. | 10/0 | Aceite integral não declarado |
| WP06.CMP.10 | Todas as obrigações 5/18/8/C17 desta frente têm task, owner, paths, consumidor e negativos discriminantes. | 28/0 | Aceite integral não declarado |
| WP06.CMP.40 | Preservar todos os formatos de importação e PDFdigital/DOCX/texto, com casos negativos e consumidoresIA/Atlas/rotina. | 27/0 | Aceite integral não declarado |
| WP06.SUC.01 | Sem mudança do contexto-base, a aplicação real produz exatamente as mudanças e o impacto aprovados na prévia; divergência nunca é ocultada como sucesso. | 11/0 | Aceite integral não declarado |
| WP06.SUC.02 | No cenário financeiro de 590000, substituir uma previsão já incluída de 72000 por 84000 mostra e aplica 602000, sem somar o item duas vezes nem alterar budget/actual indevidos. | 3/0 | Aceite integral não declarado |
| WP06.SUC.03 | Exportar e reimportar o arquivo suportado sem edição não cria diferenças financeiras, novos registros por erro de identidade ou vazamento de campos privados. | 12/0 | Aceite integral não declarado |
| WP06.SUC.10 | O consumidor integrado utiliza a saída de produção sem substituto fictício e o revisor consegue reproduzir o resultado. | 29/0 | Aceite integral não declarado |
| WP06.SUC.40 | IA e Atlas recebem fonte documental verificável cedo enquanto imports continuam em paralelo. | 3/0 | PARTIAL_HISTORICAL_CLAUSE |
| WP06.T01.CHK.01 | Célula com resultado de fórmula 0 continua número 0, célula vazia continua ausente e data/ID numérico preservam a interpretação do baseline. | 4/0 | Aceite integral não declarado |
| WP06.T01.CHK.02 | All Members com Summary by Leader mantém somente o roster permitido; aba auxiliar não é convertida em pessoas ou valores financeiros. | 5/0 | Aceite integral não declarado |
| WP06.T01.CHK.03 | Arquivo inválido, com headers duplicados ou estrutura recusada pelos limites atuais retorna erro e nenhum conjunto parcial marcado como pronto para aplicar. | 6/0 | Aceite integral não declarado |
| WP06.T01.CHK.04 | JSON que altera roleMap/access/índices de instalação mantém os valores confiáveis atuais; JSON que introduz referência privada de contrato ou remove contrato com arquivo é recusado conforme a regra existente. | 12/0 | Aceite integral não declarado |
| WP06.T01.CHK.05 | Exportação por usuário sem salário mantém ausentes os campos privados, inclusive resultados calculados individuais e rate cards. | 3/0 | Aceite integral não declarado |
| WP06.T01.DOD.01 | O catálogo cobre todas as famílias de arquivo do inventário e descreve explicitamente campos aceitos, ignorados, rejeitados e exportados. | 17/0 | Aceite integral não declarado |
| WP06.T01.DOD.02 | Parse/export e preparação de JSON têm fixtures de paridade com resultados esperados para zero, ausência, IDs e anexos. | 16/0 | Aceite integral não declarado |
| WP06.T01.INV.01 | Ler um arquivo não grava domínio, configuração, anexos ou revisão; valores não são inferidos de nomes de abas desconhecidas. | 8/0 | Aceite integral não declarado |
| WP06.T01.INV.02 | Permissões e configuração de instalação não são importadas como autoridade de um backup de dados. | 6/0 | Aceite integral não declarado |
| WP06.T01.INV.03 | O parse preserva branco, zero, data, ID e resultado de fórmula segundo o baseline; não executa fórmulas externas. | 7/0 | Aceite integral não declarado |
| WP06.T01.QLT.01 | O resultado aponta a origem interna do valor ou da falha por aba/linha/campo sem exigir inspeção manual do arquivo inteiro. | 6/0 | Aceite integral não declarado |
| WP06.T01.QLT.02 | Arquivos ignorados ou campos não suportados são explicáveis sem prometer suporte universal. | 11/0 | Aceite integral não declarado |
| WP06.T01.CMP.01 | Planner, XLS legado, roster, operações, projetos e JSON do Dashboard têm caminho de parse e executor de domínio identificados. | 14/0 | Aceite integral não declarado |
| WP06.T01.CMP.02 | Exports existentes, privacidade, abas auxiliares, dados ignorados e rejeições de formato possuem casos positivos e negativos. | 18/0 | Aceite integral não declarado |
| WP06.T01.SUC.01 | O mesmo arquivo suportado produz os mesmos valores normalizados que o baseline, inclusive zero de fórmula e IDs legados. | 6/0 | Aceite integral não declarado |
| WP06.T01.SUC.02 | Um backup comum não consegue conceder papel, mover arquivo privado ou criar referência de anexo externa. | 12/0 | Aceite integral não declarado |
| WP06.T02.CHK.01 | Caso de aceitação do adapter financeiro: base outlook 590000 com item 72000, arquivo altera esse item para 84000; manifesto mostra uma substituição, delta +12000 e outlook 602000, não 674000. | 2/0 | Aceite integral não declarado |
| WP06.T02.CHK.02 | Em versão bloqueada, budget/estrutura impedidos aparecem como não aplicados e o forecast autorizado mantém seu efeito; a prévia não sinaliza o arquivo inteiro como salvo. | 2/0 | Aceite integral não declarado |
| WP06.T02.CHK.03 | removeMissing lista exatamente os registros removíveis das abas fornecidas; projetos órfãos e abas não fornecidas não são apagados pela simulação. | 2/0 | Aceite integral não declarado |
| WP06.T02.CHK.04 | Owner desconhecido produz aviso e manutenção do campo conforme o domínio; usuário sem acesso não recebe salário em antes/depois, totais individuais, avisos ou erros. | 7/0 | Aceite integral não declarado |
| WP06.T02.CHK.05 | Simular duas vezes com o mesmo contexto determinístico mantém o snapshot original intacto e o mesmo manifesto; adapter ausente não retorna prévia fictícia de sucesso. | 5/0 | Aceite integral não declarado |
| WP06.T02.CHK.18 | Executar sf_import_preview pela UI/native/MCP com base e autoridade iguais produz o mesmo handler, resultado e versão; chamada direta sem concessão ou após revogação é recusada pelo destino. | 4/0 | Aceite integral não declarado |
| WP06.T02.CHK.60 | sf_import_preview produz o mesmo ImportManifest C04 para sf-enquadrar-decisao/sf-explicar-forecast; preview não grava domínio e invalida com base/arquivo alterados. Registrar entrada, binding/skill, saída, efeito de domínio e consumidor no mesmo candidato. | 22/0 | Aceite integral não declarado |
| WP06.T02.DOD.01 | A prévia apresenta manifesto e impacto fornecidos pelo adapter puro, com contexto-base e restrições claramente identificados. | 11/0 | Aceite integral não declarado |
| WP06.T02.DOD.02 | Existem casos de conformidade por domínio e a ausência de adapter real é um estado indisponível, não uma entrega simulada. | 6/0 | Aceite integral não declarado |
| WP06.T02.DOD.18 | Descritores C16 de sf_import_preview são implementados e consumidos por T06 com referências reais. | 3/0 | Aceite integral não declarado |
| WP06.T02.DOD.60 | A alteração descrita é integrada aos produtores/consumidores reais e provada por AM02/AM06 conforme o domínio. sf_import_preview produz o mesmo ImportManifest C04 para sf-enquadrar-decisao/sf-explicar-forecast; preview não grava domínio e invalida com base/arquivo alterados. | 22/0 | PARTIAL_EXPLICIT_AM_CLAUSE |
| WP06.T02.INV.01 | Simular e aplicar usam o mesmo comando e regras do domínio; não existe caminho financeiro separado dentro do WP06. | 10/0 | Aceite integral não declarado |
| WP06.T02.INV.02 | O snapshot original, sequências e auditoria permanecem intactos durante preview. | 8/0 | Aceite integral não declarado |
| WP06.T02.INV.03 | A redação por papel ocorre antes da exibição de diffs e impacto; erro de permissão não devolve o valor restrito. | 6/0 | Aceite integral não declarado |
| WP06.T02.INV.18 | Permissões, locks, cálculos e comandos finais continuam no domínio; o transporte não cria poder novo. | 7/0 | Aceite integral não declarado |
| WP06.T02.INV.60 | Identidade, perfil, skill carregada, concessão e autorização atual continuam obrigatórios; prévia não aplica e rotina não inventa admissão. sf_import_preview produz o mesmo ImportManifest C04 para sf-enquadrar-decisao/sf-explicar-forecast; preview não grava domínio e invalida com base/arquivo alterados. | 23/0 | Aceite integral não declarado |
| WP06.T02.QLT.01 | Toda mudança pode ser aberta até registro/campo e diferenciada de uma informação ignorada ou mantida. | 10/0 | Aceite integral não declarado |
| WP06.T02.QLT.02 | Impacto previsto é rotulado como previsão da aplicação e reconcilia com componentes autorizados de C02. | 3/0 | Aceite integral não declarado |
| WP06.T02.QLT.18 | Schema fechado, ausência/falha explícitas e provenance permitem comparar UI/native/MCP. | 3/0 | Aceite integral não declarado |
| WP06.T02.QLT.60 | Grant, entrada, saída e estado visível concordam entre manifesto, wrapper e UI; falha tem motivo verificável. sf_import_preview produz o mesmo ImportManifest C04 para sf-enquadrar-decisao/sf-explicar-forecast; preview não grava domínio e invalida com base/arquivo alterados. | 22/0 | Aceite integral não declarado |
| WP06.T02.CMP.01 | Manifesto cobre criação, edição, exclusão, ausência de alteração, referências desconhecidas e recusa por campo/papel. | 19/0 | Aceite integral não declarado |
| WP06.T02.CMP.02 | newVersion, removeMissing, lock, HR sintético, salário e revisões afetadas são representados sem alterar a semântica do comando. | 15/0 | Aceite integral não declarado |
| WP06.T02.CMP.18 | Cobrir todos os exports desta task (1), caso autorizado, direto proibido, stale e indisponível. | 5/0 | Aceite integral não declarado |
| WP06.T02.CMP.60 | Cobrir caminho autorizado, falta de SkillLoadReceipt, permissão revogada e os estados de preview/admissão pertinentes à task. sf_import_preview produz o mesmo ImportManifest C04 para sf-enquadrar-decisao/sf-explicar-forecast; preview não grava domínio e invalida com base/arquivo alterados. | 23/0 | Aceite integral não declarado |
| WP06.T02.SUC.01 | O usuário consegue identificar antes de Apply quais números mudarão e quais dados do arquivo permanecerão sem aplicação. | 9/0 | Aceite integral não declarado |
| WP06.T02.SUC.02 | O consumidor não calcula dinheiro por conta própria e o manifesto expõe diferença relevante sem vazamento de campos privados. | 3/0 | Aceite integral não declarado |
| WP06.T02.SUC.18 | O usuário recebe a mesma capacidade e resultado pelas superfícies sem divergência ou efeitos adicionais. | 3/0 | Aceite integral não declarado |
| WP06.T02.SUC.60 | A pessoa consegue utilizar a contribuição prevista e abrir seu resultado real; uma ferramenta sempre recusada não conta como entregue. sf_import_preview produz o mesmo ImportManifest C04 para sf-enquadrar-decisao/sf-explicar-forecast; preview não grava domínio e invalida com base/arquivo alterados. | 22/0 | Aceite integral não declarado |
| WP06.T03.CHK.01 | Cancelar após preview não muda dados, revisões, sequências, auditoria nem recibos de sucesso. | 2/0 | Aceite integral não declarado |
| WP06.T03.CHK.02 | Alterar a revisão de uma linha afetada ou bloquear a versão entre preview e Apply recusa a aplicação e preserva o arquivo/opções; nova prévia mostra o estado atual. | 9/0 | Aceite integral não declarado |
| WP06.T03.CHK.03 | Falha de validação em registro posterior não deixa alterações anteriores parcialmente aplicadas; recibo de sucesso não é criado. | 2/0 | Aceite integral não declarado |
| WP06.T03.CHK.04 | Sem alteração relevante de contexto, os registros e deltas confirmados correspondem ao manifesto aprovado, respeitando a convenção C04 de IDs para inclusões. | 9/0 | Aceite integral não declarado |
| WP06.T03.CHK.05 | Uma edição independente feita por outra pessoa permanece após a aplicação autorizada; o importador não substitui o snapshot inteiro por uma cópia antiga. | 2/0 | Aceite integral não declarado |
| WP06.T03.CHK.06 | O recibo distingue 'sem alterações', 'recusado' e 'aplicado' e conta somente mudanças efetivas, não quantidade de linhas lidas no Excel. | 10/0 | Aceite integral não declarado |
| WP06.T03.CHK.60 | Consumir importPreviewRef da análise IA opcional na prévia existente; manter erros/deltas e rótulo de simulação, sem apply automático ou caso obrigatório para importação determinística. Registrar entrada, binding/skill, saída, efeito de domínio e consumidor no mesmo candidato. | 22/0 | Aceite integral não declarado |
| WP06.T03.DOD.01 | Apply, cancelamento, conflito/reprévia e recibo estão publicados como contribuição e coordenador C04 com porta C08 explícita. | 9/0 | Aceite integral não declarado |
| WP06.T03.DOD.02 | Os resultados positivos e negativos possuem provas locais de estados e um roteiro executável contra a composição real do WP10. | 9/0 | Aceite integral não declarado |
| WP06.T03.DOD.60 | A alteração descrita é integrada aos produtores/consumidores reais e provada por AM02/AM06 conforme o domínio. Consumir importPreviewRef da análise IA opcional na prévia existente; manter erros/deltas e rótulo de simulação, sem apply automático ou caso obrigatório para importação determinística. | 22/0 | PARTIAL_EXPLICIT_AM_CLAUSE |
| WP06.T03.INV.01 | Nenhum preview é aplicado implicitamente e nenhuma recusa é convertida em sucesso parcial. | 5/0 | Aceite integral não declarado |
| WP06.T03.INV.02 | A autoridade e as revisões são verificadas no momento de aplicar; o manifesto não funciona como autorização permanente. | 6/0 | Aceite integral não declarado |
| WP06.T03.INV.03 | Recibo descreve resultado confirmado e preserva os campos restritos, inclusive quando a aplicação falha. | 5/0 | Aceite integral não declarado |
| WP06.T03.INV.04 | Atomicidade vale para a aplicação dentro da superfície/import suportado; nunca declarar atomicidade global entre domínios. Metadados de confiança não são aceitos do JSON de entrada. | 11/0 | Aceite integral não declarado |
| WP06.T03.INV.60 | Identidade, perfil, skill carregada, concessão e autorização atual continuam obrigatórios; prévia não aplica e rotina não inventa admissão. Consumir importPreviewRef da análise IA opcional na prévia existente; manter erros/deltas e rótulo de simulação, sem apply automático ou caso obrigatório para importação determinística. | 23/0 | Aceite integral não declarado |
| WP06.T03.QLT.01 | A pessoa entende por que precisa de nova prévia e não perde sua seleção/arquivo em um conflito recuperável. | 1/0 | Aceite integral não declarado |
| WP06.T03.QLT.02 | Contexto e estado do recibo são inequívocos; números previstos e aplicados nunca aparecem com o mesmo rótulo. | 7/0 | Aceite integral não declarado |
| WP06.T03.QLT.60 | Grant, entrada, saída e estado visível concordam entre manifesto, wrapper e UI; falha tem motivo verificável. Consumir importPreviewRef da análise IA opcional na prévia existente; manter erros/deltas e rótulo de simulação, sem apply automático ou caso obrigatório para importação determinística. | 22/0 | Aceite integral não declarado |
| WP06.T03.CMP.01 | Aplicação na versão atual/nova, cancelamento, ausência de mudanças, erro de validação, conflito e alteração de autoridade têm fluxos completos. | 9/0 | Aceite integral não declarado |
| WP06.T03.CMP.02 | Inclusões, exclusões, campos ignorados e referências mantidas são contabilizados no recibo segundo o resultado real. | 11/0 | Aceite integral não declarado |
| WP06.T03.CMP.60 | Cobrir caminho autorizado, falta de SkillLoadReceipt, permissão revogada e os estados de preview/admissão pertinentes à task. Consumir importPreviewRef da análise IA opcional na prévia existente; manter erros/deltas e rótulo de simulação, sem apply automático ou caso obrigatório para importação determinística. | 23/0 | Aceite integral não declarado |
| WP06.T03.SUC.01 | Nenhuma alteração concorrente alheia é perdida ao importar, e um conflito afetado pode ser revisado sem reconstruir a operação do zero. | 3/0 | Aceite integral não declarado |
| WP06.T03.SUC.02 | Após sucesso, o usuário reconcilia o recibo com os valores exibidos pelo domínio; após falha, não encontra efeitos parciais ocultos. | 13/0 | Aceite integral não declarado |
| WP06.T03.SUC.60 | A pessoa consegue utilizar a contribuição prevista e abrir seu resultado real; uma ferramenta sempre recusada não conta como entregue. Consumir importPreviewRef da análise IA opcional na prévia existente; manter erros/deltas e rótulo de simulação, sem apply automático ou caso obrigatório para importação determinística. | 22/0 | Aceite integral não declarado |
| WP06.T04.CHK.01 | Exportar e reimportar sem editar mantém valores financeiros e identidades sem novos registros; flags bm ausentes do formato seguem a normalização original do importador, explicitada sem exigir preservação bit a bit que o arquivo não suporta. | 3/0 | Aceite integral não declarado |
| WP06.T04.CHK.02 | Alterar somente um Forecast mensal no arquivo modifica apenas os campos autorizados correspondentes; a contribuição já incluída é substituída e não duplicada. | 3/0 | Aceite integral não declarado |
| WP06.T04.CHK.03 | All Members importa apenas os campos de roster aceitos, ignora Summary by Leader e não transporta Classification/Outlook/Notes ou remuneração; lock preserva posições conforme baseline. | 5/0 | Aceite integral não declarado |
| WP06.T04.CHK.04 | Arquivo de owner com forecast autorizado e forecast alheio proibido é rejeitado atomicamente quando a regra original assim exige; não se publica recibo de sucesso parcial. | 4/0 | Aceite integral não declarado |
| WP06.T04.CHK.05 | Matriz cruza formatos e papéis com cancelamento, conflito, arquivo inválido e sucesso; cada célula aponta comportamento verificável, sem alegação genérica de testes verdes. | 13/0 | Aceite integral não declarado |
| WP06.T04.CHK.06 | No WP10, o roteiro usa adapter de domínio e entrypoint reais para confirmar o impacto/recibo; antes disso, essa prova permanece identificada como não executada, sem bloquear o início paralelo do WP06. | 8/0 | Aceite integral não declarado |
| WP06.T04.DOD.01 | Roundtrip, alteração mínima e recusas possuem fixtures e resultados esperados por formato/papel. | 11/0 | Aceite integral não declarado |
| WP06.T04.DOD.02 | Handoff contém exports C04, composição C08 e pacote de aceitação real, com status honesto de evidência local e integrada. | 3/0 | Aceite integral não declarado |
| WP06.T04.INV.01 | Nenhum roundtrip cria despesa, identidade, permissão ou referência privada apenas por exportar/importar. | 15/0 | Aceite integral não declarado |
| WP06.T04.INV.02 | Dados calculados e restritos continuam sujeitos às regras do domínio em todos os formatos, inclusive XLS legado. | 11/0 | Aceite integral não declarado |
| WP06.T04.INV.03 | Uma fixture de contrato pode provar conformidade local, mas nunca substitui adapter/entrypoint real como evidência de entrega integrada. | 7/0 | Aceite integral não declarado |
| WP06.T04.QLT.01 | Cada prova demonstra uma diferença que detectaria uma regressão concreta, como zero virando vazio, forecast duplicado ou posição indevidamente removida. | 10/0 | Aceite integral não declarado |
| WP06.T04.QLT.02 | O material de handoff permite reproduzir falha/sucesso sem depender da memória da conversa ou de acesso externo novo. | 0/0 | Aceite integral não declarado |
| WP06.T04.CMP.01 | Todos os formatos, opções newVersion/removeMissing, referências, papéis e dados privados do inventário têm cobertura identificada. | 28/0 | Aceite integral não declarado |
| WP06.T04.CMP.02 | Preview, Apply, cancelamento, erro, reprévia e recibo são exercitados como jornada, além de verificações isoladas de parse. | 16/0 | Aceite integral não declarado |
| WP06.T04.CMP.03 | Roundtrip cobre preservação/exclusão de metadados conforme contrato, invalidação por substituição e reuso de ID com nova encarnação. | 15/0 | Aceite integral não declarado |
| WP06.T04.SUC.01 | Um arquivo exportado do produto pode voltar sem produzir alteração financeira inesperada, e uma edição intencional gera somente seu efeito declarado. | 6/0 | Aceite integral não declarado |
| WP06.T04.SUC.02 | WP10 consegue qualificar a cadeia real usando o pacote entregue, sem duplicar cálculo, alterar arquivos do WP03 ou inventar novas rotas de importação. | 4/0 | Aceite integral não declarado |
| WP06.T05.CHK.01 | Proposta com texto ignore regras permanece dado e não provoca tool call indevida. | 7/0 | Aceite integral não declarado |
| WP06.T05.CHK.02 | Campo confirmado mantém trecho/arquivo/versão; documento atualizado torna candidato antigo identificável. | 13/0 | Aceite integral não declarado |
| WP06.T05.CHK.03 | PDF sem camada textual é sinalizado; nenhuma cotação é inferida para preencher a lacuna. | 2/0 | Aceite integral não declarado |
| WP06.T05.CHK.20 | Dossiê WP09.T04 consome a mesma evidenceRef após confirmação na UI; antes disso mostra candidato pendente. Atualização de documento/revogação alcança o consumidor sem parser, confirmação ou cópia paralelos. | 23/0 | Aceite integral não declarado |
| WP06.T05.CHK.18 | Executar sf_document_extract, sf_knowledge_search pela UI/native/MCP com base e autoridade iguais produz o mesmo handler, resultado e versão; chamada direta sem concessão ou após revogação é recusada pelo destino. | 6/0 | Aceite integral não declarado |
| WP06.T05.CHK.19 | Documento autorizado é extraído e consultado pelos exports reais RAG Studio, citationProof/trecho conferem com revisão/offsets; DOCX não é lido como UTF-8 bruto e trocar SHA-256 por BLAKE3 não passa a validação. | 13/0 | Aceite integral não declarado |
| WP06.T05.CHK.40 | DOC-REF T+20 é consumido por createSfBusinessContext e DOC-EXTRACT T+35 por T02; imports T01-T04 executam em outro writer. | 3/0 | PARTIAL_HISTORICAL_CLAUSE |
| WP06.T05.DOD.01 | PDF digital, DOCX e texto reais produzem candidatos verificáveis e confirmáveis na mesa; formato sem texto não gera dados fabricados. | 10/0 | Aceite integral não declarado |
| WP06.T05.DOD.18 | Descritores C16 de sf_document_extract, sf_knowledge_search são implementados e consumidos por T06 com referências reais. | 6/0 | Aceite integral não declarado |
| WP06.T05.DOD.19 | Resolver e adapter RAG reais produzem candidatos e trechos consumidos pela UI e BCS. | 10/0 | Aceite integral não declarado |
| WP06.T05.DOD.40 | Resolver e extração real têm entregas 20/35 e consumidores identificados. | 3/0 | PARTIAL_HISTORICAL_CLAUSE |
| WP06.T05.INV.01 | Documento externo é evidência não confiável; instrução embutida não muda ferramentas, acesso ou autoridade, e extração não vira fato confirmado automaticamente. | 7/0 | Aceite integral não declarado |
| WP06.T05.INV.18 | Permissões, locks, cálculos e comandos finais continuam no domínio; o transporte não cria poder novo. | 12/0 | Aceite integral não declarado |
| WP06.T05.INV.19 | Conteúdo externo não vira instrução, Store da request não amplia ACL e algoritmo de digest não é substituído. | 11/0 | Aceite integral não declarado |
| WP06.T05.INV.40 | S2 e S2-C jamais escrevem os mesmos arquivos documentais antes lease 53. | 0/0 | PARTIAL_HISTORICAL_CLAUSE |
| WP06.T05.QLT.01 | Origem é navegável até página/trecho ou parágrafo; valor ambíguo conserva opções/ausência sem falsa certeza. | 5/0 | Aceite integral não declarado |
| WP06.T05.QLT.18 | Schema fechado, ausência/falha explícitas e provenance permitem comparar UI/native/MCP. | 9/0 | Aceite integral não declarado |
| WP06.T05.QLT.19 | Revisão, source hash, unidade de offset e estado candidato/confirmado tornam a evidência recuperável. | 8/0 | Aceite integral não declarado |
| WP06.T05.QLT.40 | Handoff mantém referência/hash/revisão/ACL e status de confirmação. | 9/0 | Aceite integral não declarado |
| WP06.T05.CMP.01 | Cobrir três formatos, número/moeda/data ambíguos, conteúdo grande, texto ausente, arquivo inválido, revogação e mudança de versão. | 14/0 | Aceite integral não declarado |
| WP06.T05.CMP.18 | Cobrir todos os exports desta task (2), caso autorizado, direto proibido, stale e indisponível. | 6/0 | Aceite integral não declarado |
| WP06.T05.CMP.19 | Cobrir PDF digital, DOCX, texto, sem camada textual, fonte revogada, revisão trocada, busca lexical e digests diferentes. | 15/0 | Aceite integral não declarado |
| WP06.T05.CMP.40 | Três formatos, falhas, versão/revogação e imports paralelos permanecem cobertos. | 14/0 | PARTIAL_HISTORICAL_CLAUSE |
| WP06.T05.SUC.01 | Comprador confirma um valor extraído e o usa no cenário sem copiar novamente, preservando a origem. | 21/0 | Aceite integral não declarado |
| WP06.T05.SUC.18 | O usuário recebe a mesma capacidade e resultado pelas superfícies sem divergência ou efeitos adicionais. | 6/0 | Aceite integral não declarado |
| WP06.T05.SUC.19 | Usuário abre o trecho que sustentou a extração e fonte alterada não se passa pela versão confirmada. | 11/0 | Aceite integral não declarado |
| WP06.T05.SUC.40 | Fontes alimentam IA/Atlas antes da integração final sem bloquear importação. | 3/0 | Aceite integral não declarado |
