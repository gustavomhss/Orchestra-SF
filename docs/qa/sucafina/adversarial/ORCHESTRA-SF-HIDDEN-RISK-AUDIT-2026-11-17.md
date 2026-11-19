# Orchestra-SF — auditoria adversarial de riscos ocultos

**Data:** 2026-11-17  
**Repositório:** `gustavomhss/Orchestra-SF`  
**Base revisada:** `close-final-candidate`  
**SHA fixado:** `dd378ad2ac14dff3559aa3aa546e6d87b43140c8`  
**Tipo:** revisão adversarial estática, multifocal e independente  
**Escopo desta entrega:** disponibilidade, exaustão, concorrência, manutenção, lifecycle e fronteiras de ingresso  
**Fora do escopo deliberadamente:** repetir falhas de CI, jornadas e PRs já conhecidos; alterar produto, testes, CI, Azure ou release

## 0. Limites de evidência

Esta revisão separa explicitamente três estados:

- **CONFIRMED_STATIC:** o caminho causal está presente no código fixado e não depende de interpretação de narrativa de PR.
- **DYNAMIC_NOT_RUN:** o caminho estático existe, mas a severidade operacional precisa ser medida por teste executado.
- **INFERENCE:** consequência derivada da composição de caminhos estáticos; deve ser confirmada por fault injection ou teste concorrente.

Nenhum teste local, build, typecheck, workflow, deploy, benchmark ou fault injection foi executado nesta missão. Nenhum finding abaixo deve ser promovido a “incidente observado em produção” sem reprodução. Em sentido oposto, ausência de reprodução nesta missão não elimina o caminho causal documentado.

## 1. Resumo executivo

A auditoria encontrou **nove riscos não equivalentes aos bloqueadores conhecidos de CI**:

| ID | Severidade | Estado | Área | Síntese |
|---|---:|---|---|---|
| `ADV-PARSER-001` | P1 | CONFIRMED_STATIC / DYNAMIC_NOT_RUN | Documentos | Dois workers que não terminem o boot podem consumir permanentemente os dois slots globais do parser até reinício do processo. |
| `ADV-PARSER-002` | P2 | CONFIRMED_STATIC / DYNAMIC_NOT_RUN | Documentos | PDF de até 20 MiB é copiado entre host e worker e novamente por `slice()`, com dois workers globais e sem orçamento RSS comprovado. |
| `ADV-IMPORT-001` | P1 | CONFIRMED_STATIC / DYNAMIC_NOT_RUN | Ingresso HTTP | Multipart de aproximadamente 16 MiB é totalmente recebido e parseado antes da admissão/autorização da operação. |
| `ADV-BACKUP-001` | P1 condicional | CONFIRMED_STATIC / DYNAMIC_NOT_RUN | Backup/SQLite | Capture mantém `BEGIN IMMEDIATE` durante cópia, hash, verificação, `fsync`, rename e prune; operações concorrentes têm timeout padrão de 5 s. |
| `ADV-JOBS-001` | P1 condicional | CONFIRMED_STATIC / DYNAMIC_NOT_RUN | Scheduler | Um ciclo maior que o intervalo pode gerar reruns imediatos contínuos pelo mecanismo `pending`, sem intervalo de recuperação. |
| `ADV-JOBS-002` | P2 | CONFIRMED_STATIC / DYNAMIC_NOT_RUN | Scheduler | Cada ciclo lista duas vezes cada superfície; cada listagem reverifica integralmente todos os snapshots e blobs retidos. |
| `ADV-BACKUP-002` | P2 | CONFIRMED_STATIC / INFERENCE | Integridade observável | Arquivos corrompidos são silenciosamente omitidos por `list()` e ignorados por `prune()`, podendo não degradar o status de manutenção. |
| `ADV-BACKUP-003` | P2 | CONFIRMED_STATIC / INFERENCE | Disco/lifecycle | Queda do processo durante capture pode deixar `.stage-*` completos; list/prune ignoram esses nomes e não há scavenger neste módulo. |
| `ADV-LIFECYCLE-001` | P2 | CONFIRMED_STATIC / DYNAMIC_NOT_RUN | Shutdown | Jobs e store aguardam operações ativas não canceláveis; I/O de backup lento ou preso pode prolongar shutdown/cutover indefinidamente. |

### Relevância por perfil

- `ADV-PARSER-*` e `ADV-IMPORT-001` pertencem ao grafo de produto e são relevantes para uma instalação Microsoft quando essas rotas estão montadas.
- `ADV-BACKUP-*` e `ADV-JOBS-*` são **mais diretamente acionáveis no perfil `local-operator`**, porque a instalação chama `createLocalJobs(..., schedule: !!operator)`; o scheduler automático fica desativado no perfil Microsoft atual. Isso reduz a exposição automática na Azure Microsoft, mas não qualifica o mecanismo para local/operator nem elimina chamadas manuais ou futura ativação.
- Esta revisão não reclassifica o gap já conhecido de scheduler corporativo Microsoft; documenta riscos internos do scheduler quando ele estiver ativo.

---

## 2. Trilha A — exaustão e recuperação do parser

### ADV-PARSER-001 — slot global pode ficar preso para sempre

**Severidade:** P1  
**Confiança:** alta no caminho estático; reprodução não executada  
**Blast radius:** todas as instalações que compartilham o mesmo processo/módulo

#### Caminho causal

1. O módulo declara `active` e `maxActive = 2` fora da factory. Criar outro parser/host não cria capacidade independente.
2. O slot é adquirido antes de criar/inicializar o worker.
3. O worker só anuncia `ready` depois de carregar o grafo do formato:
   - DOCX: `docx.ts`, `jszip`, `saxes`;
   - PDF: `@orchestra/rag-studio/extract`, `unpdf` e `getResolvedPDFJS()`.
4. O timeout de boot retorna `document-parser-start-timeout` ao caller.
5. Nesse caminho, o worker **não é terminado imediatamente**. A liberação do slot fica encadeada a `ready.then(...).finally(() => active -= 1)`.
6. Se o worker nunca emitir `message`, `error` ou `exit`, `ready` nunca assenta; o slot não é devolvido.
7. Dois boots presos tornam toda chamada posterior `document-parser-busy` até reinício do processo.

**Fontes fixadas:**

- [`parser.ts` — capacidade global, timeout e liberação dependente de `ready`](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/product/documents/parser.ts#L8-L43)
- [`parser-worker.ts` — imports e resolução de PDFJS antes do `ready`](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/product/documents/parser-worker.ts#L6-L31)

#### O que isto não prova

- Não prova que `getResolvedPDFJS()` ou import dinâmico tenham travado em produção.
- Não prova que Bun nunca entregue `error`/`exit` num worker específico.
- Não é um bypass de autorização nem corrupção de documento.

#### Prova dinâmica mínima exigida

Introduzir uma factory de worker testável e um worker de fault injection que nunca envie `ready`, nunca encerre e nunca emita erro:

1. disparar duas extrações;
2. confirmar dois `document-parser-start-timeout`;
3. aguardar além do timeout;
4. disparar terceira extração;
5. demonstrar que a implementação corrigida recupera capacidade sem reinício;
6. repetir com aborto durante boot e durante parse;
7. provar liberação exatamente uma vez em `ready`, `error`, `exit`, timeout e abort concorrentes.

#### Aceite de correção

- Todo slot possui um owner/lease terminal com release idempotente e deadline independente de `ready`.
- Nenhum worker pode manter o processo e o slot indefinidamente após a resposta ao caller.
- A mitigação não deve simplesmente aumentar timeout ou aumentar `maxActive`.
- O teste deve provar recuperação após **dois** workers não responsivos e uma terceira operação válida.
- Definir isolamento/fairness por instalação ou documentar explicitamente o blast radius process-wide.

### ADV-PARSER-002 — amplificação de memória não qualificada

**Severidade:** P2  
**Confiança:** alta na existência de cópias; pico real não medido

Os limites permitem documento de até **20 MiB**. O host mantém o `Uint8Array`, `worker.postMessage` usa structured clone sem transfer list, e o caminho PDF executa `message.bytes.slice()` antes de entregar os bytes ao PDFJS. Há dois workers globais, além dos heaps de worker e das estruturas do parser.

**Fontes fixadas:**

- [`limits.ts` — 20 MiB e timeout de 15 s](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/product/documents/limits.ts#L1-L9)
- [`parser.ts` — `postMessage` sem transfer list e dois workers](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/product/documents/parser.ts#L8-L22)
- [`parser-worker.ts` — cópia por `slice()`](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/product/documents/parser-worker.ts#L28-L37)

Durante a consolidação de `bounded`/upload e o structured clone, cópias podem coexistir. Não foi calculado um pico RSS definitivo porque ele depende de Bun, PDFJS, GC, tamanho comprimido/descomprimido e implementação de `File`/ArrayBuffer.

**Aceite:** benchmark com dois PDFs de 20 MiB, PDF adversarial comprimido, DOCX com limite de entradas, cancelamento e repetição; registrar RSS máximo, tempo de GC, latência e recuperação do slot. Considerar transferência de ownership do buffer ou pipeline que evite cópia, sem quebrar o caller.

---

## 3. Trilha B — fronteira de ingresso antes da admissão

### ADV-IMPORT-001 — multipart grande é parseado antes da admissão

**Severidade:** P1  
**Confiança:** alta no ordering; impacto depende de controles externos não inspecionados  
**Natureza:** disponibilidade, não bypass de autenticação

#### Caminho causal

1. `createApplication()` chama `application.product(request, surface)` antes de entrar na transação que executa a autenticação geral da aplicação.
2. A rota `sf=import-admit` valida origem, método e content type, mas ainda não possui uma admissão `ui`/`human`.
3. Ela lê até `16 MiB + 64 KiB` em `chunks`.
4. Em seguida aloca um `Uint8Array` contíguo do tamanho integral e copia todos os chunks.
5. Cria outro `Request` e chama `formData()`, parseando todo multipart antes de rejeitar nomes ou multiplicidade de campos.
6. Só depois de validar `File`, surface, selection e options chama `runtime.ui.admit(...)`.
7. Depois da admissão de UI, `file.arrayBuffer()` materializa novamente os bytes antes da admissão humana `imports.admit`.

**Fontes fixadas:**

- [`application.ts` — product router precede a autenticação geral](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/runtime/application.ts#L50-L91)
- [`import-http.ts` — buffering, `formData()` e admissão tardia](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/product/interface/import-http.ts#L62-L83)
- [`import-http.ts` — implementação de `bounded`](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/product/interface/import-http.ts#L114-L129)

No fim de `bounded`, os chunks e o novo array coexistem transitoriamente; portanto, o corpo pode custar aproximadamente duas vezes seu tamanho antes do overhead de multipart/File. O pico completo precisa de medição. Não há semáforo local de parsing nesta rota.

#### Limites da afirmação

- A rota exige `Origin` igual ao origin configurado e rejeita `sec-fetch-site: cross-site`.
- Um navegador cross-origin normal não pode falsificar livremente `Origin`.
- Clientes não-browser e requisições sem sessão podem alcançar o custo se tiverem conectividade e enviarem o header esperado.
- Reverse proxy, body limit, rate limit, WAF e connection limits externos não foram inspecionados nesta revisão.
- Não foi encontrada evidência de leitura de dados ou concessão de permissão antes da admissão.

#### Prova dinâmica mínima exigida

- 1, 10, 50 e 100 requisições simultâneas de multipart com 16 MiB, `Origin` correto e sem sessão válida.
- Multipart com milhares de partes pequenas dentro do limite total.
- Cliente que envia lentamente e cliente que aborta no meio.
- Medir bytes recebidos antes do 401/403, RSS, CPU, event-loop lag, tempo de GC e impacto em requisições autenticadas.

#### Aceite de correção

- Autenticação/admissão barata acontece antes de receber ou parsear o corpo grande, quando compatível com o contrato.
- O ingresso possui limite total, limite de partes/campos, limite de concorrência e cancelamento.
- Requisição sem autoridade não materializa o arquivo completo em memória.
- Teste negativo prova que nenhum side effect ou referência de preview é criado.

---

## 4. Trilha C — backup, scheduler e lifecycle

### ADV-BACKUP-001 — I/O durável dentro de `BEGIN IMMEDIATE`

**Severidade:** P1 quando o mecanismo é executado  
**Confiança:** alta no caminho estático; duração real não medida

#### Caminho causal

1. `openLocalStore` usa `lockTimeoutMs = 5000` por padrão.
2. Toda chamada raiz de `transaction(...)` entra em `operation(true)` e executa `BEGIN IMMEDIATE`, inclusive callbacks que posteriormente retornam `commit: false`.
3. `capture()` abre uma `store.transaction` e mantém a capability de snapshot/blob durante toda a captura.
4. Dentro dessa transação, o código:
   - clona e codifica snapshot;
   - lê todos os blobs;
   - grava cada arquivo;
   - executa `file.sync()` em cada arquivo;
   - grava e sincroniza snapshot e manifest;
   - reabre e rehasha todos os arquivos em `verifyArchive`;
   - sincroniza diretório;
   - renomeia e sincroniza parent;
   - percorre/pruna arquivos antigos.
5. Operações posteriores aguardam o tail da fila; após o deadline recebem `Local storage lock timeout`.
6. Como `transaction` é serializada como write mesmo para leitura lógica, o impacto potencial não se limita a POSTs; projeções/GETs que usam o mesmo adapter também podem ficar atrás da captura.

**Fontes fixadas:**

- [`local-store.ts` — timeout padrão, WAL e `BEGIN IMMEDIATE`](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/runtime/local-store.ts#L12-L67)
- [`local-store.ts` — fila de writers e deadline](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/runtime/local-store.ts#L123-L174)
- [`local-store.ts` — `transaction` sempre chama `operation(true)`](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/runtime/local-store.ts#L271-L405)
- [`local-store.ts` — erro literal de timeout](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/runtime/local-store.ts#L432-L449)
- [`local-backups.ts` — capture e todo o I/O dentro da transação](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/runtime/local-backups.ts#L116-L204)
- [`local-backups.ts` — `fsync` e verificação integral](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/runtime/local-backups.ts#L260-L316)

#### Perfil e exposição

A instalação cria jobs para ambos os perfis, porém usa `schedule: !!operator`. Assim, o scheduler automático imediato é do `local-operator`; no perfil Microsoft atual ele fica desativado. O finding ainda se aplica a `runOnce`, futura ativação e qualquer caller de `capture`.

- [`local/entry.ts` — criação de backups/jobs e `schedule: !!operator`](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/local/entry.ts)

#### Prova dinâmica mínima exigida

- Store com volume realista de snapshots e blobs, incluindo arquivos no limite configurado.
- Fault injection de filesystem lento em write, sync, read e hash.
- GET/POST concorrentes a cada 100 ms durante daily, monthly e restore drill.
- Confirmar quantidade de `Local storage lock timeout`, p95/p99 e ausência de commit parcial.
- Repetir com shutdown no meio.

#### Aceite de correção

- O lock de negócio não permanece aberto durante I/O externo longo.
- Snapshot e blobs continuam atomicamente correlacionados por identidade/geração; não aceitar uma “correção” que solte o lock e produza backup misto.
- Backup lento não causa timeout generalizado em requests normais.
- Erros e métricas distinguem espera por manutenção de contenção externa.

### ADV-JOBS-001 — catch-up pode virar loop contínuo

**Severidade:** P1 condicional  
**Confiança:** alta no mecanismo; duração real não medida

O timer chama `runOnce()` a cada 60 s por padrão. Toda chamada define `pending = true`. Se já existe execução ativa, o mesmo promise continua, mas o loop interno faz novo `run()` imediatamente após o atual quando observa `pending`. Se ciclos continuarem maiores que o intervalo, novos ticks mantêm `pending` sendo renovado e o scheduler pode operar continuamente, sem repouso entre ciclos.

- [`local-jobs.ts` — coalescing com rerun imediato e timer de 60 s](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/runtime/local-jobs.ts#L217-L253)

**Aceite:** ticks perdidos devem ser coalescidos sem criar catch-up infinito; após ciclo longo, a próxima execução deve respeitar uma política explícita de intervalo/backoff. O teste precisa usar relógio real/falso com ciclo deliberadamente maior que o intervalo.

### ADV-JOBS-002 — varredura repetida cresce com toda a retenção

**Severidade:** P2  
**Confiança:** alta

Para cada uma das três superfícies, um ciclo chama `backups.list(surface)` antes do daily e novamente antes do monthly. `list()` não lê apenas metadados: `load()` chama `verifyArchive()`, que lê snapshot e **todos os blobs**, valida hashes e compara o conjunto de arquivos. Portanto, o custo de cada ciclo cresce com o total de bytes históricos retidos, não apenas com o delta atual. O código mantém monthly por sete anos.

- [`local-jobs.ts` — duas listagens por superfície e drills](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/runtime/local-jobs.ts#L57-L129)
- [`local-backups.ts` — list chama load/verify para cada archive](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/runtime/local-backups.ts#L104-L115)
- [`local-backups.ts` — verificação integral dos blobs](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/runtime/local-backups.ts#L278-L316)

**Aceite:** inventário barato não deve rehashar todos os bytes; verificação integral deve ter cadência, budget e cursor próprios. Medir custo em 1, 12, 36 e 84 monthlies por superfície.

### ADV-BACKUP-002 — corrupção pode ficar silenciosa e não ser podada

**Severidade:** P2  
**Confiança:** alta no swallow; efeito de health é inferência

`list()` captura qualquer erro de `load()` e o converte em ausência. `prune()` faz o mesmo. Um archive com nome válido, mas manifest/blob corrompido:

- desaparece do inventário;
- pode fazer o scheduler criar um substituto e terminar com sucesso;
- não é removido pelo prune porque a validação falha antes da elegibilidade;
- pode permanecer ocupando disco sem tornar o status `degraded`, caso nenhum outro passo falhe.

- [`local-backups.ts` — swallow em list e prune](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/runtime/local-backups.ts#L104-L115)
- [`local-backups.ts` — prune ignora archive que não carrega](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/runtime/local-backups.ts#L179-L200)

**Aceite:** distinguir `ENOENT` de corrupção; registrar/quarentenar corrupção; expor health e bytes órfãos; não apagar automaticamente conteúdo não validado sem política de custódia.

### ADV-BACKUP-003 — `.stage-*` de crash não possui scavenger

**Severidade:** P2  
**Confiança:** alta na ausência dentro do módulo; reprodução de power loss não executada

Capture cria diretório `.stage-<uuid>` e o remove no `finally` apenas quando o processo continua executando. Kill abrupto, power loss ou crash do runtime não executa esse cleanup. `list()` e `prune()` consideram apenas nomes que casam com `backup-<uuid>`, portanto `.stage-*` fica invisível. Não foi localizado um scavenger de `.stage-*` em `createLocalBackups`.

Um stage pode conter snapshot e todos os blobs de uma captura quase completa; falhas repetidas podem consumir o disco de backups.

- [`local-backups.ts` — criação e cleanup in-process do stage](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/runtime/local-backups.ts#L137-L176)
- [`local-backups.ts` — regex exclui `.stage-*`](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/runtime/local-backups.ts#L209-L218)

**Aceite:** teste subprocess kill entre cada durable write/verify/rename; no restart, identificar stages por owner/mode/idade, validar antes de remover ou quarentenar, e publicar métrica de bytes órfãos.

### ADV-LIFECYCLE-001 — shutdown espera operações não canceláveis

**Severidade:** P2  
**Confiança:** média-alta

`jobs.dispose()` aguarda `lifecycle.active`; `store.dispose()` aguarda todas as operações ativas. `capture()` não recebe `AbortSignal` e executa I/O e verificação até conclusão. Um filesystem lento ou travado pode alongar stop/restart/cutover muito além do esperado.

- [`local-jobs.ts` — dispose aguarda run ativo](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/runtime/local-jobs.ts#L239-L253)
- [`local-store.ts` — dispose aguarda `active`](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/runtime/local-store.ts#L418-L429)

**Aceite:** política explícita de cancelamento e ponto seguro; systemd stop test durante write/sync/hash; nenhuma publicação parcial; deadline operacional documentado.

---

## 5. Lacunas de teste observadas

### Parser

Não foi localizado, no inventário de testes inspecionado, teste dedicado que force worker eternamente sem `ready/error/exit`, consuma os dois slots e prove recuperação. Testes de documento normais não substituem fault injection de lifecycle.

### Backup e scheduler

Os testes existentes são valiosos para integridade, path traversal, permissões, corrupção e restore, mas não qualificam disponibilidade sob volume:

- o fixture principal de backup usa blob de **4 bytes**;
- o teste de jobs usa blob de **3 bytes**;
- jobs são criados com `schedule: false`;
- não há, nos testes lidos, filesystem lento, transação concorrente excedendo 5 s, timer sobrepondo ciclos, subprocess kill, stage órfão ou dezenas de monthlies volumosos.

Fontes:

- [`local-backups.test.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/test/local-backups.test.ts)
- [`local-jobs.test.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/dd378ad2ac14dff3559aa3aa546e6d87b43140c8/modules/sucafina/Sucafinav1/test/local-jobs.test.ts)

### Importação

Não foi identificada nesta revisão uma prova adversarial de multipart máximo sem sessão, concorrência alta, muitas partes, slow upload ou abort, com medição de RSS/CPU e confirmação de rejeição antes do parsing caro.

---

## 6. Ordem recomendada de fechamento

1. **`ADV-PARSER-001`** — garantir recuperação determinística de slots; pequeno escopo e blast radius process-wide.
2. **`ADV-IMPORT-001`** — mover autoridade/limite concorrente antes do parsing caro e executar stress sem sessão.
3. **`ADV-BACKUP-001`** — antes de qualificar local/operator ou ativar scheduler corporativo, eliminar I/O longo sob lock e provar concorrência real.
4. **`ADV-JOBS-001` + `ADV-JOBS-002`** — impedir maintenance storm e tornar inventário incremental/budgetado.
5. **`ADV-BACKUP-002` + `ADV-BACKUP-003`** — tornar corrupção/stages observáveis e recuperáveis.
6. **`ADV-LIFECYCLE-001`** — fechar shutdown/cutover sob fault injection.
7. **`ADV-PARSER-002`** — benchmark e orçamento de memória antes do go-live com documentos no limite.

## 7. Gates específicos de aceite

O go-live não deve herdar um PASS genérico para estes findings. As provas necessárias são:

- **Parser:** duas inicializações permanentemente não responsivas não impedem uma terceira operação após o deadline de recuperação.
- **Import:** multipart máximo sem autoridade é recusado antes de materializar/parsear o arquivo e não degrada requests autenticados.
- **Backup:** backup no volume-alvo não produz `Local storage lock timeout` em fluxo concorrente.
- **Scheduler:** ciclo maior que 60 s não cria execução contínua; backlog é coalescido com backoff explícito.
- **Retenção:** custo de inventário não cresce por rehash integral em toda execução; corrupção e stages aparecem no health.
- **Lifecycle:** stop/restart durante cada fase não deixa publicação parcial, lock preso nem prazo de shutdown indefinido.

## 8. Veredito

Os findings não demonstram comprometimento de confidencialidade nem corrupção já ocorrida. Demonstram que o candidato possui **caminhos de indisponibilidade e degradação que não são cobertos pelas evidências de CI atualmente discutidas**.

- `ADV-PARSER-001`, `ADV-IMPORT-001` e `ADV-BACKUP-001` merecem workstreams próprios.
- Findings de backup devem ser tratados com escopo explícito por perfil, sem fingir que o scheduler está ativo na instalação Microsoft atual.
- Nenhum gate deve ser fechado por aumento de timeout, aumento de workers, skip, retry cego ou redução de assertions.

**Estado desta auditoria:** documentação concluída; reprodução dinâmica pendente; nenhum produto/CI/deploy alterado.
