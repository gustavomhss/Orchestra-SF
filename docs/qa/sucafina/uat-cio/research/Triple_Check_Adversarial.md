# Revisão adversarial independente — Orchestra-SF

## 12. Segundo triple check adversarial — correções e cobertura real

Esta seção é uma **rechecagem independente da consistência do atlas original**, não um novo aceite de produção. As observações de código usam o commit **`42d344a0efc4d85187388f149c54acac2db171da`**; os CI runs são citados por seus próprios SHAs. Não foi modificada nenhuma branch, código de produto, proteção ou configuração da instalação.

### 12.1 Auditoria de erros encontrados no primeiro atlas

| Ref | Descoberta verificada | Conclusão correta | Severidade para a auditoria |
|---|---|---|---|
| QA-01 | O HTML original exibia somente **4** linhas na tabela pesquisável: 66 das 70 linhas eram parágrafos separados por quebras em branco na geração do Markdown | **CORRIGIDO NO ARTEFATO V2**; DOM parseado com **70** linhas no catálogo e **165** nas rotas | Alta, erro do meu relatório, não do produto |
| QA-02 | `CAP24` estava sem referência `uXX` de E2E dedicado; arquivos `u10.spec.ts` e `u11.spec.ts` não constam da árvore consultada | **LACUNA DE TESTE ESPECÍFICO**; há producer, view, contrato e teste genérico de navegação, mas isso não equivale à jornada do Dashboard de Procurement | Média |
| QA-03 | Catálogo congelado: 305 operações; registro de código: 306 | **EXTENSÃO RASTREADA**: `intelligence.memory-similar-cases`, com implementação e fontes de teste, mas sem PASS hosted confirmado | Média |
| QA-04 | `projection.search` usa `GET` no catálogo planejado e `POST` no registro/host | **DIVERGÊNCIA DOCUMENTAL INTENCIONAL POR PRIVACIDADE**: o host rejeita `GET`/query e usa POST JSON limitado; não reverter para GET só para satisfazer o catálogo antigo | Alta para re-baseline de contratos |
| QA-05 | As seis referências `sourceBinding.blob` para CAP01–CAP28 são históricas e não coincidem com os blobs atuais no candidato | **RECONCILIAR SEMÂNTICA DOS PRODUTORES**; comparar apenas o nome da página não garante os 28 contratos atuais | Alta para afirmação de paridade funcional |
| QA-06 | O teste especializado de UI62 foi omitido do índice simplificado | **CORRIGIDO NO ATLAS V2**: acrescentado `similarity217/ui62.spec.ts` além de `u26` | Média, omissão documental |
| QA-07 | O PR #260 avançou após o primeiro snapshot, mas seu texto ainda descrevia o SHA histórico `1c9011d5...` | **EVIDÊNCIA POR SHA, NÃO POR NOME DA BRANCH/PR**; o CI de um head mais recente exige prova própria | Alta contra falsos PASS |
| QA-08 | O manifesto depende de `CONTRACTS.md`, `SURFACE-SPECS.md`, `SCREEN-INVENTORY.md` e de `docs/sf2h-plan/campaign.json`; esses paths não estão todos autocontidos em `close-final-candidate` | A referência canônica `campaign.json` existe no commit histórico fixado; outros contratos são referências documentais que exigem pin/recuperação externo, não assumir presença local | Média para reprodutibilidade |
| QA-09 | Enquanto a auditoria era executada, a branch `close-final-candidate` avançou de `42d344a0...` para `88e37c1f828...` | O compare confirmou **dois commits e 14 arquivos adicionados**: 12 arquivos de CI/coordenação no primeiro, depois `sf-release.yml` e um teste de contrato de transporte do navegador; sem alterações no manifesto, registro de rotas ou nos seis produtores. O teste adicionado também precisaria de CI próprio. Este atlas permanece um snapshot `42d344...` válido, mas **não deve ser rotulado como HEAD atual** | Alta para rastreabilidade |
| QA-10 | O endpoint GitHub conectado retornou `visibility=public` e `private=false` para `gustavomhss/Orchestra-SF` | **Verificar a intenção de publicação do owner**. É dado de metadados autenticados, não teste anônimo. Não alegar vazamento nem alterar visibilidade sem autorização | Alta **se o repositório deveria estar privado** |
| QA-11 | Uma execução do HTML standalone em Chromium revelou overflow horizontal de **313 px** em tela de 320 px, provocado por caminhos/SHA longos em código inline | **CORRIGIDO NO HTML V2** via quebra de palavras em parágrafos/listas, mantendo blocos `pre` e tabelas roláveis; **12/12 testes Chromium headless passaram**, incluindo busca, reset, filtro CAP24, JS errors e 320/768/1440 px | Média, erro do artefato e UX móvel |

**Nota de QA-04:** ver `apps/cli/src/sucafina-product/native-ui/work.ts` e `native-ui/router.ts` (`NAV-01` rejeita pesquisa em URL). O teste `modules/sucafina/Sucafinav1/test/native-ui-contract/transport.test.ts` demonstra o contrato de POST, mas isso não comprova o ambiente hospedado.

### 12.2 Contratos dos 28 recursos originários — verificação de digest

Os **seis** arquivos antigos eram registrados pelo manifesto em `b10c424a6b318879fc30f11d03ba1cfeffda7d1a`. No candidato atual, o Git tree aponta outros hashes. O conjunto dos exports anteriores foi preservado nos seis arquivos, com novas funções auxiliares publicadas; isso reduz suspeita de remoção de entrada, mas **não valida compatibilidade de campos, comandos, permissões ou efeitos**.

| Producer | Blob histórico | Blob do `close-final-candidate` | CAPs afetados |
|---|---|---|---|
| `runtime/dashboard-budget.ts` | `b64f2f49b42a` | `21e1a63b3a88` | CAP01,03,04,05 |
| `runtime/dashboard-people.ts` | `de499e6d34af` | `c8be36e9eb49` | CAP02,06,07,08 |
| `runtime/dashboard-portfolio.ts` | `20a6cec3713f` | `3b4e54da4468` | CAP09,10,13,14,15,16 |
| `runtime/dashboard-operations.ts` | `a00c93ac1414` | `e9080c809752` | CAP11,12 |
| `runtime/planner.ts` | `17c65e08c833` | `8e0d45b2d298` | CAP17–23 |
| `runtime/procurement.ts` | `20a3ec5a30ac` | `fd7e9dc0e3f3` | CAP24–28 |

A mudança observada em todos os seis produtores acrescenta exports úteis para controles de edição do app nativo, sem remoção dos exports públicos anteriores. Isso **não** deve ser confundido com aceitação de semântica financeira ou autorização.

### 12.3 Cross-check sistêmico realizado em todos os itens do inventário

- **70 superfícies:** 28 `CAP` + 42 `UI`; 15 capítulos; IDs únicos; todas presentes tanto no manifesto quanto no roteador.
- **165 rotas:** igualdade de `surfaceId`, capítulo, tipo e padrão entre as 165 variantes da especificação e o registro de rotas; entradas principais 70/70; nenhum caminho exatamente duplicado.
- **21 sobreposições sintáticas de padrões** (ex.: `/new` versus `/:ref`). O roteador avalia estáticos antes de dinâmicos e os parâmetros exigem `r_` base64url canônico. Não foi demonstrada colisão na resolução válida; não afirmar que o registro por si só prova navegação instalada.
- **70/70 ligações ao catálogo de contratos** resolvem família e recurso; todas têm pelo menos uma operação associada; nenhum `domainCommands` do manifesto aponta para operação ausente no registry.
- **305/305 IDs catalogados** aparecem no registro; **304/305 métodos** coincidem literalmente; uma exceção `projection.search` (GET planejado, POST instalado) tem justificativa e testes de privacidade. Nenhuma divergência detectada nos 305 `pathTemplate` nem no `effect` por comparação de campo.
- **306 operações** no registro de código, com `intelligence.memory-similar-cases` extra. Metadados presentes não significam que codecs, produtores e permissões estejam instalados no ambiente.
- **51 arquivos de jornada nativa** na pasta relevante, incluindo 46 `uXX.spec.ts`; ter arquivo e expectativa é evidência T, não E. Não encontrei arquivo específico `u10.spec.ts` ou `u11.spec.ts` naquele commit.
- **Todas as 70 superfícies têm pelo menos uma referência nos módulos de host/rotas consultados**, incluindo `owner-runtime231.tsx` e famílias de `extended-routes.tsx`. Isso confirma wiring de fonte, não funcionamento com um usuário autorizado.

### 12.4 Jornada por jornada — quarto nível de evidência (execução)

| Jornada | Fonte/contrato (D) | Implementação (I) | Testes existentes (T) | Execução integrada e homologação (E) |
|---|---|---|---|---|
| J01 · Contribuir e retomar | Encontrado | Encontrada | Fontes de teste | **NÃO COMPROVADA**, precisa dupla edição/CAS real |
| J02 · Forecast e cenários | Encontrado | Encontrada | Fontes de teste | **NÃO COMPROVADA**, oráculos e invariantes de cálculo no candidato C |
| J03 · Import com prévia | Encontrado | Encontrada | Fontes de teste | **FALHOU NO PROBE**, OP import HTTP 403/422; verificar producer, origem e dados |
| J04 · Comprar e aprovar | Encontrado | Encontrada | Fontes de teste | **FALHOU NO PROBE** de Decisions/Procurement; confirmar atores e etapas reais |
| J05 · Pauta/review/export | Encontrado | Encontrada | Fontes de teste | **FALHOU NO PROBE**: timeout e abertura sem resposta 200 admitida |
| J06 · Acompanhamento, relações e threads | Encontrado | Encontrada | Fontes de teste | **NÃO COMPROVADA** como jornada multiator completa |
| J07 · Rotinas/IA/scheduler | Encontrado | Encontrada | Fontes de teste | **NÃO COMPROVADA** em run nativo e scheduler de instalação Azure real |
| J08 · UX, acesso e preservação | Encontrado | Encontrada | Fontes de teste | **PARCIAL**, CI com falhas e nenhuma matriz 70×atores×widths concluída |

As palavras **“Encontrada” e “Fontes de teste” não significam PASS**. Os três failures E foram observados em SHA de diagnóstico, não automaticamente no baseline `42d344...`. Uma nova homologação deverá fixar SHA, dados, credenciais, ambiente, run IDs e expectativas para cada jornada.


### 12.4A Snapshot de execução mais recente observado

- **Candidato diagnóstico #260 HEAD `aec42536013f06d518e0cf5053982e319a41199a`:** [workflow `sf-ci` run #43995388263](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43995388263) terminou em **FAILURE, 5/12 jobs verdes, 7/12 vermelhos**. Verdes: `sf/preflight`, `sf/linux-native-omni`, `sf/test-CI-APP-SRC`, `sf/test-CI-ATLAS-BUSINESS`, `sf/test-CI-CLI`. Vermelhos: `sf/static-and-contracts`, `sf/test-CI-SF`, `sf/test-CI-UI-DECISIONS`, `sf/test-CI-UI-OPERATIONS`, `sf/test-CI-UI-REPORTS`, `sf/test-CI-APP-BROWSER`, `sf/verify`.
- **Mesmo SHA `aec425...`:** [workflow `sf-factory-package` run #43995388335](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43995388335) terminou **SUCCESS**, mas continua sendo prova de empacotamento isolada, não go-live funcional.
- **Defeito concreto do static:** `src/orchestra/chapters/sucafina/procurement/requests/title.tsx:45:40`, `TS2345` de chave de tradução `Key` contra união de chaves; o erro anterior em `:298` foi substituído por outro tipo insuficientemente reconciliado.
- **Operations:** `OP-IMPORT-01` recebeu 403 em vez de 200, com log do servidor `file-not-accepted` na admissão; `OP-DOC-01` recebeu 422 em vez de 200. Foram 3 testes aprovados, 2 falharam e a suíte parou em `max-failures=2`; não concluir que o restante passa.
- **Decisions:** uma jornada atingiu timeout de 180 s criando fontes Planner; outra encontrou `503` onde a rota original de Procurement exigia 200. As outras 3 não rodaram por early stop.
- **Reports:** `RPT-01` expirou aos 180 s aguardando o POST de `review-report` e `RPT-02` não recebeu a resposta 200 necessária à abertura da revisão. Duas outras não rodaram.
- **Produto SF:** cinco falhas antes de bail, incluindo source drift em fixture, browser pool indisponível, expectativa 403/observado 404 e expectativa 30/observado 0.
- **App-browser:** continua vermelho; há erros `Expected ready / Received unavailable` e expectativas de elementos. Não atribuir origem específica sem uma triagem independente desse conjunto.
- **PR #260 body desatualizado:** a descrição ainda declara como "Single SHA" o antigo `1c9011d5...` embora o HEAD seja `aec425...`; não usar o texto do PR como prova do SHA atual.
- **Base de go-live `close-final-candidate` observada em `88e37c1f82823d8482051ef279cff433b6f18691`:** avanço de `42d344...` por 2 commits, 14 arquivos adicionados (CI, release e um teste browser), sem mudanças no escopo funcional mapeado. Não há evidência de suite SF completa verde nesse novo base.

Esses fatos são um **snapshot exato de SHAs e run IDs**, não um status imutável de branches que seguem recebendo commits.

### 12.5 Arquivo e renderização do atlas (QA do artefato)

O `build_atlas.py` foi corrigido para não inserir linhas em branco dentro da tabela. O novo HTML foi parseado e conferido com os CSVs. Sua pesquisa atua sobre **uma tabela real com 70 `<tr>` no `tbody`**, e o apêndice tem **165 `<tr>`**. Foi executado também um teste em **Chromium headless com Playwright** usando HTML carregado em memória (o protocolo `file://` era bloqueado pela máquina de teste). **12/12 checks de browser passaram**, incluindo inicialização JavaScript, filtro CAP24, filtro de rotas, reset e ausência de overflow de documento nas larguras 320/768/1440 px. A primeira tentativa revelou overflow de 313 px aos 320 px, corrigido no CSS. Esses testes são **do atlas exportado**, não da aplicação Orchestra-SF. O ZIP final foi submetido a verificação de integridade.

### 12.6 O que ainda impede um triple check absoluto

1. **Revalidar mudanças de produtor:** comparar semântica antiga→atual dos seis arquivos com testes de versões, permissão, formatos, fonte, CAS, import e efeitos.
2. **Executar suites no SHA final C:** nenhuma inferência da presença de código ou de checks verdes em outro SHA; guardar logs, payload sanitizado e comprovantes.
3. **Homologar o tenant real e os perfis distintos:** admin, finance, requester, buyer, approver, viewer e ator sem grant; demonstrar 401/403, negação de referência e revogação durante operação.
4. **Testar jornada de Procurement Overview CAP24 de ponta a ponta** com fixture real, valores corretos e navegação; testes genéricos não substituem essa cobertura dedicada.
5. **Fechar as diferenças de catálogo de forma deliberada**, sem voltar a pesquisa confidencial para GET e sem remover extensões úteis para “igualar contagens”.
6. **Verificar visual/UX e transporte real:** 320/768/1440 px, 200% e 400% de reflow quando exigido, teclado, relatórios com arquivo de fato, perda de resposta, reinício, backup e rollback.

**Veredicto refinado:** a **cartografia estrutural está conferida por múltiplas fontes**. A primeira versão do HTML tinha um erro real e foi corrigida. **Não há evidência que permita atestar todas as funcionalidades e jornadas como operacionais** até a reconciliação de fontes e o CI/homologação completa de um único SHA. Um terceiro leitor pode reproduzir a parte estática usando `qa_validate.py` e os CSVs anexos.

