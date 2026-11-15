# Cross-review adversarial — contratos e execução nativa

Revisor: cold_ux. Alvo desta rodada: autoria de **cold_execution e cold_arch/root** em `execution/work-orders`, `COMPONENT-CONTRACTS.md`, `CONTRACTS.md`, `component-locks.json` e `contract-catalog.json`. Não é autoaprovação do SURFACE-SPECS. Nenhuma implementação de produto, teste de runtime ou CI foi executada.

## Resultado

O plano revisado precisou de correções materiais adicionais após o cold review inicial. Esta revisão encontrou contratos de props incompletos, lacunas reais de operações, locks ausentes de consumidores, conflito de ciclo de autorização e uma leitura de Schedule insuficiente para editar com honestidade. As decisões abaixo fecham o desenho; readiness e evidência dos produtores permanecem exigidas.

## Findings e encerramento

### CUX-01 — P1 — Estados de draft/autorização divergiam entre três fontes

**Evidência:** COMPONENT-CONTRACTS seção 7 permitia quarentena após expiry; SURFACE inicialmente apagava draft também em expiry; CONTRACTS 3.3 dizia 401 limpa sessão sem distinguir credencial de conteúdo em quarentena. A união do componente usava `filtered-empty`, enquanto textos de WOs usavam `filter-empty`. Estados semânticos como revoked/read-only/invalid-link também não tinham mapping fechado.

**Causa e impacto:** F01, S03 e páginas paralelas poderiam implementar perda de draft, restauração indevida ou tipos incompatíveis, cada um obedecendo uma fonte diferente.

**Correção decidida pelo root:** `filtered-empty` único; `not-found` explícito; resolving→loading, read-only→ready+flag, revoked→denied+purge, invalid-link→invalid. Fases de draft separadas do estado de página. Expiry oculta UI privada, mantém somente quarentena efêmera sem revogação comprovada e pode transferir para novo authEpoch após revalidar o mesmo servidor/identidade de transporte/origin/principal/instalação/projeto e acesso atual à entidade/campos; incompatibilidade de identidade/autorização purga. Logout voluntário pode oferecer guard antes do ato; depois de confirmado ou em revogação real, purge imediato.

**Fechamento:** SURFACE foi alinhado; root/alvo alinharam COMPONENT/CONTRACTS e as work orders. O registry F01 é o único dono de lifecycle; a folha não recebe método para restaurar autoridade. Não interpretar timeout como revogação nem 200 de login como autorização de restaurar dados antigos.

### CUX-02 — P1 — UI64/UI66/UI70 possuíam recursos sem operação consumível

**Evidência original:** `contract-catalog.json#/families/intelligence/resources/{routine-admission,schedules,residents}/operations` eram arrays vazios. UI64/66/70 e respectivas work orders já exigiam inputs, ações e resultados. `BusinessPorts.routines` e `.schedules` existem em `product/contracts/ports.ts:92–106`; `routine-services.ts:135–208` implementa o port de routines. Portanto, classificar ambos simplesmente como “contrato não publicado” seria falso. Além disso, `readSfImportAnalysisChoices` em `product/imports/analysis-options.ts` lista apenas as duas skills de enquadrar decisão/explicar forecast; não cobre o inventário dos cinco perfis/dezoito skills de UI70.

**Causa e impacto:** Haveria authoring bloqueado por um vazio de schema ou criação improvisada de endpoint; uma página “completa” poderia exibir somente indisponibilidade permanente apesar de tipos existentes. Reusar choices de duas skills como catálogo completo esconderia a omissão.

**Correção de cold_arch:** seams estreitos e tipados de routines/schedules, source refs nos ports reais, Request/admission/case binding originais e disponibilidade por operação. Residents ganha projeção read-only com allowlist do `SfHostServices.selected`; resultados continuam pelos envelopes de contribuição reais, sem expor paths/instruções privadas. O produtor de Schedule ausente continua unavailable, não é substituído por implementação simulada.

**Fechamento verificado:** todas as 70 entradas resolvem famílias/resources com operações. UI64 fixa seletor de **caso existente autorizado** quando o seam routines o exige; sem caso, needs-input + “Abrir casos”, sem caso fictício. Schedule usa inputs diretos e relações de UI51 continuam sem caso obrigatório.

### CUX-03 — P1 — Dependências de integração não exigiam seus locks públicos de autoria

**Evidência original:** U11 consumia S01/S03/S04 em `depends_integration` mas só fixava ui-frame; faltavam ui-table/ui-change-review/ui-evidence em authoring/consumes/required_reads. U12 consumia S01/S03/U20 mas não seus locks específicos.

**Causa e impacto:** consumidores poderiam começar com API de componente não congelada; drift exigiria descoberta tardia ou invalidação ampla, prejudicando paralelismo e causando retrabalho.

**Correção de cold_execution:** derivar os locks dos produtores consumidos, nos três lugares, sem adicionar arestas de integração desnecessárias. F03→ui-frame; S01→ui-table; S02→ui-grid; S03→ui-change-review; S04→ui-evidence; S05→ui-collaboration; U20/21/22→ui-bi.

**Fechamento verificado:** confronto documental nas **78 work orders**, zero dependência de componente sem o lock correspondente nos três campos. Paths e primários das 70 superfícies também foram reconciliados após os splits. S05 permanece puro; U44 compõe as páginas UI51–53 e usa A13/F01.

### CUX-04 — P1 — “Assinaturas exatas” ainda eram descrição de props sem tipos de payload

**Evidência original:** COMPONENT-CONTRACTS nomeava `onEdit/onCommitCell/onNavigate`, `cells/draftCells`, `rowActions/page/widthPolicy` e `effects/base/proposed`, mas não congelava argumentos, retornos, coordenadas ou discriminators. Dois autores poderiam produzir APIs incompatíveis respeitando a mesma descrição.

**Causa e impacto:** o paralelismo deslocaria decisões de interface aos executores e a integração viraria negociação de types/props. Isso contradizia diretamente “modelos só executam”.

**Correção autorizada:** este revisor passou a autorar `execution/component-signatures.ts`, somente declarações normativas, sem produto. Props readonly, callbacks void, carriers de apresentação e unions de estados/identidade são explícitos; F01 possui aliases/registry, componentes puros não recebem SfSurfaceProps nem client. Esse novo artefato foi encaminhado para revisão independente de cold_arch/cold_execution/root.

**Contraexemplos levantados por essa revisão independente e corrigidos:** mês UI numérico agora é 0–11, igual ao produtor, com labels separados; review de comando legado não exige reviewRef/digest que ele não emite; snapshot novo usa intenção local e base null, não entidade inventada; confirmação sem projeção não promove valores submetidos a leitura atual; run indisponível/pré-admissão não exige runRef; rotina e análise têm descritores distintos; file selection/new intent são handles locais distintos de referência persistida; callback de layout pode notificar resize sem gesto, mas nunca efeito de domínio.

**Limite de evidência:** revisão por leitura de tipos/declarations, não compiler PASS. Um parser TypeScript instalado não estava disponível nos caminhos consultados; não se baixou pacote nem executou código de produto. A nota `component-signatures-syntax.json` preserva esse limite. O root deve usar o parecer independente para congelar a correção; este revisor não declara aprovação da própria autoria.

### CUX-05 — P1 — Schedule list não oferece os valores necessários ao editor

**Evidência:** `BusinessPorts.schedules.list` retorna somente `{scheduleRef,version,state}`. Não fornece conditionRef/recipeRef/recurrence/timezone, e `readRun` não é leitura da configuração de Schedule.

**Causa e impacto:** editar/revisar recorrência exigiria prefill ou diff fabricados, um patch em branco ambíguo ou uso direto do core Schedule sem a autoridade do produto.

**Decisão final do root:** nova porta privada opcional `nativeUiProducts.scheduleDetails.read({scheduleRef}, TrustedDomainContext)` com retorno exato `{scheduleRef,version,state,conditionRef,recipeRef,recurrence,timezone}`; A09 expõe `POST /api/ui/schedules/read`. Ausência retorna `schedule-detail-port-unavailable`. U34 não habilita update antes de detalhe atual autorizado confirmado. Create/pause/list são independentes. Não foi mantida a alternativa intermediária de edição proposed-only sem fonte atual.

**Fechamento:** UX/manifesto/tipos de host se referem à mesma decisão. Isso fecha o seam de planejamento; o port real continua condição de qualificação, não implementação alegada pelo documento.

## Verificações documentais de fechamento

- 78 ordens operacionais; 70 superfícies únicas; 15 chapters; 165 templates de rota sem duplicação exata.
- 109 controles CAP/action e 14 aliases de produtor separados de affordances, sem duplicar editor.
- 217 chaves (incluindo cinco do diálogo nativo D01) de título/ação/copy compartilhada, todas únicas, com literal en/pt-BR para copy nova. Copy herdada sem tradução prévia conserva source English por decisão explícita de migração, sem escolha lexical do executor.
- Todos primaryOwners e contributors existem; cada primaryOwner possui seu ID em `surfaces` da work order correspondente.
- Todos resources resolvem operação; os comandos CAP conferem sourcePage/discriminator com o catálogo.
- Os seis blobs de renderer/dispatcher em C27 foram comparados por GitHub MCP com `faa30fddb7e7b61696b66fd069f51cf18c51125f`: seis idênticos. Não foi empurrado drift já conhecido para I00. Evidência em `execution/surface-source-comparison.json`.
- A checagem documental não substitui readiness, typecheck do produto, prova de domínio, runtime instalado, visual/a11y, CI ou same-C qualification. M31/MI07/P03/Schedule e demais handoffs continuam explícitos.

O registro numérico reproduzível fica em `surface-cross-verification.json`; a fonte de verdade das contagens de operações é o catálogo final do root, pois a nova leitura de Schedule foi acrescida após o primeiro confronto de 304 operações.

## ACK final dos documentos superiores

Releitura delimitada de README, UX-DESIGN, NATIVE-ARCHITECTURE, ACCEPTANCE, SCREEN-INVENTORY e DELIVERY-PLAN: **nenhuma contradição material remanescente** com os contratos/superfícies/tipos finais. A frase sobre epoch agora distingue invalidação dos handles ativos da transferência explícita de quarentena reautorizada. Copy nativa D01 foi congelada em COPY-02; os IDs de rota/UI70 e a separação de S05 puro/U44 páginas permanecem coerentes. SHA-256 de cada arquivo revisado:

| Arquivo | SHA-256 |
| --- | --- |
| README.md | `83e2fc0ee8155cd4f189395687e3bf8946071f9c63b26e6b6fa355034114f235` |
| UX-DESIGN.md | `2c1fcea50135e9ddd8b96d4b73a96382261e1f16c6a5e263e79ffb329300df4f` |
| NATIVE-ARCHITECTURE.md | `7e1ce7d6a53fcd7870f57779490f386491a42905b2af76675944fab27fe4dd27` |
| ACCEPTANCE.md | `82d4551aa5c36f75cb6fef9dba260f0f1b6e5cbecf25f894e772be0242b78e13` |
| SCREEN-INVENTORY.md | `115bf00b25624e60eef2862d0c8383161353d8cccfb891f51c50238ef0d32e67` |
| DELIVERY-PLAN.md | `89e8804230a914c63ad52c747ee745213c4a10daa61769fcf5bed2ac6e6e294f` |
