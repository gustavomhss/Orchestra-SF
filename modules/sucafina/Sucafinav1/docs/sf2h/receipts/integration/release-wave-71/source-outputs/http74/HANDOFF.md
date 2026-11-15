# Missão 74 — handoff para 71

**M70-HTTP-01 implementado; 18 testes cirúrgicos passaram no mesmo W.** A fonte está pronta para revisão e intake de 71. Compiler/guards45, composição de limites e qualificação integrada continuam abertos; `GLOBAL_RELEASE=false`.

## Fonte imutável

- Branch: `http-body-limit-fix`; [PR draft85](https://github.com/gustavomhss/Orchestra-SF/pull/85), base `sf2-stack`.
- W: `d2a1227ae8858ed6defd80df7383d5648dd97b5e`.
- Tree: `a98e7957251da2aa6ca65ad63aab4301d14eb32c`.
- Base: `faa30fddb7e7b61696b66fd069f51cf18c51125f`.
- Plano imutável: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; T0 preservado.
- Os três arquivos de produto mantêm os mesmos bytes desde `b0f52c02`. Os sucessores corrigiram instrumentos dos testes; não reduziram prazos ou guardas.

## Comportamento entregue

O helper mede bytes antes de enfileirar cada chunk e mantém um único leitor da entrada. Content-Length é uma dica validada, também conferida no EOF; não determina alocação nem substitui a medição. Chunked e ausência de Content-Length têm o mesmo orçamento.

Workbench continua limitado a **65536 bytes**. JSON e UTF-8 inválidos são recusados antes da admissão. A mesma Request atravessa autenticação, autoridade de comando e despacho. Cancelamento, erro e disconnect liberam leitores; uma recusa antecipada pode enviar413 integral antes de fechar a conexão.

A ponte conserva Host/origem, fronteira de proxy explícito, redaction e privacidade Microsoft. Erros de corpo não incluem URL, token, cookie, corpo ou erro upstream. Upload binário autorizado de98358 bytes foi persistido byte a byte; a variante corrompida foi recusada sem escrita.

## Execuções finais

| Seleção | Run / job | Resultado |
| --- | --- | --- |
| Node24.22.2, listener/ponte de produção | [43673455601](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43673455601) /132688348708 | 3 PASS,0 FAIL,0 cancelados |
| Bun1.3.14, Workbench/SQLite/binário/Microsoft | [43673697145](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43673697145) /132689107232 | 15 PASS,0 FAIL,341 assertions |

Cada S tem W como pai único e difere somente por `.ci-run.json`. O controle omni do Bun registrou `not applicable` com nonce correspondente ao job; não houve prova de spawn omni. O runner Node não imprime esse controle. Os recibos [RUN-05](checks/RUN-05.json) e [RUN-06](checks/RUN-06.json) registram requests, snapshots, jobs, runtimes e logs.

RUN-01 a RUN-04 preservam todos os resultados anteriores. A revisão identificou diferenças de framing do cliente Bun e a inadequação de exigir `IncomingMessage.close` após toda resposta antecipada, tanto no Bun quanto no Node. Os testes finais verificam o recurso real: socket fechado e leitores removidos; o caso de disconnect mantém close/destruição/abort da Request. A prova raw exige JSON413 e EOF remoto antes de o cliente encerrar o corpo.

O probe Node usa instalação local real e consumidor de observação. A suíte Microsoft usa implementação canônica e peer OIDC/Graph sintético sob Bun. O scanner binário é de componente, restrito a digest/tamanho/MIME exatos. Estes testes não qualificam Azure, B2B, ClamD implantado ou jornada nativa integral.

## Intake e patches completos

1. Incorporar o pacote completo de **3 produtos +7 testes/helpers**: [source74-complete.patch.txt](composition/source74-complete.patch.txt), com [manifesto de preimages/postimages](composition/source74-complete.manifest.json.txt) e [dependências](DEPENDENCY-CLOSURE.json).
2. Incorporar [microsoft-map-74.patch.txt](composition/microsoft-map-74.patch.txt): mapa novo e mudança exclusiva do lookup da fixture. Manter o mapa55 e arquivos49 históricos idênticos, preservando schema, contagem, unicidade, identidade de origem e hashes canônicos. [compose-74.patch.txt](composition/compose-74.patch.txt) repete os3 produtos mais os2 arquivos de mapeamento; não aplicar esses hunks duas vezes.
3. Se os owners admitirem a política de25MiB, aplicar depois o suplemento **completo de5 arquivos**, [owner-with-map.patch.txt](composition/owner-25mib/owner-with-map.patch.txt). Ele inclui BodyLimit/routes/serve, mapa dedicado ao serve exato e lookup da fixture. Substitui o antigo patch de3 arquivos. [Manifesto](composition/owner-25mib/OWNER-WITH-MAP-MANIFEST.json.txt). Tudo permanece inerte e NOT_RUN.
4. Rebasear propostas52 sem substituir a ponte74 pela antiga materialização integral com `sanitized.arrayBuffer`. Consumir apenas releases terminais72/73/52, conforme suas autoridades.
5. Reconciliar o HEAD vivo e todos os preimages antes de CAS/intake. Em `0ccde9be553bf2f8d105ed4da864bb2758756536`, os7 preimages relevantes continuavam iguais. Os testes da fonte não qualificam o resultado composto.

## Bloqueios de aceitação

**45:** [pedido exato](checks/REQUEST-45.json) para `bun typecheck` em apps/cli e modules/sucafina e `bun run check:guards --base origin/dev`, mais guard do envelope documental entregue. Estado REQUESTED_NOT_RUN; nenhuma ref ou workflow45 foi tomado.

**Limites de negócio:** o preflight global herdado ainda recusa Content-Length acima16MiB antes do contrato de25MiB. O suplemento entrega a política finita e o mapa necessário, mas depende de autoridade e qualificação reais. Procurement com uploadCap/maxFileSize configurado acima16MiB também exige alinhamento de política com seus owners; essa faixa não é declarada preservada por W.

**71/S0:** rechecagem do mapa e candidato composto, oito seleções finais, AM01–06, reviews independentes e C/G7,D/G8 permanecem obrigatórios. Nenhum green fonte é transferido automaticamente.

## Autoridade terminal

A publicação deste handoff encerra a escrita da fonte74 na lease `http-limit-browser74`. Solicita-se ACK de71 para o W/tree e pacote completos; recebimento não é presumido. 71 mantém a integração em sf2-stack e45 mantém os checks. Nenhum path reservado a72/73/52, engine, workflow ou pacote foi alterado.

A matriz dos19 critérios rastreados está em [INDEX.json](INDEX.json); o parecer estático com exclusões de autoria e fontes dos diagnósticos está em [REVIEW74.json](REVIEW74.json). Identificadores efetivos de modelo/sessão não expostos permanecem desconhecidos.
