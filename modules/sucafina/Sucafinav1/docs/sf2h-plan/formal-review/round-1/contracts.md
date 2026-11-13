# R2 — revisão formal de contratos, identidade, MCP, Atlas e integridade

**Veredicto: REQUIRES_CHANGES.** Foram encontrados **3 P1**, **0 P0** e **0 P2**. O plano não está pronto para execução integral do adendo sem reconciliar as três fronteiras descritas abaixo. A conclusão não decorre de a implementação ainda não existir; decorre de contratos, produtores e provas ainda representarem a campanha anterior em áreas que o adendo tornou obrigatórias.

- **Commit revisado:** `ec9d36da2385007b64a0aa627582ce7e60629a44`, branch `sf-product-plan`, repositório `gustavomhss/Orchestra-SF`.
- **Baseline de código consultada:** `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`.
- **Status dos testes de implementação:** `NOT_RUN`.
- **Independência:** não consultei reviews históricos, verified-* nem resultados dos outros revisores; não alterei o plano ou o remoto.

## Método e limites

Li o protocolo e as fontes primárias pelo GitHub MCP, com referências fixadas nos SHAs acima, e consultei a cópia congelada para localização e buscas. Examinei C01–C14, ownership, evidências/CI, a campanha estruturada e as tasks relevantes de WP00, WP03, WP04, WP06, WP08, WP09, WP10, WP11, WP12, WP13 e WP14. Os WPs e índices foram lidos seletivamente conforme o foco; a lista detalhada está no JSON. O recibo de congelamento fornecido pelo integrador declara 73 blobs coincidentes; não repeti esse trabalho.

O [SCOPE-STATUS](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/modules/sucafina/Sucafinav1/docs/sf2h-plan/SCOPE-STATUS.md) informa corretamente que a validação estrutural anterior não cobre a integração do adendo. Portanto não trato o checkpoint como uma alegação de aceite já concedido. Os achados são P1 porque falta fechar requisitos obrigatórios da execução planejada; não há evidência de violação efetivamente implementada que justificasse P0.

## Fronteiras revisadas

| Área | Resultado da revisão do plano |
| --- | --- |
| Finanças e comandos canônicos | Oráculos, domínios e controles específicos estão previstos. |
| Persistência/importação/encarnação | Política de preservação e contraprovas explícitas estão previstas. |
| Idempotência e recibos | Commit por domínio e recuperação de resposta perdida estão previstos. |
| ACL, revogação e documentos adversariais | Requisitos e checks relevantes estão previstos; o MCP e a memória Atlas ainda precisam de fronteiras concretas. |
| Perfis e skills residentes | P1: a matriz executável não representa o novo contrato de runtime. |
| Identidade no MCP | P1: a ponte precisa de um protocolo e um caminho de implementação compatível com o ownership. |
| Atlas empresarial | P1: faltam a tradução de contratos e a atribuição do adapter protegido. |

## T-F01 — P1

**Requisito:** Adendo: cinco perfis residentes via AgentV2, dezoito skills carregadas e usadas, proveniência por versão/digest e execução independente de crítica; CAMP.CMP.05 e WP00.T02.CHK.03 exigem responsabilidade e prova rastreáveis.

**Localização:** modules/sucafina/Sucafinav1/docs/sf2h-plan/AGENTS-ATLAS-MCP.md:25–60,183–199; modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json:C08/C11; campaign.json:WP00.T02, WP10.T01, WP12.T01–T04; evidence-plan.json:E01/E11/E16.

### Evidência primária

- [modules/sucafina/Sucafinav1/docs/sf2h-plan/AGENTS-ATLAS-MCP.md](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/modules/sucafina/Sucafinav1/docs/sf2h-plan/AGENTS-ATLAS-MCP.md) — linhas 25,50,56,60,183–185,199: O adendo exige AgentV2, 18 skills com versão/digest e carga efetiva, configuração por perfil e uma execução própria do Revisor. Atribui essas entregas adicionais a WP00/WP10/WP12.
- [modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json) — C08:197–218; C11:290–296: C08/C11 ainda descrevem job genérico de análise e proveniência genérica. Não definem manifest de perfis/skills, vínculo de skill efetivamente carregada à execução, versão/digest, composição de especialistas ou vínculo entre análise e crítica independente.
- [modules/sucafina/Sucafinav1/docs/sf2h-plan/campaign.json](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/modules/sucafina/Sucafinav1/docs/sf2h-plan/campaign.json) — work_packages[WP12].tasks; work_packages[WP10].tasks[WP10.T01]; consumption_map AIEDGE02/13: As quatro tasks de WP12 entregam catálogo de ferramentas, intenção, crítica e lifecycle de uma análise. Seus checks verificam inferência real, autorização e resultados; não discriminam cinco perfis, 18 skills ou isolamento da execução do Revisor. WP10.T01 não acrescenta registro/carga desses assets. A busca nos contratos, campanha, ownership, axiomas, proof-map e WPs não encontrou os IDs dos perfis nem as novas entidades do adendo.
- [modules/sucafina/Sucafinav1/docs/sf2h-plan/evidence-plan.json](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/modules/sucafina/Sucafinav1/docs/sf2h-plan/evidence-plan.json) — E01, E11, E16 e required_fields: As provas continuam centradas em contratos, análise/portfólio e host binding. Não há matriz consumível de perfil → skill → versão/digest → execução → saída, nem critério que detecte uma skill apenas catalogada.
- [packages/schema/src/agent.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/schema/src/agent.ts) — Info.skills: O campo skills de Agent.Info contém metadados da árvore, não o corpo carregado.
- [packages/core/src/skill.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/skill.ts) — Draft.source; load, linhas 79–84 e 119–132: A carga de conteúdo depende de uma Source registrada no SkillV2; o código admite fontes embedded/directory/url e reserva opcional de nomes. Registrar um Agent.Info e listar skills não implementa essa etapa.
- [AGENTS.md](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/AGENTS.md) — What Ships and What Stays in the Repo: Conteúdo necessário ao agente em execução precisa estar em prompt ou skill distribuída; docs e catálogo de manutenção não constituem entrega de runtime.

### Contraexemplo e consequência

Uma implementação pode cumprir os checks atuais de WP12 usando um único agente de análise, uma crítica na mesma sessão e prompts montados diretamente pelo provider. Pode produzir propostas reais, detectar contradições e passar E11 sem carregar nenhuma das 18 skills e sem registrar os cinco perfis. Isso satisfaz a matriz estruturada examinada, mas descumpre o DoD explícito do adendo. O SCOPE-STATUS reconhece que a validação anterior não cobre essa integração, portanto não classifiquei esse caminho como um aceite já ocorrido.

As frentes recebem critérios canônicos insuficientes para distinguir a equipe residente contratada de uma análise genérica. A ausência de ligação entre perfil, asset carregado e execução também impede auditar as operações concedidas e a independência da crítica.

### Correção verificável

Reconciliar a campanha antes de liberar a construção dependente: acrescentar contrato/manifest de perfis e skills com identificação, versão, digest, fontes distribuídas, permissões e schemas; atribuir writer, caminho, task produtora e consumidores de registro/carga/roteamento; distinguir execução do Revisor; incluir checks discriminantes e matriz de prova para os cinco perfis e as 18 skills. Vincular o GNATIVE do adendo ao gate canônico, exigindo perfil real e skill efetivamente carregada. O artefato pode ser produzido em WP00, mas a obrigação, seus consumidores e seu gate precisam constar da lista executável.

**Responsável sugerido:** S0/WP00: contratos e rastreabilidade; WP12: perfis/skills/roteamento; WP10: distribuição, registro e carga no host.

**Bloqueia a prontidão integral:** sim. **Confiança:** Alta quanto à lacuna no snapshot; nenhuma alegação de que o runtime seja incapaz de implementá-la.

## T-F02 — P1

**Requisito:** Identidade confiável por execução, interseção de permissões usuário/sessão/caso/perfil/domínio, paridade UI/agente/MCP e recusa de provider conflitante; adendo §§ Política de concessão e Seis provas integradas.

**Localização:** modules/sucafina/Sucafinav1/docs/sf2h-plan/AGENTS-ATLAS-MCP.md:87–103,123,183–193; modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json:C08; modules/sucafina/Sucafinav1/docs/sf2h-plan/ownership.json:WP10/resolution_order; baseline packages/core/src/mcp.ts:174–200,277–305 e mcp/provided.ts:Server.

### Evidência primária

- [modules/sucafina/Sucafinav1/docs/sf2h-plan/AGENTS-ATLAS-MCP.md](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/modules/sucafina/Sucafinav1/docs/sf2h-plan/AGENTS-ATLAS-MCP.md) — linhas 101–103,123,184,191,219–223: O adendo identifica corretamente que McpProvided não transmite identidade SF e exige binding equivalente à closure de turno e proteção contra substituição pelo mesmo nome. Não define qual caminho implementará esse binding.
- [modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json) — C08:197–218: O contrato congela identidade do BusinessPorts e uso de Host.Contribution/Tools.Service, porém não especifica transporte/handshake do servidor sucafina-workbench, origem confiável do contexto por chamada, duração do binding, invalidação ou resolução de colisão de provider. A prova canônica T+20 ainda é inferência/projeção/admissão, sem o percurso MCP.
- [modules/sucafina/Sucafinav1/docs/sf2h-plan/ownership.json](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/modules/sucafina/Sucafinav1/docs/sf2h-plan/ownership.json) — WP10 existing_files/new_prefixes; resolution_order: WP10 pode escrever nos entrypoints enumerados e nos namespaces product/host-binding, product/integration e apps/cli/src/sucafina-product. O core MCP e o adaptador Claude são somente leitura pela política padrão. O plano não identifica um caminho concreto dentro das fronteiras concedidas, nem declara uma exceção, caso o binding necessite outra seam.
- [packages/core/src/mcp/provided.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/mcp/provided.ts) — Server; Interface; tracker: Server fornece apenas name, key e connect(): Transport; servers() não recebe sessão, ator ou caso. O tracker conserva o servidor pelo nome/key.
- [packages/core/src/mcp.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/mcp.ts) — configured, linhas 174–200: Servidores configurados vencem o mesmo nome: um provided só é inserido se servers.has(name) for falso. A proteção de colisão de nomes sanitizados não altera essa precedência.
- [packages/core/src/mcp.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/mcp.ts) — mcpTool, linhas 277–305: A permissão recebe sessionID/agent do contexto nativo, mas client.callTool transmite ao servidor somente name e arguments. A autorização nativa não converte automaticamente esses IDs no principal empresarial SF.
- [modules/engine-adapters/claude-code/src/v2/host.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/engine-adapters/claude-code/src/v2/host.ts) — linhas 368–369: A ponte existente recebe turn.execute por closure de turno. Esse padrão explica a necessidade do novo binding, mas a função desse arquivo não é uma porta MCP SF já disponível.

### Contraexemplo e consequência

Duas sessões autorizadas de usuários SF diferentes chamam o mesmo servidor provided, conectado no Location. Se o servidor usar somente a API provided descrita, recebe os mesmos tipos de argumentos sem o ator empresarial autenticado de cada chamada. Um ator capturado globalmente pode atribuir a chamada ao usuário errado; aceitar actor nos argumentos viola o invariante. Além disso, uma configuração com o nome sucafina-workbench é escolhida antes do provided nativo. O plano exige bloquear ambos os cenários, mas não possui um contrato/handoff e um gate canônico que demonstrem o caminho escolhido para isso.

O principal mecanismo de segurança da nova superfície permanece uma intenção sem fronteira executável reconciliada. Os builders podem chegar ao gate com uma ponte nativa segura e um MCP ainda indisponível, ou descobrir tardiamente que sua solução requer arquivos não concedidos. Não afirmo que uma solução segura seja impossível; o ponto é que ela ainda precisa ser escolhida e contratada.

### Correção verificável

Acrescentar uma sequência de execução normativa do MCP: como o host autentica e vincula installation/project/location/session/case/actor/profile; qual componente entrega esse contexto fora dos argumentos do modelo; quando ele expira/revalida; como a chamada chega à mesma porta C01–C14; e como recusa provider homônimo ou geração substituída. Nomear producer/export/path e owner compatíveis com ownership. Acrescentar provas por chamada direta, duas sessões/principais concorrentes, revogação entre descoberta e execução, operação não concedida e provider homônimo. Reconciliar o gate T+20 e a prova de paridade dos oito packs sem abrir novos acessos ou modificar engines como atalho.

**Responsável sugerido:** S0/WP00 e WP10; WP12 consome o binding e as concessões; WPs de domínio conservam a autorização final.

**Bloqueia a prontidão integral:** sim. **Confiança:** Alta sobre o comportamento das APIs consultadas e a ausência do contrato específico; viabilidade de uma seam alternativa dentro do ownership permanece a qualificar.

## T-F03 — P1

**Requisito:** Atlas SF deve consumir módulos/ports reais com BusinessEvidenceRef, owners e kinds empresariais explícitos, armazenamento protegido/serializado, recuperação autorizada e prova de reinício; não reutilizar PRs fictícios nem identidades de engenharia.

**Localização:** modules/sucafina/Sucafinav1/docs/sf2h-plan/AGENTS-ATLAS-MCP.md:157–177,186; modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json:C09/C13/C14; campaign.json:WP14 e WP10.T01; baseline modules/atlas/packages/adapter-io/src/{memory-read,memory-emit,memory-store}.ts e packages/memory/src/{types,template,inject}.ts.

### Evidência primária

- [modules/sucafina/Sucafinav1/docs/sf2h-plan/AGENTS-ATLAS-MCP.md](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/modules/sucafina/Sucafinav1/docs/sf2h-plan/AGENTS-ATLAS-MCP.md) — linhas 163–177 e 186: O adendo pede BusinessEvidenceRef, BusinessContextService, adaptação de createMemoryRead/createMemoryEmit/DurableMemory, persistência serializada protegida e resolução explícita de owners/kinds. Atribui genericamente a boundary a WP06 + WP14.
- [modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json) — C09:239–245; C13:346–353; C14:373–379: Os contratos ainda definem referências do caso, CaseRecall e DocumentEvidence. Não há contrato para a tradução dessas entidades para as entradas Atlas, owner empresarial, scanner de escrita, DurableMemory protegido ou resolver de BusinessEvidenceRef.
- [modules/sucafina/Sucafinav1/docs/sf2h-plan/campaign.json](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/modules/sucafina/Sucafinav1/docs/sf2h-plan/campaign.json) — WP14 scope_in/scope_out/INV.01; WP14.T02/T04; WP10.T01: WP14 permanece uma frente de funções/projeções puras e explicitamente não persiste. WP10 mantém persistência genérica de metadados SF. Não há task/saída que atribua a tradução Atlas, o adapter de seu store e seu consumo ao provider concreto. Os checks de recuperação/revogação podem ser executados sobre AuthorizedCaseProjection sem chamar Atlas.
- [modules/atlas/packages/memory/src/types.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/memory/src/types.ts) — MemoryKind, MemoryEntry, Ref e MemoryRecord: Atlas admite quatro kinds: task/pr/project/logbook; Ref é StructRef ou string. Um objeto empresarial com campos de caso/documento não é automaticamente uma entrada ou referência reconhecida.
- [modules/atlas/packages/memory/src/template.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/memory/src/template.ts) — REQUIRED/OPTIONAL:56–73; memoryKindOf:127–132; isRef:151–168: Templates são fechados; campos extras ou ausência das chaves requeridas impedem derivar o kind. Objetos Ref aceitos têm forma de StructRef de código. Uma referência empresarial precisa de tradução/resolução declarada.
- [modules/atlas/packages/adapter-io/src/memory-emit.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/memory-emit.ts) — MemoryEmitDeps:98–108; emit:124–156,219–255: A escrita exige entrada de template admitida, owner e scanner nomeado. Scanner ausente resulta em scanner-unavailable; apenas depois dos gates ocorre append.
- [modules/atlas/packages/adapter-io/src/memory-read.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/memory-read.ts) — createMemoryRead.recall:200–204: O actor do adapter não é injetado automaticamente no recall: a função passa a query ao recallOver sobre todo o store retornado. A boundary deve impor o recorte autorizado, não presumir que actor já filtra essa leitura.
- [modules/atlas/packages/memory/src/inject.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/memory/src/inject.ts) — injectFor/readRepoBytes e recall: Owner-scoping não é controle de acesso; recall filtra pelos seletores fornecidos. Um kind reconhecido sem owner pode selecionar registros de vários owners.
- [modules/atlas/packages/adapter-io/src/memory-store.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/memory-store.ts) — DurableMemory e createDurableMemory: O port tem read/append síncronos; a implementação pronta grava logs por seat no repositório. Sua substituição por armazenamento SF protegido é trabalho distinto, incluindo serialização dos gates de admissão.
- [modules/sucafina/Sucafinav1/runtime/contract.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/runtime/contract.ts) — Persistence.transaction: A instalação oferece transaction assíncrona e commit durável por Snapshot. A composição entre esse ciclo e os métodos síncronos de DurableMemory precisa de adapter explícito; não é compatibilidade automática de assinatura.

### Contraexemplo e consequência

Uma implementação de WP14 pode recuperar casos parecidos e passar seus checks usando só projeções do ledger SF, sem consumo algum do Atlas, o que o adendo proíbe chamar de substrato integrado. Se o integrador tentar passar diretamente um caso/BusinessEvidenceRef a createMemoryEmit, os templates não o admitem; mesmo uma entrada convertida falha sem scanner. Se usar actor=sf_finance e recall({kind:'task'}) sobre store compartilhado, o lower-level read não restringe por actor. O código permite uma boundary segura, mas as traduções, o recorte e o provider de persistência não estão contratados na campanha.

Não há uma divisão implementável e testável da adaptação Atlas entre WP06/WP14/WP10. Isso deixa sem responsável preciso os requisitos que distinguem memória empresarial confidencial de memória de engenharia e o uso real do engine de um wrapper com o mesmo nome.

### Correção verificável

Definir a boundary empresarial no plano com produtor, export/path, consumidor e owner únicos para: BusinessEvidenceRef/resolver; projeção autorizada de memória; mapeamento permitido de owner/kind/entry; scanner e seus estados; adapter DurableMemory sobre o armazenamento SF com atomicidade/serialização; e invalidação por access revision, versão e encarnação. Preservar o ledger do caso como fonte oficial e evitar PRs/identidades fictícios. Incluir prova integrada instrumentada de consumo dos módulos reais, append/read após reinício, dois atores usando o mesmo perfil, recall com owner omitido/forjado, revogação por campo/registro, importação que substitui encarnação e falha do scanner. Reconciliar C08/C13/C14 e os checks E12/E15/E16 sem atribuir persistência a WP14 contrariando seu invariante.

**Responsável sugerido:** S0/WP00: contrato e divisão explícita; WP14: transformação/recuperação pura; WP06: documentos e referências; WP10: boundary confiável e adapter persistente serializado.

**Bloqueia a prontidão integral:** sim. **Confiança:** Alta quanto à incompatibilidade de formas e aos limites reais dos adapters; não alego inviabilidade do reaproveitamento, apenas a ausência da especificação necessária para realizá-lo.

## Controles que não reabri como achados

Os [contratos C03/C12](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json) exigem chave/digest, revalidação de acesso e recibo no mesmo commit da mutação. WP10.T01 e WP11.T04 incluem falha antes do commit, perda da resposta depois dele e retomada parcial, sem supor atomicidade global. Essa é uma orientação verificável, compatível com o [contrato de Persistence](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/runtime/contract.ts).

C08 e WP11.T01 tratam a preservação dos metadados confiáveis e a substituição por encarnação; a importação maliciosa possui contraprova explícita. WP03 mantém o motor financeiro e as distinções de ausência, moeda, período, orçamento, actual e forecast; WP04 preserva o câmbio da submissão e as alçadas. WP10 exige leituras entre superfícies fora de transactions alheias, com versão por seção. Esses controles estão descritos nos [WPs e semânticas da campanha](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/modules/sucafina/Sucafinav1/docs/sf2h-plan/campaign.json).

WP06.T05 e WP12.T01 incluem documento malicioso, extração candidata, confirmação e falha sem texto. WP09 fixa o principal e exige autorização atual em ocorrência, admissão, execução e recuperação dos resultados. Essa avaliação é de planejamento: todos ainda dependem das provas no candidato de produto.

## Incertezas residuais

- Análise estática do plano e das APIs: nenhum comportamento do produto foi executado e nenhuma prova de implementação foi marcada como PASS.
- Os três achados distinguem conteúdo/execução dos perfis (T-F01), transporte da identidade MCP (T-F02) e compatibilidade/armazenamento Atlas (T-F03); não são três contagens da mesma ausência de implementação.
- Há APIs públicas compatíveis para uma solução. Não foi demonstrada impossibilidade arquitetural, e não é necessário remover escopo, criar acesso corporativo ou modificar engines para fechar estes achados.
- A disponibilidade concreta de provider, identidade empresarial, armazenamento protegido e serviços nativos no futuro ambiente de execução continua sujeita à qualificação GNATIVE.
- Os controles financeiros e de integridade considerados adequadamente planejados ainda precisam de provas reais no candidato implementado; esta avaliação não os certifica.
- A frase de WP09.T04 sobre nova extração fora da campanha está desalinhada com WP06.T05, mas não foi aberta como achado separado: o escopo obrigatório de extração está expresso e a reconciliação de contratos do adendo já precisa preservar seu consumo.

## Condição para encerrar a revisão

Uma nova rodada deve mostrar as alterações normativas dos três achados em contratos, WPs, ownership/consumo e provas, no mesmo commit. Não é necessário executar a campanha de produto para fechar a revisão do plano. A correção deve tornar cada entrega adicional concreta e verificável, mantendo o escopo integral e registrando eventual impacto na meta de duas horas.

