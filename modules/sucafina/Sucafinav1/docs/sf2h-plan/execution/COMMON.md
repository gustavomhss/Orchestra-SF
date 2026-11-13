# Orchestra SF — regras comuns de execução

Leia este documento uma vez e o pacote JSON do ator atribuído. Os pacotes são seleções exatas do canônico; não é necessário ler também todos os seus espelhos. Expanda fontes/dependências sempre que necessário para implementar ou julgar corretamente.

Fonte SHA256: `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. Compilador: `1.0.1`. Plano e código são SHAs distintos; fixe ambos no lançamento.

## Missão

Entregar integralmente o produto Orchestra SF: 28 capacidades existentes, 41 requisitos originais, 18 capacidades de IA, BI, imports, reuniões, exportações, colaboração, rotinas, casos de decisão, portfólio, documentos e memória. Inclui cinco perfis residentes, dezoito skills, um MCP Sucafina com oito packs e 39 operações, além do Atlas SF Business Profile v1. Janela alvo de 120 minutos, com paralelização explícita e sem retirar escopo ou substituir capacidades por demonstrações.

André e o time expressam intenção, investigam evidências, comparam consequências, esclarecem o que falta, registram escolhas, executam pelos fluxos existentes e reavaliam mudanças relevantes sem reconstruir contexto.

## Escopo e semântica

```json
{
  "scope": {
    "included": [
      "Dashboard e as suas 16 capacidades; Budget Planner e as suas 7 capacidades; Procurement e as suas 5 capacidades.",
      "Navegação, busca, visões salvas, entrada por responsabilidade, Meu trabalho, leitura/edição/decisão e recuperação de contexto.",
      "Manutenção contextual, dados e premissas explicáveis, cenários, prévia de importação com impacto, colaboração e relações explícitas.",
      "Oito gráficos contextuais, revisões preservadas, material de reunião e exportações completas.",
      "Quatro rotinas de preparação com Relay, assistência contextual sobre diferenças e recorrência interna pelo caminho nativo permitido.",
      "Composição no módulo real, compatibilidade com estado anterior, concorrência, permissões e revisão independente.",
      "Casos persistentes, alternativas estruturadas, critérios, premissas, escolhas humanas e propostas aplicáveis por domínio com recibos e recuperação parcial.",
      "IA real pelo host autorizado: intenção, descoberta de contradição com fontes, alternativas, crítica, perguntas relevantes e reformulação após resposta; cancelamento e resultado desatualizado explícitos.",
      "Cenários de portfólio com operações suportadas e restrições explícitas; comparação e sensibilidade reproduzíveis.",
      "Extração de PDF digital, DOCX e texto com referência a página/trecho/campo e confirmação; documentos escaneados sem texto são recusados como não suportados, sem alegar OCR.",
      "Reavaliação por referência/campo/período, recuperação autorizada de decisões semelhantes e previsto versus observado sem atribuição causal inventada.",
      "Hoje e mesa de decisão acessíveis a partir de contrato/pedido/projeto; edição operacional direta continua disponível.",
      "Integração de produto no composition root do host para fornecer identidade, projeto, sessão e serviços de IA/Relay já autorizados; não envolve Azure ou credenciais novas.",
      "Equipe residente com cinco perfis, dezoito skills distribuídas e carregadas pelo runtime nativo, MCP sucafina-workbench com oito packs/39 operações, memória Atlas empresarial durável e seis provas integradas AM01–AM06."
    ],
    "excluded": [
      "Azure, hospedagem, deploy, identidade corporativa e infraestrutura já conduzidos por outra frente.",
      "Novos acessos SAP, Fabric, diretórios externos ou integrações como condição para produzir valor.",
      "Mudanças de alçada, política de compras, autoridade de aprovação ou política financeira sem uma decisão explícita sobre uma divergência concreta.",
      "Mensagens para terceiros, envio de relatórios, e-mails, Slack ou Teams. Preparar conteúdo dentro do produto não autoriza enviá-lo.",
      "Novo ERP, editor genérico de BI, novo sistema de tarefas ou chat obrigatório para executar o trabalho normal.",
      "Mudanças nos engines do Maestro, Relay e Schedule; o produto deve consumir capacidades atuais e mostrar seus limites."
    ]
  },
  "axiom_semantics": {
    "dod": "Condição para declarar a unidade concluída: entrega, integração quando aplicável, revisão e prova válida.",
    "invariants": "Propriedades que precisam continuar verdadeiras durante e depois da mudança. Uma violação bloqueia a entrega.",
    "quality_standards": "Padrão de execução e de experiência, verificável na implementação e nas evidências.",
    "completeness_criteria": "Inventário mínimo de escopo, variações e estados que precisa estar coberto; impede fechar só o caminho feliz.",
    "success_criteria": "Resultado observável para a pessoa ou para o consumidor da entrega; não é uma lista de arquivos criados.",
    "inheritance": "Todo executor aplica os invariantes e padrões da campanha e do seu WP, mais os critérios locais da task. DoD/completude/sucesso são avaliados no alcance de cada unidade: a campanha agrega os WPs, e os WPs agregam as tasks. Isso não cria uma dependência circular em que uma task teria de esperar a campanha inteira para existir.",
    "non_waiver": "Conflito entre um critério local e um superior exige correção explícita do plano. Não vale declarar 'não se aplica' para remover capacidade aceita, alterar autoridade ou encerrar um achado obrigatório.",
    "evidence_economy": "Os cinco grupos existem em cada nível. Axioma não equivale a um novo teste: cada pacote de prova referencia vários critérios e registra entradas, ação, esperado, observado e versão. Nenhum PASS por contagem de arquivos, compilação isolada ou autodeclaração."
  },
  "semantic_decisions": [
    {
      "id": "SD01",
      "topic": "Utilização do orçamento e sinal acima de110%",
      "task": "WP02.T01",
      "decision": "Calcular razão real para rótulo/sinal; limitar somente a geometria da barra se necessário. O clamp visual não pode impedir o estado de excesso.",
      "proof": "Budget100, valor120 → razão120%, barra eventualmente limitada e sinal de excesso correto; budgetzero/ausente tem estado explícito.",
      "source": "S05"
    },
    {
      "id": "SD02",
      "topic": "Trajetória mensal do budget Dashboard",
      "task": "WP02.T01",
      "decision": "Expor série efetiva com overrides e identificar separadamente qualquer referência plana anual/12. Não apresentar a curva plana legada como distribuição efetiva.",
      "proof": "Anual1200 com janeiro200 → total efetivo1300; a série reconcilia com a referência declarada.",
      "source": "S05"
    },
    {
      "id": "SD03",
      "topic": "Backlog versus fluxo de tickets",
      "task": "WP02.T01",
      "decision": "Abertos menos fechados é variação líquida; backlog exige saldo inicial mais entradas menos saídas. Publicar o conceito comprovado pelo dado e tornar ausência de saldo explícita.",
      "proof": "Saldo inicial20, abertos10, fechados15 → backlog15 e variação−5; sem saldo não afirmar backlog0.",
      "source": "S07"
    },
    {
      "id": "SD04",
      "topic": "Competências distintas do executivo",
      "task": "WP02.T03",
      "decision": "Declarar a referência de cada bloco; só C05 produz uma revisão capturada e preservada. Não dar aparência histórica única ao estado corrente misto.",
      "proof": "Orçamento anual, people corrente e operação de outro mês mantêm suas referências.",
      "source": "S02"
    },
    {
      "id": "SD05",
      "topic": "Null, zero, forecast herdado e câmbio ausente",
      "task": "WP03.T01",
      "decision": "Conservar a regra financeira existente, mas manter a proveniência de ausência. Null herdado não é entrada zero; valor não convertido continua visível como não precificado.",
      "proof": "Cenários de null/zero/herança e moeda sem taxa produzem valores e avisos distintos sem criar taxa.",
      "source": "S10"
    },
    {
      "id": "SD06",
      "topic": "PO em moedas diferentes",
      "task": "WP04.T03",
      "decision": "Comparações/totais apresentados usam moeda base e snapshot declarado. Base de alçada não é reinterpretada silenciosamente; qualquer divergência de autoridade é registrada e preservada até decisão explícita compatível com escopo.",
      "proof": "28000EUR a1.08 →30240USD; mudança deFX corrente não muda snapshot submetido; falta deFX não vira zero.",
      "source": "S12"
    },
    {
      "id": "SD07",
      "topic": "Aprovado, emitido internamente e realizado",
      "task": "WP04.T03",
      "decision": "Separar estados e rótulos. po_issued significa emissão interna; nenhuma métrica vira gasto realizado ou entrega ao fornecedor sem evidência.",
      "proof": "POapproved e POissued aparecem em conjuntos distintos e denominadores declarados.",
      "source": "S11"
    },
    {
      "id": "SD08",
      "topic": "Cobertura de exportação",
      "task": "WP07.T04",
      "decision": "Paginar registros selecionados em PPTX/DOCX; se houver resumo, declarar cobertura e manter material completo acessível. Não cortar silenciosamente em12linhas.",
      "proof": "25projetos identificáveis e notas longas exportados uma vez sem clipping.",
      "source": "S15"
    },
    {
      "id": "SD09",
      "topic": "Confirmação humana por escopo material",
      "task": "WP08.T03",
      "decision": "C06 conserva observedSourceVersion/auditoria e avalia fingerprint de referência/incarnation, campos, período e dependências materiais. Nova versão global não é regra de invalidação; consumidores usam a projeção valid/stale/unavailable.",
      "proof": "CONFIRM-SCOPE janeiro v7→fevereiro v8 preserva valid e zero cobrança; janeiro/dependência muda→stale; revogação→unavailable; ID reutilizado não herda confirmação.",
      "source": "S20"
    },
    {
      "id": "SD10",
      "topic": "Cobertura de custo antes de comparação completa",
      "task": "WP11.T02",
      "decision": "C10 exige inventário versionado e avaliação por categoria; entrada ausente deriva missing-category/pending. Somente cobertura e quantificação resolvidas permitem comparação completa; valores desconhecidos não viram zero e as ressalvas são preservadas na escolha.",
      "proof": "AI-RENEWAL-OMITTED-CATEGORY: subtotal 210000/knownDifference30000 condicionados; training = 40000 confirmado→total 250000/diferença -10000/teto 15000. Mesma projeção em UI/BI/crítica/portfólio.",
      "source": "S20"
    },
    {
      "id": "SD11",
      "topic": "Extração documental tem produtor único nesta campanha",
      "task": "WP09.T04",
      "decision": "WP06.T05 implementa extração obrigatória de PDF digital, DOCX e texto. WP09.T04 só consome C14/C02/C07 e conserva candidato versus confirmado; nenhuma exclusão global da campanha nem parser paralelo.",
      "proof": "E15/E13 demonstram extração→candidato→confirmação→dossiê pela mesma evidenceRef, com atualização/revogação e ausência de texto.",
      "source": "S20"
    }
  ]
}
```

## Regras universais

```json
{
  "ordering": "WP00/WP10 iniciam em T0. WP00.T02 libera construção determinística em T+10. Runtime/MCP(T06), Atlas(T07), documentos(T05/WP06), conteúdo de skills e domínios avançam em fronteiras distintas. Qualificação T+20 consome incrementos identificados, não conclusão fictícia de tasks que terminam depois.",
  "dependency_meaning": "depends_on exige contrato ou saída local pronta. integrates_with define produtores reais necessários para concluir, sem bloquear a construção inicial quando fixtures de contrato permitem avançar. Fixture nunca fecha aceite.",
  "statuses": [
    "PLANNED",
    "IN_PROGRESS",
    "BLOCKED",
    "READY_FOR_INTEGRATION",
    "VERIFIED",
    "DONE"
  ],
  "concurrency": "Preset S0 supervisora + N=4 sessões S1–S4, até quatro slots por sessão incluindo coordenadora, somente após confirmação de pools independentes e limite global real. São até vinte atores, nunca vinte builders. A árvore collaboration atual tem quatro slots globais e não satisfaz esse preset por aninhamento. N diferente exige nova alocação completa e validação antes da admissão.",
  "integration_cadence": "Integração por output pronto dentro da alocação de S0. AI-NATIVE13, NATIVE-CASE14, NATIVE-PLANNER15 e NATIVE-RUNTIME16 são recebidos e compostos entre16 e18, antes de GNATIVE. T25/40/55/75 são checkpoints cumulativos, nunca barreiras para integrar incrementos consumíveis. Uma fila e um escritor da branch integradora; recibos por SHA.",
  "ownership_rule": "Um escritor por arquivo em cada instante. WP é owner lógico; lease de ator/path/intervalo define o escritor efetivo. S0 é única escritora da branch integradora e integra commits dos outros writers, sem reescrever seus arquivos. Transferência exige SHA recebido, janela fechada pelo anterior e aceite do próximo.",
  "contract_change": "S0 publica qualquer mudança de contrato com versão, compatibilidade, consumidores afetados e provas invalida das. Stub é somente scaffolding temporário.",
  "finding_policy": "Publicar achado reproduzido imediatamente e encaminhar ao writer com lease vigente; não esperar o parecer completo ou T95. Autor corrige sua fronteira e revisor independente confirma. Janelas95–103 são reserva de correções tardias. Ausência de capacidade ou achado obrigatório aberto impede conclusão, mas não encerra trabalho autorizado independente.",
  "repo_policy": "GitHub MCP para operações remotas; sem gh, login ou token novo. Testes do repositório somente em GitHub Actions. Typecheck usa o script do pacote e guards seguem AGENTS. Não atribuir sucesso a prova não executada.",
  "source_change": "Baseline de código permanece 9e4f3d35833f9b2cea6abdf58f42331f3973d9bf. Em T0, ler dev e comparar a footprint; o avanço observado para f08941a346ef0d072dff8e67e49823505ad7a12e (registro do integrador) envolve Azure/workflows e não autoriza alterar cloud. Se for adotada uma árvore mais nova, reconciliar .github/workflows/test-ci.yml, validators/registry e recipes com SHA fixado antes de enviar requests. Código core/Atlas/SF/CLI não é declarado mudado por associação. Comparar contra a baseline explícita e proteger o writer cloud.",
  "executor_receipt": [
    "WP/task, actor e branch",
    "source head observado e lease do path",
    "files/outputs/exports e checkpoints",
    "contract versions e manifest digests",
    "consumidores integrados e pendentes",
    "proof IDs, expected/observed e links reais",
    "achados, risco, minutos usados e ETA",
    "ownership e reviewer sem autoria"
  ],
  "communication": "Eventos locais de colaboração e adapter real de lifecycle/mensagens entre sessões quando exposto. GitHub mantém heads e recibos duráveis. Sem adapter, lançamento assistido e leitura agrupada dos heads enquanto as conversas estão ativas; Git não cria nem desperta sessões. S0 segue execution_workflow e não confunde ausência de atualização com sessão encerrada. S0 escreve o ledger transitório em sf2-control. Essa branch nunca se torna base CI nem é mergeada em C/D; os snapshots descendem do C explícito. Para D, incorporar somente blobs evidenciais admitidos com proveniência, nunca merge completo de branch de controle/harness.",
  "stop_rule": "Não encerrar no primeiro bloqueio: registrar causa, dono, impacto e evidência, continuar todo o trabalho autorizado restante. READY_FOR_INTEGRATION não é DONE.",
  "review_independence": "Três agentes novos sem autoria: S1-R1 produto/UX, S2-R2 semântica/integridade, S3-R3 IA/MCP/Atlas/Relay/documentos. Iniciam em slots libera dos após encerrar S1-B/S2-B em 72 e S3-A em 75. Não escrevemproduto; writers ativos corrigem. S1/S2/S3 recebem leases de WP02/WP05/WP07, portanto não são reviewers. Pareceres registramauthorship exclusions: se um reviewer passar a autor, encerrar julgamento e substituí-lo emslot livre real antes de aceite.",
  "timebox_replan": "G2H é obrigação de recalcular, não licença de terminar parcialmente. Medir trabalho remanescente e cadeia de recursos; realocar somente por lease e capacidade liberada. Frentes prontas ajudam provas/correções de arquivos disjuntos. Se 120 não couber, continuar o mesmo escopo e gates com ETA observado.",
  "reviewer_start": "Revisãofresh inclui leitura no orçamento 72/75-95. Inspeções 55-75 porautores/coordenadores são preparação e detecção precoce, nunca substituem os 3 pareceres.",
  "candidate_delivery": {
    "product_candidate_symbol": "C",
    "delivery_symbol": "D",
    "normative_meaning": "Candidato final, candidato aceito, mesmo candidato e SHA final de produto significam C nesta campanha. D é o commit que arquiva a evidência de C sob este envelope, sem alegação de que os testes de C executaram em D. Gates de guard identificam explicitamente C ou D.",
    "C_definition": "Commit congelado com todo código, testes, fixtures, configuração, manifests, skills/prompts, contratos, assets e guias normativos/roteiro/changelog de produto a aceitar. As oito seleções CI mínimas, adicionais obrigatórias do epic, AM01–AM06 e três pareceres de produto referem-se ao mesmo C. Qualquer correção material cria C novo e reabre as obrigações pertinentes; recibos antigos conservam sua identidade.",
    "D_definition": "Descendente de C que apenas acrescenta novos arquivos evidenciais admitidos. O produto e seus inputs de build, geração, teste e runtime permanecem exatamente os de C. Nenhum arquivo anterior é editado, removido, renomeado, copiado para substituir outro ou tem seu modo alterado.",
    "allowed_addition_prefixes": [
      "modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP00/",
      "modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP01/",
      "modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP02/",
      "modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP03/",
      "modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP04/",
      "modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP05/",
      "modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP06/",
      "modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP07/",
      "modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP08/",
      "modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP09/",
      "modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/",
      "modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP11/",
      "modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP12/",
      "modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP13/",
      "modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP14/"
    ],
    "reviews_prefix": "modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/reviews/",
    "delivery_receipt_owner": "WP10.T05/S0",
    "allowed_extensions": [
      ".json",
      ".md",
      ".txt"
    ],
    "allowed_file_mode": "100644",
    "allowed_content": "Somente dados UTF-8 de recibo, parecer e estado de execução, com hashes/IDs/observações autorizadas. Não executar conteúdo desses arquivos. Nenhum segredo ou dado empresarial sem autorização é arquivado.",
    "path_policy": "Normalizar e comparar paths completos da árvore Git; exigir prefixo receipts exato com slash final ou um path control da lista FINITA previamente alocada para esse C/instância. Proibir symlink, submodule, executável, traversal, ambiguidade e extensão diferente. O template delivery não concede o prefixo control inteiro. Pareceres permanecem em receipts/WP10/reviews/.",
    "writer_policy": "Cada prefixo receipts/WPxx conserva writer/lease e WP. S0 incorpora somente blobs evidenciais recebidos, com source commit/path/blob hash, sem reescrita e sem merge completo de branches. S0/T05 aloca e escreve os receipts control exatos; sf2-control nunca é mergeada ou usada como base CI.",
    "append_only_receipts": "Escrever observações intermediárias em paths únicos por execução/candidato dentro do prefixo já possuído. Reservar os destinos canônicos de fechamento para sua primeira publicação; se já existirem, preservá-los e acrescentar novo arquivo versionado, apontado pelo índice de entrega. Nunca atualizar um recibo antigo para aparentar resultado de C. Em retries de entrega, alocar um novo path exato; preservar tentativas anteriores admitidas. Nenhuma atualização do receipt antigo.",
    "verification": [
      "Confirmar C ancestral de D e obter diff Git completo C→D sem truncamento, incluindo status, path, tipo, modo e blob SHA. Um simples filtro dos arquivos exibidos não basta.",
      "Exigir somente adições de arquivos novos nos prefixos receipts enumerados ou na lista finita de paths control previamente alocados para o mesmo C/instância. Conferir registro de alocação por SHA, parent esperado e ausência do novo path antes da tentativa; conferir conteúdo, extensão e modo. Rejeitar qualquer mudança fora do envelope.",
      "Confirmar todos os blobs existentes de C inalterados em D e registrar seus hashes/árvore. Conferir que nenhum novo arquivo é input de import, glob, bundle, registry, geração, seleção de teste ou runtime; dependência desconhecida ou uso detectado rejeita o envelope.",
      "Conferir hashes dos novos recibos, referências aos runs/snapshots reais, seleção observada e candidato C. O delivery receipt indexa os artefatos; não altera seus SHAs de origem.",
      "Executar bun run check:guards --base origin/dev no checkout real de C para G7 e no checkout real de D para G8, preservando configuração e regras. Guard de C não é registrado como se fosse guard de D.",
      "Somente aceitar D após envelope, proveniência e guard de D passarem. Se qualquer condição falhar, rejeitar D como entrega evidencial, classificar a alteração e produzir/requalificar novo C quando houver mudança de produto."
    ],
    "delivery_receipt_fields": [
      "campaign_id",
      "product_candidate_sha",
      "product_tree_hash",
      "evidence_index_with_paths_and_hashes",
      "ci_run_and_request_refs",
      "integrated_proof_refs",
      "independent_review_refs",
      "envelope_policy_version",
      "observed_limits",
      "execution_instance",
      "delivery_attempt",
      "allocation_record_commit",
      "previous_attempt_refs"
    ],
    "self_reference_rule": "O receipt dentro de D não grava seu próprio SHA de D nem seu próprio hash ou o resultado de um guard posterior. D é identificado pelo commit que contém o receipt; seu blob hash vem da árvore Git. Depois de verificar D, S0 publica SHA/resultado/recibo externo do guard no fechamento, sem editar D apenas para anotar o próprio resultado. O índice interno não se inclui em sua própria lista de hashes.",
    "normative_docs": "WP10.T01/S0 integra guia por papel, roteiro e changelog de produto em modules/sucafina/Sucafinav1/README.md antes do freeze de C. Reserva S0 55–60 para essa consolidação; 60–75 para consumidores tardios e ajustes documentais afetados. São reservas não medidas; atraso é registrado em G2H. WP10.T05 consome esses documentos e arquiva evidência, sem criar guia normativo em D.",
    "scope_rule": "O envelope não dispensa gate, capacidade, revisão ou prova. Oito seleções mínimas + adicionais, seis AM e critérios continuam obrigatórios no mesmo C; D não é um atalho de aceitação de outro produto.",
    "delivery_receipt_template": "modules/sucafina/Sucafinav1/docs/sf2h/control/delivery/<execution_instance>/attempt-<positive_integer>.json",
    "exact_delivery_receipt_allocation": {
      "policy": "S0 resolves a finite list of full exact paths for this C/execution instance. One fresh path per delivery attempt, registered on sf2-control before D creation and fixed by allocation-record commit SHA. The template grants no prefix permission.",
      "identity_validation": "execution_instance is a nonempty ASCII [a-z0-9-] identifier; attempt is a positive integer. Normalize and compare full Git paths, reject traversal/symlink/ambiguity.",
      "fields": [
        "execution_instance",
        "product_candidate_sha",
        "delivery_attempt",
        "expected_parent_sha",
        "exact_path",
        "previous_attempt_refs",
        "allocated_exact_paths_for_same_C"
      ],
      "checks": [
        "Current exact path absent in expected parent.",
        "Allocation record commit predates creation of this D; compare ref with expected parent.",
        "All admitted control additions in complete C→D diff belong to the finite already-allocated list for the same C/instance.",
        "D2 may preserve D1 evidence only when those prior additions also satisfy the envelope; previous receipts remain byte-identical.",
        "Product changes, modified old files or forbidden additions cannot be cured by another receipt; explicit correction/requalification is required."
      ],
      "no_auto_reference": "Allocation record identifies C/expected parent/path; not the future D SHA. D is identified by the containing commit after creation."
    }
  },
  "context_policy": "Cada ator lê execution/COMMON.md e seu JSON completo em execution/actors, no mesmo commit. São projeções determinísticas da fonte com axiomas completos, contratos pertinentes, leases e provas. Não reler todos os quinze espelhos. Consultar código real e dependências antes de editar; ampliar contexto quando necessário, sem cortar critérios. Os índices são gerados e têm hashes.",
  "workflow_entry": "START.md → prompts/S0.md → WORKFLOW.md/execution-workflow.json. S0 lança ou reconhece S1–S4 com missões fixas e os builders atribuídos; confirma ACK/roster antes de admitir o preset."
}
```

## Gates e relógio

```json
{
  "gates": [
    {
      "minute": 0,
      "gate": "T0",
      "condition": "S0 registra relógio e baseline, publica os cinco prompts e o mapa de escritores. Setup e abertura das outras quatro sessões entram no relógio; não reiniciar T0."
    },
    {
      "minute": 5,
      "gate": "GREADY",
      "condition": "Cinco sessões e seus vinte slots máximos, contando cinco coordenadoras, têm presença observada. Confirmar atores, leases e minutos. Slot ausente causa realocação explícita e revisão do ETA; não reduzir escopo."
    },
    {
      "minute": 10,
      "gate": "G0",
      "condition": "C01–C17, schemas, operações dos oito packs, versões, paths, escritores e exemplos normativos congelados por WP00.T02. Manifest de execução ainda distingue fontes planejadas de bundles produzidos. Toda construção determinística é liberada por T02, mesmo com GNATIVE pendente."
    },
    {
      "minute": 20,
      "gate": "GNATIVE",
      "condition": "No mesmo candidato de qualificação: caso C09 real com principal/versão/encarnação, sf_finance registrado por AgentV2, sf-explicar-forecast carregada de fonte distribuída com digest, SessionV2.prompt e ponte MCP privada C16 chamam sf_forecast_compare sobre createPlannerPort.compareForecast real; resultado financeiro retorna ao produto com proveniência. UI e MCP usam o mesmo port, principal e base. Teste de chamada direta não concedida e provider homônimo falha. Oito packs têm contratos/concessões listados; operações ainda não implementadas retornam unavailable, não sucesso. AM02 completo dos oito packs é obrigatório em G4. Falha não retém construção determinística."
    },
    {
      "minute": 25,
      "gate": "G1",
      "condition": "C08 protected-store provider publicado, runtime mínimo integrado, primeiros providers dos três domínios e corpus/caso reais. S0-C inicia probes de CI com seleção real e capta fila/setup, sem extrapolar duração do conjunto final."
    },
    {
      "minute": 40,
      "gate": "G2",
      "condition": "Domínios e consumidores iniciais conectados; resolver documental real publicado em T+20 e extração em T+35; fontes de skills dos colaboradores recebidas até T+38. Integração incremental e primeira medição de CI identificadas por SHA."
    },
    {
      "minute": 40,
      "gate": "G2H",
      "condition": "Recalcular caminho residual de construção, provas live, revisão e CI a partir de capacidade e durações observadas. Alvo 120 fica CONDITIONAL se qualquer duração/concurrency obrigatória for desconhecida. Se projeção ultrapassar 120, marcar AT_RISK e publicar sequência full-scope continuada com os mesmos owners, sem reclassificar entrega parcial."
    },
    {
      "minute": 55,
      "gate": "G3",
      "condition": "Cinco perfis e dezoito fontes/skills finais empacotados e carregáveis, execução própria do Revisor disponível, inferência real/contradição/simulação e Relay demonstrados. Atlas real importado pela boundary de distribuição, com BCS, resolver e append/read protegido; prova de reinício/ACL continua até G4. Todos os consumidores tardios ainda têm entregas e ETAs explícitos."
    },
    {
      "minute": 75,
      "gate": "G4",
      "condition": "Escopo funcional integral conectado: cinco perfis, dezoito skills executáveis, oito packs operacionais, Atlas/ledger e documentos reais, aplicações C12 por domínio e UI/Relay consumidores. AM01-AM06 têm integração exercida e candidato cumulativo congelado. Nenhuma fixture satisfaz produção/consumo. Reavaliar G2H com seleção final de CI e provas live."
    },
    {
      "minute": 95,
      "gate": "G5",
      "condition": "Primeiro conjunto de aceitação cumulativa do candidato concluído e três pareceres independentes por seção. Falhas vão ao único escritor; o prazo só permanece viável se CI, provas live e correções residuais observadas couberem."
    },
    {
      "minute": 103,
      "gate": "G6",
      "condition": "Último candidato corrigido de produto C congelado, com guia/roteiro/changelog normativos já incluídos; se houve mudança de produto, disparar gates cumulativos exigidos e provas pertinentes do C aceito. Se C de G4 não mudou, não criar commit artificial para reiniciar provas. Adições posteriores somente evidenciais são tratadas como D pelo envelope, nunca como reatribuição de resultados."
    },
    {
      "minute": 118,
      "gate": "G7",
      "condition": "Receipts completos para o mesmo candidato de produto C: seleções distintas app/src e app/test-browser, Atlas boundary, oito seleções mínimas e adicionais obrigatórias, AM01–AM06, guard de C, três revisões sem autojulgamento e nenhum achado obrigatório aberto. Guia/roteiro/changelog normativos já integram C. G7 habilita T05 a formar D; seu envelope e guard são exigidos em G8."
    },
    {
      "minute": 120,
      "gate": "G8",
      "condition": "Emitir aceite somente após G7 de C e verificação completa de D: C ancestral, diff append-only exclusivamente evidencial nos paths admitidos, inputs de build/test/runtime inalterados, hashes preservados e guard de D aprovado. O receipt interno aponta C; o SHA e o guard de D são publicados no fechamento sem autorreferência. Se qualquer condição faltar, publicar atraso, pendências, ETA, donos e continuar o escopo inteiro; não declarar 120 minutos cumpridos ou encerrar por tempo esgotado."
    }
  ],
  "clock_start": "T0 é a primeira execução da supervisora; inclui preflight, lançamento/ACK das outras sessões, setup, integração e gates. Planejamento/packs já preparados não autorizam reiniciar o relógio depois da qualificação.",
  "scope_policy": "FULL_SCOPE_ONLY",
  "feasibility": "Alvo condicional de 120 minutos, não duração medida nem garantia. O replanejamento usa exclusivamente cinco sessões com quatro slots incluindo coordenadora. As reservas abaixo são orçamento de trabalho a validar em GREADY/GNATIVE/G2H/G4; fila de CI, latência do provider, geração Atlas e correções não têm duração inventada."
}
```

## Axiomas da campanha

### dod

- **CAMP.DOD.01** — Todos os WPs e tasks da lista canônica em campaign.json estão implementados, integrados, verificados e com os cinco grupos de axiomas aplicáveis satisfeitos.
- **CAMP.DOD.02** — As jornadas J01–J13 funcionam nos entrypoints reais, com persistência, autorização, produtores e consumidores reais, incluindo IA, Relay, documentos, portfólio e memória.
- **CAMP.DOD.03** — Três revisões independentes reconciliadas; nenhum achado obrigatório aberto; checks requeridos válidos para o candidato final de produto C e evidência recuperável. A entrega D satisfaz integralmente o envelope evidencial e seu guard, sem reatribuir a D execuções realizadas em C.
- **CAMP.DOD.04** — As verificações exigidas pelo repositório e a cobertura de paridade estão válidas para o candidato de produto C; o guia por papel, a demonstração e os limites materiais estão incluídos nele. D somente arquiva a evidência admitida, com verificação e guard próprios.
- **sf2h-integral-20261112.DOD.05** — As 28 capacidades, R01–R41 e todas as capacidades IA01–IA18 estão implementadas, conectadas a produtores reais e verificadas no candidato de produto. A renovação é uma jornada de aceite, não a fronteira do produto.
- **sf2h-integral-20261112.DOD.06** — T+120 é prazo alvo. Caso reste capacidade ou prova obrigatória, a campanha continua aberta com estado e causa concretos; não declarar MVP, DONE parcial ou feature pronta por estar atrás de flag desativada.
- **CAMP.DOD.20** — C06 resolve confirmação por escopo e C10 resolve cobertura de custos; produtores e consumidores reais demonstram as contraprovas CONFIRM-SCOPE e AI-RENEWAL-OMITTED-CATEGORY.
- **CAMP.DOD.90** — RA01–RA06, C15–C17 e as provas AM01–AM06 estão satisfeitos no candidato implementado: perfis/skills realmente carregados, 39 operações com produtores e consumidores reais, MCP com autoridade por chamada e memória Atlas persistida. O planejamento não registra este critério como aprovado.

### invariants

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

### quality_standards

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

### completeness_criteria

- **CAMP.CMP.01** — Cobrir os contratos C01–C17, as 28 capacidades originais, R01–R41, IA01–IA18 e todas as jornadas da matriz, sem descartar comportamento de negócio aceito.
- **CAMP.CMP.02** — Cobrir leituras e escritas autorizadas/recusadas, dados completos/parciais/ausentes, concorrência, reenvio, referência removida, perda de acesso e retomada depois de falha.
- **CAMP.CMP.03** — O ciclo antes/durante/depois é coberto para executivo, contribuidor, Finance/HR e requester/buyer/approver, usando as permissões reais em vez de um usuário administrador único.
- **CAMP.CMP.04** — As contribuições novas são acessíveis pelos entrypoints reais, com estado compatível e assets/receitas incluídos na entrega do módulo; documentos ou receitas que só existem no repositório não contam como funcionalidade.
- **CAMP.CMP.05** — Cada requisito tem tasks responsáveis, jornadas e evidência esperada. Cada task tem owner, fronteira, entradas, saídas, dependências, checks e os cinco grupos de axiomas locais.
- **sf2h-integral-20261112.CMP.06** — Cobrir ciclos de uso antes/durante/depois: primeiro uso com responsáveis, manutenção, importação, planejamento, compra, análise IA, portfólio, reunião/exportação, recorrência e reavaliação.
- **CAMP.CMP.20** — Cobrir material/irrelevante/revogado/substituído, categoria incluída/inaplicável/pendente/omitida/zero e consumo WP06→WP09 da extração obrigatória.
- **CAMP.CMP.90** — Cobrir cinco perfis, dezoito skills, oito packs, 39 operações, seis provas AM01–AM06 e RA01–RA06. Para cada skill registrar entradas, grants, saída persistida, consumidores, casos positivos/negativos e participação nas provas; incluir empacotamento, revogação, isolamento e reinício.

### success_criteria

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

## Capacidade e identidade

S0 é supervisora e integradora dentro de sua alocação. S1–S4 recebem identidade e jobs fixos. Não escolha uma fatia. A árvore de collaboration com quatro slots globais não se multiplica por aninhamento. O preset de vinte slots exige cinco sessões independentes realmente admitidas. O Git registra entrega e não cria sessões.

## Receber, retomar e concluir

A fonte é imutável por SHA; nenhum pack concede escrita além do lease. Coordenação não é trabalho simultâneo adicional. Silêncio não prova encerramento: feche ou cerque o writer anterior por capacidade realmente suportada antes de transferir. Retome pelo checkpoint/head/contratos e pelo restante, sem reiniciar descoberta concluída. READY_FOR_INTEGRATION não é DONE. Critério sem observação válida permanece NOT_RUN.

O protocolo operacional completo está em [execution-workflow.json](../execution-workflow.json). O índice de jobs, hashes e critérios está em [manifest.json](manifest.json). As fontes de APIs estão em [sources.json](sources.json). Leia AGENTS da baseline e o código real de sua fronteira antes de editar.
