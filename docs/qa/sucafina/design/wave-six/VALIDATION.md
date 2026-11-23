# Validação do sexto lote — UI57–UI70

O escopo contém 14 áreas e 25 padrões de rota existentes. A qualificação do lote está concluída para os estados e operações descritos abaixo, com os limites das fontes preservados. Uma área de design, uma captura, uma operação original e uma capacidade operacional são evidências diferentes.

## Matriz de qualificação

<!-- FINAL_MATRIX -->
| Camada | Resultado observado | Fonte |
| --- | --- | --- |
| Técnica Gate17 | 9 checks passaram; 78 regras, 105 paths, zero erros/exceções aprovadas; 13 avisos de declaração de prazo; 7 paletas inalteradas | [45122426354](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45122426354) |
| Codecs do cliente | 12 testes e 243 asserts; 6 novos casos do binding e 6 testes existentes de Files | Gate17 |
| Regressões existentes de filesystem/processo | 11 passaram, 1 skip preexistente, zero falhas; 37 asserts | Gate17 |
| Backend nativo Native69 | 69 testes e 887 asserts: 66 memória, 1 instalação real, 2 origem de fase | [45112013210](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45112013210) |
| Rotinas R18 | 2 jornadas passaram; 19 PNG e 19 JPEG; 30 GETs originais observados | [45115912342](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45115912342) |
| Registros R15 | 4 jornadas passaram em 7,7 min; 30 PNG e 10 JPEG; scanner ClamD e revogação originais | [45121980778](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45121980778) |
| Memória R11 | 3/5 jornadas passaram: UI63, UI67 e UI69. Materialidade sem corpo em 40s; recall POST503 sem motivo registrado | [45117078885](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45117078885) |
| Administração local após #715 | Jornada original passou: único save, CAS/releitura persistida, rascunho conservado, EN/pt-BR e 320px | [45121178514](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45121178514) |
| UI61 cancelamento local | 2 jornadas passaram: um GET nativo por consulta, ERR_ABORTED, condição retida, zero reenvio e seleção limpa; 12 PNG e 8 JPEG | [45122439989](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45122439989) |
| Guardrails e tipos E2E após observador POST | Gate18 passou os 2 checks afetados; 78 regras, 106 paths, zero erros/exceções e 12 avisos de declaração de prazo | [45123446736](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45123446736) |
| Recall UI62 R16 | Resposta original 503, schema fechado: `unavailable / similarity-source-unavailable`. O teste positivo permanece falho; correspondência positiva não é qualificada | [45123256492](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45123256492) |
| Guardrails e tipos após UI62 | Gate19 passou os 3 checks afetados; 78 regras, 140 paths, zero erros/exceções e 15 avisos de declaração de prazo | [45126501994](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45126501994) |
| Composição final com #716 | Gate20 passou os 4 checks afetados; 78 regras, 140 paths, zero erros/exceções; 15 avisos de declaração de prazo; 7 paletas regeneradas sem diferença | [45126798245](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45126798245) |
| UI62 recusa original R17 | 1 jornada passou em EN/pt-BR: um POST por locale, 503 fechado, critérios retidos, zero falso vazio; 6 PNG e 5 JPEG | [45126521339](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45126521339) |
<!-- END_FINAL_MATRIX -->

Os IDs completos, árvores e diferenças de snapshots estão em [DEV-COMPOSITION.md](DEV-COMPOSITION.md) e [DEV-COMPOSITION.json](DEV-COMPOSITION.json). O arquivo [technical.json](technical.json) conserva os contadores primários do gate.

## Comportamentos e limites

| Área | Escopo da evidência | Limite |
| --- | --- | --- |
| UI57 | Recibo original, diferenças e recuperação por referência; EN/pt-BR | Histórico não reaplica importação |
| UI58/UI59 | Origem autorizada, anexo, ClamD, extração/trecho/hash, confirmação e revogação | Extração permanece candidata até confirmação; CAS e autoridade intactos |
| UI60 | Prévia positiva R15 passou os 28 asserts originais: evidência 42 USD, baseline 420 USD preservado e `domainApplied=false`; fixture restrita mantém negativa | Total continua indisponível por cobertura incompleta; vinculação persistente não é afirmada |
| UI61 | Condições independentes; consultas explícitas e cancelamento local de materialidade e sinais | R11 não recebeu materialidade em 40s; resultados positivos de materialidade/sinais e interrupção remota não são qualificados |
| UI62 | R17 passou EN/pt-BR: resposta original 503 fechada, pergunta fora da URL, candidato e critérios retidos, edição/limpeza sem novo POST | Recusa `similarity-source-unavailable`; nenhuma correspondência positiva ou causa interna exclusiva é presumida |
| UI63 | Escolha registrada, referência opaca e resposta original `coverage-incomplete` | Sem comparação numérica prevista/observada qualificada |
| UI64 | Entrada contextual indisponível; F01 negado; zero folhas; retornos reais por teclado | Catálogo/preparo não operacionais; rota histórica de admissão preservada sem jornada positiva |
| UI65 | Estado sem execução selecionada e retorno no mesmo proprietário | Sem C07 executado nem saída C08 positiva |
| UI66 | F01 negado, zero folhas, explicação e retorno | Port Schedule ausente; sem CRUD/ocorrência |
| UI67 | Identidade e atualização original de contexto | Reflow não é medição de zoom ou contraste numérico |
| UI68 | Nome/MIME/bytes ZIP do XLSX original | Outros formatos não qualificados |
| UI69 | Revisão, cancelamento que conserva rascunho, único save e releitura original | Jornada R13 passou após #715; notificações/backups indisponíveis |
| UI70 | Cinco perfis e 25 skills originais; filtro/detalhes; projeção humana 200 de caso v5 e uma escolha | Sem histórico de análises admitido, contribuição ou carga presumida |

## Autoridade e integridade

Os leitores de disponibilidade usam os produtores montados, owner, identidade de métodos, binding, leases e fontes originais. A admissão de uso único é validada uma vez, seguida pelas revalidações originais. F01 não dispara exportação, planejamento, execução, confirmação humana, criação de condição ou agendamento.

O catálogo de rotinas não tem observador sem efeitos que ateste toda a cadeia original de planejamento. A negativa `SF_NATIVE_PHASE_UNAVAILABLE` permanece genérica: não é atribuída a credencial ou provider específico sem evidência. A apresentação contextual não monta a folha nem concede acesso. Leitores históricos preservam a origem privada, sem criar diretórios, e a época original de configuração.

O teste nativo compara C08 e o snapshot de negócio. O bookkeeping derivado conhecido fica limitado a `dashboard-dataset` e `dashboard-page`; não autoriza alterações de domínio. `readOperations:4` significa quatro IDs declarados prontos, incluindo residentes e três leitores históricos. Não significa quatro fluxos históricos positivos exercitados. O GET original de residentes foi exercitado; catálogo e Schedule continuam indisponíveis.

## Leituras de memória

As cinco operações repetiam 20 leituras comuns por observação de disponibilidade. O contexto original observa antes/depois da admissão, totalizando 40. O lote compartilha somente esses metadados dentro da mesma chamada/Request/contexto/stamp:4 por observação e8 por contexto, sem cache entre chamadas.

As admissões, digests, validação única, revalidações após cada namespace, finalizações e checagem final de identidade continuam independentes. Falha comum invalida o conjunto; falha de uma lease invalida a operação correspondente. Todas as finalizações são tentadas mesmo se uma falhar. Os 14 novos casos cobrem contagem, ausência de cache, ordenação, revogação isolada, erro/abort, troca de fonte, divergência e falhas de limpeza. Não se atribui toda a latência observada a essas leituras.

O catálogo original declara `Schema.Undefined` como entrada. O binding validava essa forma e a recusava no estágio JSON, sem emitir HTTP. A correção retorna ausência somente depois do parse fechado original. Valores obrigatórios, propriedades extras e `undefined` aninhado continuam recusados quando incompatíveis; respostas JSON e recibos continuam exigindo o formato original.

## Observação no navegador

Cada navegação completa observa as duas leituras F01 originais — provider e admissão da rota. Uma transição interna conserva uma leitura. O teste espera o corpo original e a revalidação de Files antes de exigir o DOM final. A origem, o caminho, o método, o trio e o stamp permanecem verificados.

O helper encaminha uma vez o pedido real, com zero retries e zero redirects, lê o corpo durável do APIResponse original e entrega essa mesma resposta integral ao navegador. Isso evita a perda do corpo no cache transitório do Chromium. Registro e limpeza são aguardados. Não há resposta fabricada nem reenvio para obter sucesso.

O focal UI62 R17 observa um único POST original por locale e aceita, no seu observador local, somente o erro de console 503 ligado à URL e ao Request exatos da resposta verificada. Em cada locale houve uma ocorrência desse erro original; zero erros inesperados e zero erros de página. O helper global e o spec positivo não recebem exceção. Editar a pergunta ou limpar o caso não gera outro POST. As 114 expectativas originais do positivo permanecem, e esse resultado continua não qualificado.

Cada leitura conserva 40s; o DOM conserva 10s; as jornadas preservam seus prazos originais. O cancelamento de sinais vem por último e aborta somente a espera local. A captura escolhe o tema com o controle de desktop visível antes de reduzir a largura. UI69 observa o GET de releitura original após o único POST e confere stamp, CAS, versão+1 e páginas antes do DOM.

A montagem visual duplicada de UI59 em pt-BR ficou no opt-in visual original; os oracles funcionais, inclusive revogação e consulta final ao catálogo vazio, permanecem. Os relatórios por grupo preservam o resultado real de cada tentativa.

## Revisão visual

A [galeria](evidence/README.md) reúne JPEGs do navegador; os artefatos de CI conservam os PNGs e o relatório integral. [manifest.json](evidence/manifest.json) atribui cada imagem ao estado, snapshot, run, job e blob.

As revisões cobrem estados selecionados em temas nativos claro/escuro, EN/pt-BR e larguras de 320/360 px. Não equivalem a auditoria de todas as combinações, zoom real ou contraste numérico. O recorte UI70 light 360 mostra o meio da lista de skills, não o seletor de caso nem o painel humano; sua inspeção visual se limita à região visível. Os recortes UI62 a 320px estão rolados para candidatos e recusa: não exibem o título, o seletor original ou a pergunta completa. Os cinco JPEGs finais UI62 foram abertos pelo root; EN escuro desktop e BR claro 320px receberam também revisão de Rotinas.

Os blobs são associados à árvore pelo SHA retornado pelo GitHub. A leitura binária independente não está disponível no conector textual; a revisão usa os bytes exatos emitidos pelo CI. Não se afirma releitura binária ou hash local independente.

## Relatórios e integração

- [Registros](records/VALIDATION.md).
- [Memória](memory/VALIDATION.md).
- [Rotinas](routines/VALIDATION.md).

A autorização do usuário abrange o merge em `dev`. Ela não é confundida com inspeção pessoal de capturas. O estado efetivo e o SHA de integração são os do [PR #713](https://github.com/gustavomhss/Orchestra-SF/pull/713). Após a integração, a campanha passa de 41 para 55 áreas de design; as 15 da frente #613 continuam separadas.
