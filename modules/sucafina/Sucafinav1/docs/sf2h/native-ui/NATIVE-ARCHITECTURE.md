# Composição nativa no Orchestra

Estado: arquitetura proposta. Leitura abrangente fixada em C27, com contratos de classificação de leitura/rascunho Reports48 reconciliados em C28; arquivos e blobs em [SOURCE-BASELINE](SOURCE-BASELINE.json). O objetivo é substituir a camada de apresentação independente e conservar motores e semântica.

## 1. O que existe e o que precisa mudar

| Âncora real | Observação de código | Adaptação proposta |
| --- | --- | --- |
| `packages/app-shell/src/orchestra/navigation.ts` | primary/advanced/settings, labels i18n, breadcrumbs, maestro dialog e search command | Perfil de navegação SF acrescenta grupos/15 IDs; mantém lookup plano para breadcrumb e destinos técnicos |
| `.../chapter-route.tsx` | `chapterPages` lazy, `ChapterPageProps={server,directory}`, owner selecionado, SDK/sync/models, Boundary/Suspense; lista serverWide | Registrar cada chapter SF; resolver binding de instalação/projeto antes do consumo. SF não entra em serverWide para escapar da seleção |
| `.../sidebar.tsx` | Uma aside, grupos, ícones, active state, tooltip, preload, perfil servidor/projeto no rodapé | Reusar a mesma estrutura, mapear ícones existentes e grupos. Expandir grupo ativo. O perfil SF é configuração da instalação, não grant client-side |
| `packages/app-shell/src/app.tsx` | Providers de tema/paleta/i18n/dialog/query e rota `/orchestra/:chapter/*rest`; routes explícitas de servidor | Manter root/provedores montados. Estender resolução de owner/deep link e entrada Hoje de instalação SF; sem root app paralelo |
| `.../chapters/kit.tsx`, `kit.css` | MxPage/MxBadge/MxToggle; largura normal 1020px | Reuso de cabeçalho/estados; variante local de canvas amplo e compacto nos chapters SF |
| `packages/ui/src/v2/components/*` | Primitivas SolidJS reais, CSS/tokens do sistema | Reutilizar componentes; compor tabela/grid/comparação SF que ainda não existem como widgets prontos |
| `modules/sucafina/Sucafinav1/index.ts` | 16+7+5 páginas e contribuições de domínio/render | Preservar registro e domínios; a nova apresentação não altera essa contagem canônica |
| `runtime/application.ts` | produto HTTP antes de lock; productView/current/finish; actor/roleMap; domain.view/publicSfData; execute | Expor DTOs por seam dedicado mantendo ordem/fences/transactions. Não obter dados de render() |
| `src/screen-shell.ts` | HTML/CSS independente das três superfícies | Permanece fallback transitório; não é embutido nem reestilizado como “native” |
| `local/entry.ts` + `apps/cli/src/sucafina-product/installation.ts` | Composição de persistência, auth, host, produtos e transport privacy Microsoft | Montar sub-API dentro do mount existente, serviços injetados e login preservado |

## 2. Estrutura de chapter e ownership

Novo subtree proposto: `packages/app-shell/src/orchestra/chapters/sucafina/`.

O registro lazy aponta diretamente para entrada própria de cada área. Um `SfContextProvider` compartilhado, abaixo dos providers existentes, recebe server/directory já resolvidos e installationId/projectId verificados. Ele não substitui o SDK do shell nem cria outro Theme/Language/Dialog provider. Resolver deeplink explícito antes de usar a seleção persistida evita montar por um instante dados do perfil errado.

`chapter-route.tsx` hoje usa chave server/directory. O owner SF adiciona instalação, projeto e principal ao ciclo de dados. A resolução deve ser atômica: contexto desconhecido mostra estado de seleção, não dispara leitura de domínio. A troca de owner cancela recursos anteriores; a seleção visual do sidebar acompanha apenas a rota efetiva.

`ChapterPageProps` atual não contém projectId ou installationId. A implementação precisa de um resolver SF no integrador, não de supor que directory é identidade suficiente. O servidor confirma a correspondência e não aceita um directory livre em query.

### Módulos de apresentação propostos

| Composição | Responsabilidade | Não possui |
| --- | --- | --- |
| SfContextProvider / SfClientProvider | Owner, contexto/admissão de destino, client montado, revision e cancelamento | Papéis autoatribuídos, tokens de provider, engine |
| SfPageFrame | MxPage, contexto, tabs, densidade/largura, estado | Segunda sidebar ou tema |
| SfQueryState | loading/empty/error/partial/access-loss com retry de leitura | Conversão de erro para lista vazia |
| SfRecordTable | Colunas autorizadas, sort, paginação, seleção, ações e acessibilidade | Agregação financeira ou ACL no browser |
| SfMonthlyGrid | Edição por célula/linha, navegação APG, marcação de ausência/herança, draft | Cálculo de outlook, FX, spread/reset local |
| SfObjectDetail | Cabeçalho, seções, campos, fonte/histórico, deep link | Duplicação da entidade |
| SfChangeReview | Base/atual/proposta, escopo/versão, bloqueios e confirmação explícita | Aprovação implícita ou Apply de draft não admitido |
| SfEvidencePanel | Fonte/recorte/cobertura/ref/versão e links revalidados | Dump de documento ou source privada sem ACL |
| SfContextActivity | Perguntas/relações/confirmações/recibos | Novo motor de tarefas, aprovação ou auditoria |
| SfChartFrame | Título/pergunta/unidade/cobertura, gráfico e tabela equivalente | Motor BI financeiro |
| SfRunState | Receita/modelo/execução real, progresso/needs-input/cancel/failure | Simulação de readiness ou resultado do agente |

Essas composições **são novas propostas SF**, não componentes já localizados em `packages/ui`. Mantê-las locais até existir reuso real em outro módulo; não aumentar a API global do UI prematuramente.

## 3. Primitivas reais reutilizadas

Import paths abaixo seguem os exports observados de `@orchestra/ui`; confirmar nomes exportados ao implementar, sem criar aliases especulativos.

| Necessidade | Componente / âncora atual | Aplicação |
| --- | --- | --- |
| Ação/ícone | `@orchestra/ui/v2/button-v2`, `icon-button-v2`, `@orchestra/ui/icon` | CTA, toolbar, expansão e menu; ícones reais, não Unicode improvisado |
| Formulário | `field-v2`, `text-input-v2`, `textarea-v2`, `select-v2` | Labels, ajuda, erro, moeda/versão/pessoa com opções autorizadas |
| Views/filtros | `tabs-v2`, `segmented-control-v2` | Vistas irmãs, status e modo de leitura/edição |
| Estado | `badge-v2`, `loader-v2`, `progress-circle-v2` | Texto + sinal semântico, loading por seção |
| Modal | `dialog-v2`, DialogHeader/DialogTitleGroup; provider existente | Revisão curta; ação de foco/fechamento consistente |
| Menu/tooltip | `menu-v2`, `tooltip-v2` | Overflow e ajuda de ícone, nunca conteúdo essencial somente em hover |
| Seleção | Checkbox existente, `radio-v2`, `switch-v2` | Escolha explícita e toggles admitidos |
| Feedback | wrapper `showToast` existente / `toast-v2` | Falha de ação e sucesso confirmado; mensagem i18n |
| Layout | MxPage, MxBadge, ScrollView/ResizeHandle quando adequados | Cabeçalho, superfícies, rolagem/painel no shell |
| Perfil | Composição existente de sidebar/ProjectAvatar | Mesmo servidor/projeto do shell com vínculo SF confirmado |

Não foi localizado um DataGrid financeiro ou biblioteca de charts de negócio pronta em packages/ui. Escolher uma dependência externa futura, se indispensável, exigirá avaliação separada de SolidJS, bundle, acessibilidade e manutenção; não está pressuposto neste plano. SVG/chart primitivo pode apresentar DTO calculado sem reproduzir regras.

## 4. Tema, i18n e desempenho

- Reusar ThemeProvider, OrchestraPaletteProvider, Font, LanguageProvider e UiI18nBridge em `app.tsx`.
- Todas as strings — inclusive erro, vazio, tooltip, aria-label, status e plurais — entram nas APIs tipadas. Cada fatia tem arquivo i18n exclusivo; integrador altera apenas registros compartilhados.
- Campos numéricos formatam por locale e moeda do DTO; parser não altera precisão/unidade do contrato. Não concatenar frases ou decidir gramática no JSX.
- Preferir `createStore` para o estado coordenado de filtros/draft/seleção. `createResource.error` tem branch visível; não catch→undefined para falha solicitada pelo usuário.
- Lazy load por chapter; hover/focus apenas preloads de chunk. Partes pesadas como grid, comparação e export não entram no bundle inicial de todos.
- Reads paginados e canceláveis; consulta não retém snapshot global. Não mascarar custo do runtime C27 com cache client que ignore accessRevision/versão.
- Medir no piloto tempo de troca de chapter, abertura de detalhe, edição e memória em corpus normal/adverso/volume. Não declarar orçamento de latência alcançado sem baseline.
- Paletas geradas seguem o fluxo existente. Não editar geração nem modificar cores globais para acomodar uma única área.

## 5. Topologia de consumo

```mermaid
flowchart TD
  A["Sidebar e rota Orchestra"] --> B["Owner SF e client tipado"]
  B --> C["Sub-API no mount existente"]
  C --> D["Identidade e admissão SF"]
  D --> E["Adapter de apresentação"]
  E --> F["Domínios e BusinessPorts"]
  E --> G["Produto: casos, BI e reviews"]
  F --> H["Persistência e recibos atuais"]
  G --> H
  G --> I["Relay, Schedule e Atlas admitidos"]
```

A dependência runtime do browser termina em Schema/Protocol/Client. O host injeta serviços reais; nenhuma seta autoriza mover engines para app-shell ou instanciar uma segunda instalação.

## 6. Composição HTTP: riscos concretos

A nova montagem fica após o preparo de identidade e antes da seleção do renderizador legado, com privacidade de transporte ainda externa. A handler chain atual (runtime.productHttp, workbench, BI) deve receber uma ordem explícita para o subpath native, sem capturar downloads/auth legados por engano.

O adapter expõe projeções demandadas, não a coleção inteira de snapshots. Onde a projeção atual está amarrada ao renderizador, extrair somente a forma pública necessária dentro da fronteira de domínio, com review do dono. Não chamar `render` para obter JSON, não extrair estado de tags script e não importar Core em Schema.

Acesso de produto preparado fora de lock e validado novamente dentro dele deve ser preservado. Microsoft logout concorrente, source-lifecycle, CurrentChoiceFence e o custo/cópia fresca de Runtime56 não são simplificados para facilitar o frontend.

## 7. Definition of native parity

A área só é nativa quando: existe no registry da sidebar e do chapter; abre direto/reload/back; usa os providers do Orchestra; opera sob owner correto; obtém DTO autorizado de serviço real; conserva comandos/efeitos/recibos; usa componentes/tokens/i18n reais; tem estados e navegação por teclado; e satisfaz as jornadas aplicáveis no mesmo candidato.

Uma página bonita com mocks, um iframe, o HTML antigo em innerHTML ou um link externo não satisfazem esse aceite.
