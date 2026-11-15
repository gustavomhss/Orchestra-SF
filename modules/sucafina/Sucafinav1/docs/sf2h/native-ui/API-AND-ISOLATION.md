# API tipada, autenticação e isolamento

**Proposta de contrato para congelamento antes da implementação dependente.** Nenhum endpoint, schema ou client é criado nesta entrega. Contratos C01–C17 e produtores existentes continuam canônicos.

## 1. Decisão de transporte

A UI será nativa no Orchestra; os dados continuam pertencendo à instalação Sucafina. Criar uma **sub-API tipada sob o mount existente**:

`<origin aprovado><mount>/api/native/...`

Exemplo somente ilustrativo: `https://host.example/sucafina/api/native/context`. O mount vem da configuração publicada da instalação, nunca de input arbitrário da URL. O client usa a conexão selecionada pelo shell e um binding de instalação validado.

### Motivo verificável

Em [runtime/local-identity.ts](https://github.com/gustavomhss/Orchestra-SF/blob/b10c424a6b318879fc30f11d03ba1cfeffda7d1a/modules/sucafina/Sucafinav1/runtime/local-identity.ts), o cookie Microsoft usa **Path=options.mount**, HttpOnly, SameSite=Lax e Secure em HTTPS. `safeReturn` aceita apenas as três superfícies dentro do mount. Uma chamada ingênua à API global `/api/...` não recebe esse cookie; um retorno direto para `/orchestra/...` também não é aceito hoje.

**Decisão:** preservar o path, callback, sessão e fences existentes. A nova sub-API é montada dentro da mesma instalação. Não alargar cookie para `/`, não copiar token para localStorage, não usar auth global Orchestra como substituto da identidade SF e não enfraquecer Origin/CORS.

### Topologia admitida

O piloto requer shell e instalação SF publicados no mesmo origin aprovado pela composição Microsoft atual. Isso é uma condição de implantação a verificar, não uma alteração Azure autorizada. Conexões remotas continuam sendo selecionáveis no Orchestra, mas um binding SF com origin incompatível deve mostrar “Instalação indisponível neste contexto” e não tentar proxy de credenciais.

Suporte adicional a uma topologia cross-origin precisa de design de autenticação próprio e prova do produtor; não será obtido com `Access-Control-Allow-Origin: *`, relaxamento de SameSite ou compartilhamento de cookie. Isolamento entre servidores deve ser comprovado mesmo para conexões cujo SF não está disponível.

## 2. Contratos públicos e client

| Camada proposta | Path de implementação futura | Responsabilidade |
| --- | --- | --- |
| Schema browser-safe | `packages/schema/src/sucafina.ts` e `packages/schema/src/sucafina/*` | DTOs mínimos serializáveis, unions fechadas, IDs/referências existentes; sem serviços |
| Protocol fragment | `packages/protocol/src/groups/sucafina-native.ts` | Métodos, payloads e erros da sub-API |
| Sub-API | `packages/protocol/src/sucafina-api.ts` | Compor somente esse grupo; prefixo relativo `/api/native` |
| Client gerado | entrada dedicada `packages/client/src/sucafina-contract.ts`, geração dedicada e export `./sucafina` | Promise/Effect clients gerados do mesmo HttpApi, baseURL = origin+mount |
| Adapter de apresentação | `modules/sucafina/Sucafinav1/product/native-ui/*` | Projeções e despacho para serviços existentes, sem novo engine |
| Montagem HTTP | `apps/cli/src/sucafina-product/native-ui/*` | Receber Request original, auth, limites, host injection e sub-API no mount |
| Consumption browser | `packages/app-shell/src/orchestra/chapters/sucafina/shared/*` | Client provider, recursos, cancelamento e cache por owner |

Essa é uma **extensão proposta da geração**, não uma capacidade de sub-client já verificada. O build atual de `packages/client/script/build.ts` gera o ClientApi global; N0/N1 acrescentam o alvo dedicado, com exports e geração sob um único dono. Não registrar automaticamente esse grupo na API global do servidor. O grupo é servido somente pela instalação montada.

Nomes de contrato são não versionados (`Sucafina.Context`, `Sucafina.Page`, `Sucafina.Result`), conforme AGENTS de Schema; negociar `contractRevision` no contexto. Não editar `generated` ou `generated-effect` à mão. A execução futura gera e confere os artefatos pelo fluxo autorizado; nada é gerado nesta sessão.

O browser não importa `SfHostServices`, Core, Server ou runtime de módulos. Referências de C01–C17 devem ser projetadas sem redefinir identidade/validação financeira. Não transportar funções, leases, Requests, chaves, snapshots privilegiados ou modelos internos completos.

## 3. Envelope mínimo a congelar

Os nomes abaixo são especificação, não código de produção:

| DTO | Campos necessários | Regra |
| --- | --- | --- |
| Context | contractRevision; installationId; hostId; projectId; server binding; principalRef/displayName; accessRevision; policyVersion; permitted destinations; available capabilities; period/version catalog; login action | Autoridade resolvida no servidor; sem tokens, grupos completos, segredos ou directory privado arbitrário |
| PageQuery | capabilityId; source surface; selectionRef opcional; período/ano/versão; filtros tipados; sort; cursor | Capability allowlist; filtros não concedem acesso; período compatível com capacidade |
| Page | capabilityId; contextStamp; baseVersions; authorized rows/summary; coverage; field/action descriptors; cursor/total autorizado; sourceRefs | `domain.view` e projeções de produto antes de serializar; sem HTML e sem Snapshot |
| Reference | referência opaca tipada existente + tipo + versão/recorte quando exigido | Resolver existência e ACL a cada uso; nome igual não é vínculo |
| Measure | valor/unidade/moeda/origem/cobertura nos tipos canônicos; ausência explícita | Finite/rounding/FX seguem domínio. UI só formata; não reimplementa soma ou cenário |
| Action | id estável; labelKey; disponibilidade; razão segura; expected input/ref/version | Disponibilidade é affordance, não token de permissão; servidor revalida na execução |
| Command | ação permitida por capacidade, recordRef, versões esperadas, payload específico, correlação existente quando suportada | Union por ação, sem `action:string + JSON arbitrário` e sem endpoint execute-anything |
| Preview | preview/manifest/change ref existente; versão-base; efeitos conhecidos; bloqueios/cobertura; fonte | Usar preview/prepare do produtor; UI não simula efeito |
| Result | `ok` ou `needs-input/stale/denied/unavailable/conflict/provider-conflict/failed`; reasonCode seguro; fieldErrors; refs autorizadas | Preservar semântica de PortResult, distinguir auth/session de indisponibilidade |
| ReceiptView | receiptRef/estado/correlação/efeitos realmente emitidos pelo produtor | Não fabricar receipt para comandos que só retornam ok/warnings; nesses, refetch autorizado confirma estado |

`contextStamp` é eco de isolamento/consistência, não bearer token. Uma ação de UI não pode enviar seu próprio principalRef/role/lease para ganhar autoridade. Incluir expectedVersions somente nas formas já definidas pelos produtores; não inventar uma versão global que substitua C06 ou refs de caso.

## 4. Matriz de endpoints proposta

Todos os paths são relativos a `<mount>/api/native`. Sufixos `:ref` são validados conforme o contrato correspondente. GET não muda estado de negócio. Alguns reads protegidos que exigem payload/digest podem continuar POST com semântica read explícita no contrato, sem inventar um GET para contornar admissão.

| Família | Endpoints / métodos propostos | Produtor reutilizado e observação |
| --- | --- | --- |
| Contexto | GET `/context`; GET `/capabilities` | authenticate, roleMap, instalação/projeto, disponibilidade real |
| Projeções das 28 capacidades | GET `/pages/:capabilityId`; GET `/records/:type/:ref` | Domain.view/publicSfData + projeções de produto; detail autorizado |
| Comandos de domínio | POST `/commands/:capabilityId/:actionId` | Domain.execute no transaction/versão atual; catálogo fechado, payload discriminado |
| Trabalho/busca/views | POST `/work/select`; GET `/work`; POST `/search`; GET/POST/PATCH/DELETE `/views/:ref?` | work selections, context search, personalViews; operation key e grants existentes |
| Planner | POST `/planner/preview`; POST `/planner/apply`; POST `/planner/compare` | plannerMonthly, forecast inputs, PlannerPort; não faz cálculo no client |
| Procurement | GET `/procurement/queues`; GET `/procurement/requests/:ref/review`; POST ação tipada | Canonical queue/holder/version, sourcing inputs/compare e decision review |
| Casos | GET/POST `/cases`; GET/PATCH `/cases/:ref`; POST `/cases/:ref/compare` | Case store e mutation ports; editar intenção não aplica domínio |
| Escolha/mudanças | POST `/cases/:ref/choice/preview`, `/choice/record`, `/changes/prepare`, `/changes/:ref/review`, `/apply`, `/reject`; GET `/receipts/:ref` | CurrentChoiceFence, human authority, prepared changes/receipts; M31/MI07 conservados |
| Análises | POST `/cases/:ref/analyses`; GET list/detail/output; POST `/analyses/:ref/cancel` | SfHostServices.analyses, modelo/sessão/Relay reais; nenhuma resposta mock em produção |
| Portfólio | POST catalog/preview/evaluate/selection/reconcile/promote/prepare sob `/portfolio`; GET results/history por ref | Portfolio/coverage/history services; dependência P03 |
| Sensibilidade | POST `/sensitivity/units`, `/evaluate`; GET `/sensitivity/:ref` | Unidades/limites e cálculos existentes |
| BI | POST `/bi/options`, `/bi/select`; GET `/bi/:selectionRef`; POST source/decision resolution | Bi producers; graph e tabela do mesmo resultado |
| Revisões/relatórios | POST `/reviews/selection`, `/reviews/preserve`, `/reviews/compare`; GET review/history; POST export request; GET download admitido | Review/ref/version, fonte/ACL atual, geradores PPTX/DOCX existentes |
| Colaboração | POST operações fechadas sob `/relations`, `/threads`, `/questions`, `/confirmations`, `/hot-topics` | C06, human authority, operação/correlação canônica; sem novo approval layer |
| Imports | GET targets/reference/detail; POST `/imports/admit` multipart, `/preview`, `/:manifestId/apply`; GET receipt | Host de import; limites/formatos/scanner/manifest já existentes |
| Documentos | GET requests/schemas/sources; POST search/admit/extract/confirm; GET candidates/open; POST scenario targets/preview | C14, evidência confirmada; fontes privadas via handler autorizado |
| Memória | POST selection/materiality/outcome; GET catalog/conditions/signals/detail | C13/BCS/Atlas; acesso, cutoff e materialidade atuais |
| Rotinas | GET catalog/admission/run/result; POST prepareAdmission/run/cancel admitidos; schedules create/update/pause/list/readRun | C07/Relay/Schedule; não publicar disponibilidade até readiness |
| Assets/backup | Upload/download/asset-link por referência de registro/versão; comando administrativo backup-import | Handlers existentes de assets/downloads e backup, limites/scanner/papel atuais; sem dump aberto |
| Download/export | GET recurso de download autorizado por ref/versão | JSON/CSV/PO/reports, cache no-store; não URL pública permanente |

O congelamento N0/N1 deve especificar os nomes finais e schema de cada ação concreta antes de UI dependente. Esta tabela fixa recursos, fronteiras e comportamento; não autoriza inventar operações ausentes no produtor. Se a porta não existe, registrar patch pedido ao dono e estado indisponível, não converter o endpoint num bypass.

Para evitar um adapter monolítico, famílias têm arquivos separados sob o mesmo dono inicial de contrato/transporte. Depois do freeze, extension points são interfaces fechadas; alteração pública exige nova revisão/geração e consumer ACK.

## 5. Sequência de uma leitura e de uma escrita

1. Resolver ServerConnection conhecido e instalação/projeto publicados. Remontar o owner quando qualquer eixo mudar.
2. Chamar sub-API dentro do mount com os mecanismos existentes de transporte, sem credenciais vindas de query.
3. No host: manter a proteção de logs externa; validar origin/path/método/limites; `identity.prepare(request)`; autenticar principal Microsoft/local explícito conforme perfil instalado.
4. Admissão SF usa a **Request original**, parâmetros/digest exatos e grants. `TrustedUiContext` usa WeakMap; não é serializável/reconstituível no client nem via um Request sintético.
5. Preparar productView fora do lock quando o produtor assim exige; na transação revalidar roleMap/scope/versões e fazer `current` antes de ler. `finish` em finally. Não segurar lock enquanto chama outro serviço que reacquire o mesmo lock.
6. Leitura aplica `publicSfData` e Domain.view/redaction, ou porta de produto autorizada. Comando executa o produtor com versões esperadas e fences.
7. Só serializar DTO autorizado e headers privados. Ao concluir escrita, respeitar receipt/resultado do produtor e refetch da projeção corrente.
8. Verificar ainda owner/request generation/AbortSignal antes de publicar no UI. Uma resposta atrasada do projeto A nunca aparece no projeto B.

A nova API deve preservar a ordenação já existente em `runtime/application.ts`, `local/entry.ts` e `ui-authority.ts`. Não chamar rotas HTML como se fossem APIs, não parsear DOM e não fazer dump privilegiado seguido de filtro no browser.

## 6. Login Microsoft e retorno ao chapter

Reutilizar `<mount>/auth/login`, callback e logout existentes. B2B conserva principal do resource tenant, membership/grants explícitos e armazenamento privado atual. Não inferir papel por email, nome, tenant de origem ou mera presença de login.

Proposta de bridge de navegação: login recebe um returnTo ainda válido para `<mount>/dashboard?sf=native-return&resume=<opaqueRef>`. Um handler novo **dentro do mount** resolve esse estado de retorno, revalida instalação/ator e redireciona somente para uma rota SF allowlisted no shell do mesmo origin. O estado contém apenas destino/filtros não privados e tem vida curta; não concede acesso. O handler não aceita URL externa, scheme, host ou directory arbitrário. Esta bridge é nova e precisa de revisão do produtor Microsoft; não mudar `safeReturn` para aceitar qualquer path.

Nenhuma mudança em redirect URI Azure, tenant, client secret, consentimento ou política é pressuposta. Até a bridge ser qualificada, retornar ao destino permitido e oferecer “Continuar no Orchestra” com caminho validado é fallback de migração, não o destino final de UX.

## 7. Matriz de isolamento e invalidação

| Eixo / evento | Regra verificável |
| --- | --- |
| Usuário | Todas as leituras, contagens, fontes, sugestões, análises e downloads são autorizados pelo principal atual. Logout/rotação não reaproveita cache de outro principal |
| Papel / assigned domain | Permissão por superfície, registro, campo, operação e holder. Destino visível não é autorização; permissão revogada não sobrevive numa view salva |
| Servidor | Chave da conexão selecionada, origin aprovado e client próprio; sem fallback para outro servidor em erro |
| Projeto / instalação | Binding server-owned, diretório resolvido no host, mesma instalação/projeto em lease e serviço; não aceitar pasta só porque veio da URL |
| Período / versão | Keys e refs contêm recorte; C06 materialidade e versão de approval/case/document permanecem específicas |
| Troca de perfil | Cancelar requests, desmontar projeções e limpar estado sensível antes de novo fetch; manter apenas preferências permitidas |
| Revogação comprovada / logout | Remover conteúdo privado, encerrar runs/continuations conforme produtor, invalidar links e rascunhos conforme política existente |
| 503/timeout/erro de rede | Não classificar como revogação. Manter draft privado no mesmo owner ainda autorizado e identidade de operação pendente; consultar estado, sem replay automático |
| Conflito/stale | Preservar edição local autorizada, mostrar base/atual/draft, nova prévia ou escolha; nunca overwrite silencioso |
| Expiração de sessão | Bloquear acesso e reautenticar; só restaurar estado privado após revalidar mesmo principal/escopo e retenção permitida. Não persistir draft sensível em storage comum |
| Mutação com resposta perdida | Consulta de receipt/status por identidade existente; retry explícito e idempotente apenas se produtor oferece essa garantia |
| Fonte alterada/revogada | Revalidar documento/versão/digest e seleção; analisar novamente só com autorização; não usar cache de fonte obsoleta |

## 8. Erros, segurança e observabilidade

HTTP status acompanha o erro tipado: 400 input, 401 sessão quando identificável, 403 denied, 404 existência não revelável quando aplicável, 409 stale/conflict/provider-conflict, 413 limite, 503 unavailable. Um erro sem prova de revogação não purga rascunho por conveniência. A razão pública deve ser segura e traduzível; campos de diagnóstico ficam no servidor.

Manter limits de JSON, workbook, upload, parsers/scanner e cancelamento. `Cache-Control: no-store`, nosniff e política de referrer para material privado; nenhuma resposta privada no service-worker cache. Logs redigidos devem preservar a proteção Microsoft49 antes do roteamento, inclusive query OAuth. Métricas podem registrar duração/família/status/correlation ID seguro, nunca salário, documento, prompt, código OAuth ou cookie.

CSRF/origin e admissão humana continuam necessários em mutation. UI pré-carrega somente chunks e leituras permitidas; hover de sidebar não inicia análise, import, geração ou mutação.

## 9. Freeze obrigatório antes de paralelizar UI

N0/N1 entregam um pacote revisável com DTOs e exemplos sintéticos de sucesso/parcial/erro, route manifest, action unions, binding mount/cookie/return, semântica de owner/reset, versionamento e proof obligations. Consumidores confirmam o mesmo revision/digest.

O piloto valida leitura e uma ação real sob papéis separados. Se cookie/topologia ou admission bloquear, o achado volta ao produtor competente; os demais chapters podem desenvolver composição contra contrato congelado, mas não recebem aceite de integração por fixture.

## Reconciliação do contrato de leitura em C28

A inspeção de encerramento incluiu o pacote Reports48 composto em `d088708276b48f896ad4e0ecd2a95cb73dc413b1`, ainda sob qualificação HOLD. Os hooks `revalidateReadEvidence`/`revalidateReadAccess`, a distinção entre `denied`, `stale` e `unavailable` e a recuperação de discussion client são responsabilidades do produtor. O adapter nativo deve preservar esse resultado, inclusive falha sem prova de revogação; não converter todas as falhas em 403 nem inferir acesso a partir da retenção do draft. Os pins, limites e o finding separado de Agenda39 estão em [MIGRATION-AND-HANDOFFS](MIGRATION-AND-HANDOFFS.md).
