# Mission25 — Reports instalado / PR27

## Estado terminal desta entrega

**Código próprio comitado; proposta compartilhada completa entregue; quatro E2Es nominais `NOT_RUN`.**

Esta entrega continua `astra-wp07` / PR27, ator S3-A, lease `reports-browser25`. O head observado `dbc5e803050052909316562ad4c1dc579f5f453a` foi preservado como ancestral direto da sequência abaixo. Não houve reset, force push, merge, outra PR de produto, edição de Memory/Decisions ou ampliação de grants.

A composição foi examinada novamente. Ela **já contém agenda, ReviewApplication e produtores de Collaboration**. Os problemas concretos são a passagem do formulário real de Reports para a preparação da agenda, a vinculação dos callbacks C05 ao host de Collaboration e a montagem da nova discussão na reunião. Essas mudanças atingem host/router compartilhados: estão propostas integralmente neste recibo para a sessão23, sem serem aplicadas por esta missão.

Na publicação inicial dos recibos (`df204294fe0778db95c70a66ef4715487badeb00`), a composição conferida era `sf2-stack@0d5bd54a109774d4e3296e00c276be341fe39b00`, tree `c056602b26eb044fe5e2e18a5a05bd2bd2d5a83a`. Depois dela, foi reconferido o avanço para **`402a091485e11d60dff433049c7dedd7fcead687`**, tree `006339cc3a61de9bf99d2ba17069181bd5d8a02e`. O ACK 04 acrescenta Portfolio21 e assembly parcial de Operations24; os ACKs 01–03 continham C12, Finance, Memory e Decisions. Nenhum registra consumo de Reports25. Os novos helpers compartilhados e os dois componentes próprios continuam ausentes na composição. [COMPOSITION.json](COMPOSITION.json) preserva a primeira leitura e [COMPOSITION-C4.json](COMPOSITION-C4.json) registra a reconciliação posterior: as preimages relevantes continuam idênticas. Não existe W de composição aceito, S ou run dos quatro nominais nesta entrega.

## Commits de produto e preservação de história

| Identidade | SHA | Parent | Conteúdo |
|---|---|---|---|
| W1 | `567727670b4039c316a12718c84b43b57f4fa19d` | `dbc5e803050052909316562ad4c1dc579f5f453a` | Cliente/view de discussão C05, região acessível de reunião e cinco arquivos E2E |
| W2 | `bc587cebc9f2e46e48a3e828b83fe15cfaf2fc45` | W1 | Export público do browser e inclusão dos dois módulos novos no teste de empacotamento existente |

W2 usa a tree `fb3b512c69f249960bd768aef723425d5e2d6740`. O commit que contém este handoff acrescenta somente recibos; o candidato efetivamente verificado pelos checks permanece W2. As dez postimages próprias foram conferidas contra os blobs publicados. [PRODUCT.json](PRODUCT.json) contém paths, hashes, tamanhos, commits e URLs.

## Implementação própria

`collaboration-client.ts` usa os endpoints reais existentes, cookies da mesma origem, `no-store`, CAS e chaves de idempotência por ação. Descarte aborta requisições pendentes. Não cria Request autenticado artificial, autoridade positiva de fixture ou retry automático de mutação.

`collaboration-view.ts` permite selecionar seção/fonte/destinatário, perguntar, responder, inspecionar a projeção capturada e o pin C05, confirmar exatamente a observação preparada, reutilizar a resposta, editar a própria mensagem e consultar a versão histórica original. A interface apresenta os detalhes antes da confirmação e conserva seletores de thread/mensagem/encarnação/versão na URL, sem texto privado. O principal informado ao browser é somente affordance de edição; a autorização continua nos produtores reais.

O export público de `browser.ts` torna a view e seu cliente alcançáveis pelo grafo real usado por `tsgo`. O teste existente de browser verifica os quatro pontos de entrada `browser`, `workspace`, `collaboration-client` e `collaboration-view`, incluindo ausência de dependências e globais de runtime do servidor.

### Quatro jornadas nominais implementadas, ainda sem execução

| Caso | Assertions preservadas/fortalecidas | Resultado |
|---|---|---|
| RPT-01 | Entrada pelo formulário real; três tópicos; reordenação; 25 projetos; notas longas até o final; origem anual 1320→1400 por edição/previsão/confirmação real; captura permanece 1320; DOCX/PPTX privados; reunião reaberta e navegação à origem atual | `NOT_RUN` |
| RPT-02 | Pergunta/resposta pela UI; pin, projeção, encarnação e versão exatos; inspeção e confirmação humana C05; reuso após reload sem nova escrita; edição invalida reuso anterior; leitura histórica mantém resposta original | `NOT_RUN` |
| RPT-03 | Remoção de uma referência opaca autorizada; 25→24 sem alterar registros de origem; preparação e preservação de nova revisão somente após ações explícitas; revisão anterior imutável | `NOT_RUN` |
| RPT-04 | Sign out real; remoção completa da reunião/discussão/navegação privadas; credencial antiga negada; nova admissão legítima do mesmo operador reabre revisão/resposta e baixa o mesmo DOCX com SHA256 igual; credencial antiga continua negada | `NOT_RUN` |

[e2e-implementation.json](e2e-implementation.json) identifica os títulos completos, helpers e assertions. Chamadas diretas restantes verificam readbacks e casos negativos; as mutações humanas obrigatórias percorrem controles reais. Não foram acrescentados sleeps, skips, retries de mutação, timeouts maiores ou fixtures positivas. A remoção da navegação inteira após revogação é uma exigência mais forte que conservar botões desabilitados; as negações HTTP e os checks de conteúdo continuam presentes.

## Pacotes consumíveis pela sessão23

Todos os arquivos abaixo são **propostas inertes** dentro deste recibo. Preimages e postimages integrais têm sufixo `.txt` para não entrar no grafo TypeScript. Os headers dos patches apontam para os paths reais.

| Pacote | Escopo | SHA256 do patch |
|---|---|---|
| [Host/router/browser](shared/manifest.json) | Seis arquivos modificados e dois novos helpers de vinculação C05 | `42cce7c5b42604636c77584e6e86f5594a2a1fa1b6d265f9fc16c7a028f78f47` |
| [Grafo E2E](shared-typecheck/MANIFEST.json) | Inclui somente Reports spec e support no `e2e/tsconfig.json` existente | `9d8e1bb084485cc951d449d8dac161fbfc3700b7ca9d48f9611d506bf09ab6bb` |
| [Compatibilidade dos arquivos próprios](owned-assembly/MANIFEST.json) | Dois hunks: nome acessível de reunião e export público, sobre as versões atuais compostas | `f0cdd891ad1e1756265da7939c5fe846b1798a5afbbb8dc57e7eb7c3bf9f80a0` |

O patch compartilhado conecta o formulário Generate Report à descoberta real de cada tópico, conserva ano/ordem/seletores e atribui IDs estáveis `report:<page>`. A descoberta usa localmente `id: "dashboard"`; concatenar esses IDs faria a agenda recusar tópicos duplicados. Os títulos corretos continuam `Budget`, `Projects`, `Hot Topics`; não foi preciso alterar assertions para nomes de discovery.

A vinculação C05 usa ReviewApplication, threadContext e createReviewAnswerSource reais, com revalidação e comparação de identidade de Request, owners e métodos dos providers. A lease protegida deste adaptador é limitada a revisões simples de registros Dashboard. Dependências externas, comentários capturados, decisões, cálculos, documentos ou fontes de outro domínio exigem a autoridade protegida do produtor correspondente e continuam recusadas quando ausentes.

O adapter de histórico obtém a referência atual pelos resolvers canônicos e a reautoriza, preservando projeção, fonte e recibo capturados. O browser reconhece 401/403 e o redirect real de mesma origem para `/auth/login`; um fetch pode seguir o 303 e terminar em HTML 200. Falhas genéricas de rede ou 5xx não são tratadas como revogação.

Título e formato solicitados no formulário são metadata de bootstrap. O contrato C05 de geração não recebe título: **não há declaração de título customizado nos bytes exportados**.

As seis preimages compartilhadas, `meeting.ts`, `browser.ts` e o config E2E foram reconferidos em `0d5bd54a…`, sem diferenças em relação às imagens fornecidas. A sessão23 deve conferir novamente no seu head real. Os arquivos atuais de reunião/browser contêm trabalho concorrente C06; consumir somente os dois hunks de compatibilidade, sem substituir os arquivos completos pelas versões antigas de `astra-wp07`.

## Actions executados e resultados

| Execução | W / S | Run / job | Resultado efetivo |
|---|---|---|---|
| Check próprio W1 | W=`56772767…`; S não se aplica ao workflow direto | [43640138913](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43640138913) / `132585681543` | Workflow `FAILURE`; typecheck 137 erros externos; guards PASS; geração de exports PASS. O novo client/view ainda não era alcançável no grafo. |
| Check próprio W2 | W=`bc587ceb…`; S não se aplica ao workflow direto | [43640600856](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43640600856) / `132587110097` | Workflow `FAILURE`; mesmos 137 erros externos, zero diagnóstico próprio, agora com cadeia de imports alcançável; guards PASS; geração de exports PASS. |
| Empacotamento, pedido inicial | W=W2; S=`00fd9405f4637ddfd57b920ce62636a5cd740f00` | [43640961318](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43640961318) / `132588210719` | `FAIL_INFRA_REQUEST`: seletor `modules/sucafina` recusado antes dos testes; zero caso executado; Omni não alcançado. |
| Empacotamento, pedido corrigido | W=W2; S=`4bea121031aac61fb2f3e3b46f7e56587ee9919b` | [43641126816](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43641126816) / `132588718977` | `PASS`: 4 casos de browser bundle, 0 falhas, 20 assertions, 184 ms. Um nonce e um verdict Omni correspondente `not applicable` para seleção sem spawn declarado. |
| Reports instalado nominal | W de composição não aceito; S ausente | Nenhum run/job | Quatro casos `NOT_RUN` |

Os 137 blocos completos de diagnóstico em 46 arquivos são idênticos, inclusive ordem e localização, ao baseline `dcde7253…`, run `43537045211` / job `132268446934`. SHA256 normalizado: `9d3b2386ade78a32e57868dfd7702bcd831641d8cc44c97d15dd7bae2daff499`. Isso não transforma o typecheck em PASS. Os guards de W1/W2 registram 78 regras, 665 paths, zero gate, 12 warnings e zero erros.

Os snapshots S possuem parent W2 e somente `.ci-run.json` de delta. O segundo pedido omite o seletor de diretório incorreto e usa o alias registrado `sucafina`; não alterou código, resolvedor, workflow, assertions ou timeout. Cada dispatch ocorreu após deduplicação do candidato/pedido e conclusão do anterior. Nenhum teste de produto, typecheck, build, servidor ou browser foi executado localmente.

[RUNS.json](RUNS.json) registra W/S/trees, hashes de pedido, pins do dispatcher, jobs, artefatos e limites. [checks/EVIDENCE-INDEX.json](checks/EVIDENCE-INDEX.json) identifica os logs integrais. As comparações de typecheck e os 137 diagnósticos estão no mesmo diretório.

## Evidência, privacidade e critérios abertos

O spec desliga trace, vídeo e screenshot para evitar persistir cookies/credenciais de sessões reais. A precedência de `test.use` foi conferida nas fontes oficiais da versão efetiva Playwright 1.59.1. O estado antigo de autenticação permanece somente em memória; arquivos privados de instalação ficam fora da árvore de artefatos do Playwright. Nenhuma credencial, storageState, código de admissão ou banco privado foi incluído nos recibos.

Os artefatos dos checks contêm geração sintética de DOCX/PPTX, com IDs, tamanhos e digests registrados. Esta missão **não renderizou esses novos arquivos**. Extração OOXML verifica conteúdo/ordem, não clipping, paginação visual ou execução nativa. A evidência histórica de 85 imagens renderizadas permanece vinculada ao W/run anterior e não é transferida para W2 ou para uma composição futura.

[CRITERIA.json](CRITERIA.json) preserva os **86 IDs e textos canônicos**, seu mapping estático atual, lacunas e status de execução `NOT_RUN`. Nenhum critério foi promovido a PASS por checks de fonte ou empacotamento. Permanecem, entre outros, comparação completa, revogação seletiva de Talent, destinatário distinto com identidade/ACL reais, dependências C05 externas, paridade UI/native/MCP, renderização visual e medidas humanas.

O perfil instalado disponível admite uma pessoa. Nova admissão cria outra sessão do mesmo operador e é adequada ao cenário de revogação de sessão; não prova um segundo destinatário. O shared adapter exige provider real de destinatário distinto e acesso real dessa pessoa à mesma C05 e às fontes; cadastro no diretório ou autorização do caller não satisfazem isso. Não foram fabricadas identidades ou permissões.

## Próximo passo exato

[ACK-REQUEST.json](ACK-REQUEST.json) solicita à sessão23 consumo dos deltas próprios e dos três pacotes, com publicação do **W/tree/blobs reais e ACK de assembly**. A sessão23 não recebe autorização de dispatcher/CI por este recibo.

Após esse ACK, o dispatcher WP07 já autorizado deve reler o candidato composto, verificar fontes/config/fixtures e dependências, deduplicar, criar um **S exclusivamente de request** sobre esse W e executar somente [ci-request.json](ci-request.json): `e2e/sucafina/reports.spec.ts`, config de produção existente, um worker, zero retries e uma repetição. O config E2E também requer typecheck hospedado pela rota cirúrgica já autorizada; o check próprio desta PR não executa `typecheck:e2e`.

Somente resultados dessa execução e de seus artefatos poderão alterar o estado das quatro jornadas. Até lá, esta entrega permanece **implementada nos paths próprios, assembly compartilhado proposto e jornada instalada não aprovada**.
