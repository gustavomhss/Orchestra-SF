# SF2H — missão 225: Suppliers CSV export (S1-R1-207-005/U14-AC01)

**Branch**: \`sf-supplier-csv\`; **epoch**: \`functional-export-e1-browser225\`.
**Autoridade**: S0-FENCE (predecessor NONE) + ACK commitado; modelo efetivo GPT-6, sessionID não exposto.
**Estado**: código de U14/tipos/client e drivers commitados. A adaptação F02/D01 é **INERTE**, guardada como cinco pós-imagens Git completas dentro da lease, para composição exclusiva de 211. Nenhuma prova foi executada; \`GLOBAL_RELEASE=false\`.

A concessão real para a exportação não é \`allowedActionIds\` de CAP27 nem presença em \`operation-registry\`. O produtor já atende somente \`GET {mount}/procurement?download=suppliers\`: \`runtime/application.ts\` autentica a pessoa e, após \`download\`, revalida papéis e digest do snapshot. \`runtime/downloads.ts\` gera bytes de \`suppliers.csv\` com as colunas, dados, permissões bancárias e regras originais. Nenhum endpoint, papel, política ou CSV de frontend foi criado.

O leaf U14 só habilita CSV quando a mesma autoridade CAP27 está presente, \`files/exports\` admite \`files.export.suppliers\` como \`ready/operational\`, e existe um consumidor nativo de bytes realmente instalado. Antes desse binding, ação falha fechada; não existe fallback de navegação, JSON falso ou sintetização privada. Em andamento, a tela aborta na troca de owner. O patch F02 pós-imagem faz uma nova leitura de \`ctx.context\` **após** receber bytes e compara installation, project, host, principal, policyVersion e accessRevision e destino/operationalidade atuais antes de retornar os bytes para a UI.

## CAS e entradas mecânicas para 211

Leia \`inert-211/delta-211.json\`. Para cada uma das cinco entradas, aplique a pós-imagem \`.txt\` somente se o blob atual corresponder ao \`before\` declarado, respeitando o HEAD atual de 211. Se divergir, reconcilie o conteúdo novo, registre SHA pre/post e não force overwrite. São arquivos fora da lease225 e nenhum foi editado na árvore real por 225. Especialmente \`u14.spec.ts\` contém asserção histórica que exigia CSV disabled; o pós-image preserva as demais verificações e exige export real.

## Verificações e responsabilidades

- **223**: somente dispatcher, usar \`request223.json\` após composição; teste de byte-identidade do download browser versus resposta original, negação com ator Microsoft distinto, resposta retida após saída do owner, 401/403/409, campos bancários e desktop D01 real. Não repetir entradas falhas sem correção.
- **207**: independente, usar \`recheck207.json\` para fechar S1-R1-207-005, distinguindo presença de fonte, admissão real, revogação antes de egress e objeto CSV salvo.
- **211**: consumir os fontes 224/225, os patches inertes, o resultado 223 e o recheck 207 sem editar plano imutável ou substituir produtores de outras missões.

**Checks da missão225**: \`NOT_RUN\` para local test, typecheck, build, validator, CI, desktop e revisão 207, por proibição expressa. Não há resultados positivos alegados. Integração e release continuam bloqueados até as provas reais.

**Entrada mínima não secreta faltante**: HEAD e blobs atuais da branch de composição 211 para reconciliar pós-imagens; fixture F04 já aprovada com contextos Microsoft requester/denied e download habilitado, selecionada por 223. Não enviar cookies, credenciais, tokens, bankKey nem dados CSV.
