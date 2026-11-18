# Cross-review de arquitetura sobre execução, rotas e componentes

Estado: **revisão documental; nenhuma execução ou qualificação de produto**. Reviewer: cold_arch. Escopo cruzado: artefatos de cold_execution e cold_ux, confrontados com o código pinado e com os contratos de integração. O reviewer participou da correção de CONTRACTS/catalog/host-signatures; este relatório não apresenta esses próprios arquivos como submetidos a um FINAL independente. As objeções a eles vieram de root/cold_execution/cold_ux e foram tratadas no cruzamento.

## Resultado

O fatiamento de 78 ordens e 70 superfícies é compatível com autoria paralela contra contratos congelados, desde que se mantenham a composição incremental de operações, a distinção entre autoria e qualificação, e os gates externos de produtores. A inspeção do DAG não encontrou ciclo de integração. O mapa tipado contém as 70 superfícies e corresponde às 165 templates do manifesto. Nenhuma superfície exige que um componente puro passe a consultar o host.

Os defeitos materiais encontrados no cruzamento e suas decisões de fechamento estão abaixo. A prova é documental/estrutural; ela não substitui compiler, runtime, autenticação instalada ou aceite dos produtores.

## Findings e correções verificáveis

### CAX-01 — Alta — identidade do draft usava baseVersion e podia perder edição

**Evidência:** COMPONENT-CONTRACTS §7 originalmente incluía baseVersion na key; o source do shell já possui ChapterBoundary keyed por chapter. O componente S03 precisava sobreviver a ambos os acontecimentos sem confundir versão da base com identidade do editor.

**Causalidade:** qualquer refetch com revisão nova ou desmontagem do leaf poderia produzir outra instância, esconder o dirty ou apagar a intenção pendente.

**Fechamento documental:** COMPONENT-CONTRACTS §7 e component-signatures:SfDraftInput fixam owner+editScopeKey+surface+identity como lookup. baseVersion pertence ao estado; F01 retém o controller acima da boundary. Repeated acquire não substitui a instância/valores. S03 factory é injetada por I00, não criada pelo leaf.

**Prova futura:** editar, navegar a outro chapter, voltar e receber outra revisão conserva o dirty e marca stale; nunca salva automaticamente nem muda a key para a revisão nova.

### CAX-02 — Alta — quarentena/restore e lifecycle público permitiam duas interpretações incompatíveis

**Evidência:** a tabela de expiry exigia epoch idêntico, enquanto login incrementa authEpoch; SfDraftController expunha restoreSameAuthority junto dos métodos de UI.

**Causalidade:** ou toda reautenticação descartaria a quarentena, tornando o requisito inútil, ou o consumidor relaxaria a comparação por conta própria e restauraria dados de uma autoridade anterior.

**Fechamento documental:** rebind explícito e privado F01 depois de nova autenticação, exigindo o mesmo serverKey, transportIdentity, publicOrigin, principal, instalação e projeto, mais autorização atual de entidade/campos/ações. Nova versão preserva dirty+stale, não a antiga admission. A UI só recebe SfPublicDraftController sem restore/quarantine/revoke; calls públicos não reativam estados bloqueados. Logout confirmado, troca voluntária de owner e revogação são terminais para aquele conteúdo. O guard voluntário ocorre antes do logout, nunca depois.

**Prova futura:** principal alternado e resposta tardia nunca restauram; a mesma autoridade renovada pode retomar sob nova generation; logout/revoke não aguardam prompt.

### CAX-03 — Alta — símbolos de componentes exigiam dados inexistentes do produtor

**Evidência:** o primeiro carrier de review pressupunha reviewRef/reviewDigest em comandos legados; o estado de run pressupunha runRef/recipeRef antes de uma admissão ou em análises que usam perfil/skill. Nenhum desses campos pode ser fabricado para atender uma prop.

**Fechamento documental:** component-signatures:SfReviewBinding é a união producer-review/catalog-command. O braço catalog-command usa operationId fechado, SfCommandVersion discriminado em record/admission/none e confirmation discriminada em presentation-only/producer-confirmed-field; não exige campos de confirmação ou versão que o produtor não publique. SfRunIdentity separa unadmitted/run e tarefa routine/analysis. ConfirmSave distingue projeção autoritativa de confirmação sem projeção; a segunda não apresenta o valor editado como atual. Intent e file-selection possuem refs locais distintas de refs de domínio.

**Prova futura:** composições legadas recebem seus próprios carriers; ausência de receipt ou run não produz referência sintética nem preview financeiro calculado no browser.

### CAX-04 — Média — índices mensais incompatíveis com a fonte

**Evidência:** os renderers pinados usam meses zero-based. Um contrato visual 1…12 deslocaria posição/edição mesmo quando o número exibido parecesse correto.

**Fechamento documental:** component-signatures:SfMonthId é 0…11, janeiro=0, cada coordenada é rowRef+month+measure. O campo não é convertido por preferência de apresentação. Os seis blobs foram confrontados pela trilha de UX, sem drift material do pin observado.

**Prova futura:** leitura e edição de janeiro/dezembro conservam as mesmas coordenadas, fonte e unidade do produtor.

### CAX-05 — Alta — componentes S05 eram simultaneamente donos de páginas e de efeitos

**Evidência:** UI51–UI53 exigem leitura/ação A13, mas S05 é componente puro e não recebe client/router/autenticação. A composição original deixava o fetch sem owner legítimo.

**Fechamento documental:** U44 possui as páginas de relations/threads/confirmations e o binding A13; S05 possui apenas componentes/eventos readonly. As 70 primary owners do surface-manifest pertencem a work orders existentes e às respectivas listas surfaces após o split de U38–U47.

**Prova futura:** nenhum import client/hook do host nos componentes S05; U44 faz uma chamada por gesto e mantém identidade/correlação do owner.

### CAX-06 — Alta — dependência do registry completo bloqueava o piloto e recriava um ciclo

**Evidência:** a proposta de importar todos os codecs em F02/registry introduzia F02→15A→F02, apesar de o piloto exigir apenas ctx+A03. O primeiro nome operations.ts também colidia com a propriedade A11 de operações de domínio.

**Fechamento documental:** I00 possui `packages/schema/src/sucafina/operation-registry.ts:SfOperationRegistry`, metadata completa sem imports de famílias. `packages/schema/src/sucafina/index.ts:SfNativeOperationBindings` contém somente codecs reais admitidos no C e é injetado em F02/D01. Falta de binding retorna contract-unavailable antes da rede; não há codec fake. Piloto admite ctx+A03; aceite final exige a cobertura de 305 registros, contando auth/discovery pelos caminhos dedicados. A11 conserva operations.ts.

**Prova futura:** candidato piloto pode integrar sem arquivos/schema de A01/A02/A04…A15; operação não admitida é recusada. Final detecta qualquer key ausente ou extra, sem declarar parcial como completo.

### CAX-07 — Alta — export maps impediram imports públicos planejados

**Evidência direta:** `packages/schema/package.json@faa30fdd` blob adc53ecfa8f4ac83fee37854db2dc0ec2bb9136a tem export map explícito sem wildcard SF; Client blob 4cd0244e98ff18b5e65d3c2808196705095b6691 expõe somente raiz/effect/contract.

**Causalidade:** arquivos certos no disco não tornam `@orchestra/schema/sucafina/...` ou Client equivalentes resolvíveis. O integrador sem permissão de package.json ficaria bloqueado ou usaria import privado.

**Fechamento documental:** I00 ganha apenas os dois package.json exatos; exports explícitos por leaf mais operation-registry/bindings. Nenhum wildcard/dependency/lockfile adicional. CONTRACTS §6.2 dá a alocação dos tipos; RouteMap é público em Schema/context e APP reexporta, nunca Client→App.

**Prova futura:** imports dos entrypoints finais no typecheck normal do pacote. Não foi executado typecheck nesta revisão.

### CAX-08 — Alta — composição F01/F02/S03 escondia ciclo ou perda de draft

**Evidência:** F02 consome tipos de contexto, F01 precisa de transporte e draft real, enquanto S03 inicialmente dependia de ambos como runtime. Uma factory default/mock resolveria somente o build, não a semântica.

**Fechamento documental:** F01 recebe createTransport/createDraft/revalidateDraft por dependências injetadas; S03 tem F03 como runtime prerequisite e usa F01/F02 somente por tipos. O grupo atômico foundation-context-transport qualifica F01/F02/S03 sobre F03. A inspeção das 78 ordens não encontrou ciclo de integração.

**Prova futura:** composição real com transporte, draft e revalidação, sem factory substituta; navegação e auth executadas no owner correto.

### CAX-09 — Alta — Schedule não tinha leitura suficiente para prefill/review de update

**Evidência:** BusinessPorts.schedules.list devolve somente scheduleRef/version/state. Create conhece conditionRef/recipeRef/recurrence/timezone; update recebe nova recurrence/timezone, mas não existe readSchedule no contrato pinado. O ScheduledTask global usa outra fronteira de diretório e não comprova SF/C07.

**Fechamento documental:** porta privada opcional NOVA scheduleDetails.read e seu DTO fechado, sem fingir fonte existente. A09 schedules.read respeita human schedules.read, Request original, revalidação e 404 autorizado explícito. UI66/U34 bloqueia update até detalhe atual confirmado; create/pause/list possuem disponibilidade independente. Per-operation availability torna o estado parcial representável. A entrega de adapter+unavailable não fecha o gate operacional do produtor nem instala engine paralela.

**Prova futura:** binding do produtor autoritativo e leitura sob principal real; update com CAS vigente e caso negativo sem grant. A ausência desse binding permanece bloqueio de qualificação, com owner/gate externo.

### CAX-10 — Alta — remote connection e cleanup dependiam de registry main inexistente

**Evidência:** main/server.ts apenas get/setDefaultServerUrl; ServerConnection.HttpBase com URL/credenciais e lista fica no renderer. Não havia um evento/registry aprovado main suficiente para resolveConnection. Release apenas por bindingHandle também não poderia limpar conexão aprovada antes de bind.

**Fechamento documental cruzado:** D01 possui registerConnection explícito com native confirmation e registry efêmero; não faz discovery/dados pelo novo broker antes do aceite. Connection auth none/basic reutiliza somente credencial global disponível, destinada apenas à origem exata do discovery. authToken/cookie global sem seam fica connection-auth-unavailable. OwnedServe usa startup main confiável. TransportIdentity é nonce aleatório, não hash de segredo. Release possui braço connection{serverKey,projectId,generation} além de binding, mantendo sete métodos/canais. COPY-02 fixa as cinco mensagens e Cancel como default/cancel.

**Prova futura:** cancel não produz rede do broker; renderer não registra destino silenciosamente; troca de credencial/destino invalida geração; release pré-bind remove o registro; credentials não concedem SF grant.

## Limites e condição de encerramento

Nenhum serviço, processo Electron, login, pacote, suite ou CI foi executado. As checagens realizadas foram leitura de fontes e análise de JSON/declarações de planejamento. A investigação parou nos deltas de contrato relevantes dos pins, sem perseguir HEAD indefinidamente.

Persistem gates de produto expressos, não decisões de UI delegadas: autenticação Microsoft real no aplicativo instalado, bootstrap de identidade, autorização por papel, confirmação da porta ScheduleDetails e readiness dos produtores Native41/Relay/Schedule, além da matriz canônica de integração/qualificação. Um planejamento pode fechar seus contratos e ainda não ter essas provas; este relatório conserva essa distinção.

O selo documental final deve usar as versões após as últimas regenerações de work orders (A09 schedules.read, I00 operation-registry/package exports) e o alias único SfOperationId. A checagem estrutural da autoridade do plano é a confirmação final desses três pontos; não tratar um snapshot intermediário deste cruzamento como o arquivo selado.
