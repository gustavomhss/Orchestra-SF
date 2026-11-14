# Handoff terminal 39 → sessão33

**Implementação comitada em `review-agenda`, PR única [#68](https://github.com/gustavomhss/Orchestra-SF/pull/68) para `sf2-stack`. Prova cirúrgica de primeiro uso: 3 PASS / 0 FAIL em [Actions](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43654981768). Integração instalada e gates restantes não estão qualificados.**

Base C9: `c1bd1c91b0e0d32db3074408e815e36107384073`. W testado: `41e80edb7a78ad77ffad66f1c7c1da336e4247e1`. S de request: `2027505c925a9a6dbac950c26fb1ab149140c760`. O commit terminal acrescenta somente recibos/propostas inertes; os nove arquivos executáveis conservam os blobs do [SOURCE-MANIFEST](SOURCE-MANIFEST.json).

## Capacidade entregue

O catálogo reutiliza Dashboard, Planner/Forecast e Procurement sob permissões de cada fonte. O usuário escolhe domínio e período, descobre as opções autorizadas e adiciona cada tópico explicitamente. Pode remover e ordenar tópicos, remover o registro exato e conferir todos os valores, contagens, períodos e referências antes de preservar a primeira revisão. Nenhuma revisão antiga ou referência colada é necessária.

Os períodos pertencem aos itens. Uma mudança de origem mantém as escolhas e exige Refresh, nova prévia e confirmação. O C05 histórico permanece imutável. Uma resposta de preservação perdida exige retry explícito do mesmo payload/chave; não cria outra captura. Revogação limpa conteúdo privado, seleção e notas, encerra a instância e invalida resultados assíncronos pendentes.

`discover` e `discoveryPeriod` são opcionais; callers existentes mantêm as entradas anteriores. Procurement usa o período protegido de cada seletor também na resolução de evidência histórica.

## Evidência observada

1. Pauta sem predecessor: Budget, Projects, Hot Topics, Forecast e Procurement, mais IT Operations de janeiro vazio; inclusão, remoção de tópico e registro exato, ordenação, prévia integral e fontes de negócio preservadas. Auditorias canônicas de leitura e novos scopes autorizados são discriminados dos dados operacionais.
2. Drift do Forecast: recusa de preservar a seleção antiga; Refresh e reprévia explícitos para 120. Preservação, perda controlada do body depois do commit, retry com mesma chave/payload/id e uma única captura. Após a origem passar para 130, SQLite e reunião/reload/navegação continuam exibindo 120 e total anual 1440, com o mesmo corpo C05. A leitura histórica após revogação retorna 403 e o corpo persistido continua exatamente igual.
3. Negativas por fonte: Talent e seletores privados/forjados/copiados, query com identidade injetada e Procurement revogado; outras fontes permanecem sob suas próprias permissões. O mesmo pedido Procurement conserva competências independentes.
4. Preparação nova de Talent: prévia privada real, resposta Planner autorizada 200 retida no transporte, revogação e liberação tardia. Conteúdo e controles permanecem apagados; zero requests de preservação e zero capturas.

Os três testes estão no mesmo arquivo cirúrgico. São produtores, autoridade, C17, SQLite, C05/C08, handlers HTTP e componentes browser reais com corpus/autenticação explícitos de fixture. O browser recebe um mount mínimo e o transporte encaminha para os handlers; não se abre servidor nem se reproduz HTML de produto. Isso não substitui o host instalado.

[CI-RESULTS.json](CI-RESULTS.json) conserva os oito candidatos/runs, árvores W/S, requests, dedupe, logs, falhas anteriores e nonce/verdict. Todos os testes foram em Actions. Omni foi `not applicable`; nenhum crédito nativo foi inferido.

## Limite observado que permanece aberto

Em W7, depois da grande captura e da navegação completa, uma nova descoberta Dashboard não teve resposta observada dentro dos 30s existentes. A causa e a conclusão eventual do request não foram determinadas. A prova de privacidade foi separada em uma fixture de primeiro uso; os oráculos foram mantidos e reforçados. **Isso não corrige nem fecha o timeout pós-captura.** A sessão33 recebe [DISCOVERY-AFTER-CAPTURE-LIMIT.json](DISCOVERY-AFTER-CAPTURE-LIMIT.json) para reconciliar o caso no runtime composto, sem aumentar timeouts.

## Patches consumíveis

| Consumidor | Bundle completo | Alvos e estado |
|---|---|---|
| Sessão33 | [integration-session33](integration-session33/manifest.json) / [complete.patch](integration-session33/complete.patch) | `review-services.ts`, `extended-business-services.ts`, `extended-http.ts`, `extended-browser.ts`; quatro preimages C9 confirmados também em `ee1a3ea147ab7d7f4f6b231217e623456e294c84`. Não aplicados aos paths reais nesta branch. |
| Sessão36 | [reports-session36](reports-session36/manifest.json) / [complete.patch](reports-session36/complete.patch) | RPT-01 e seed de fontes em dois arquivos; reconciliado com `7b13bec80d33c0c3a07190dc9df86069479979db`. Preserva as mudanças recentes de recuperação de rascunhos e a dependência `read-reconciliation.ts`. `CI-UI-REPORTS` existente, nenhuma nona seleção final. |

Ambos contêm diff completo, imagens integrais inertes `.ts.txt`, blobs e SHA256. A aplicação em materialização descartável foi conferida com `git apply --check` e igualdade exata dos postimages, sem executar produto. Conferir novamente cada preimage antes do consumo; reconciliar qualquer divergência com o owner. Nenhum arquivo real de discussão/browser compartilhado ou `reports.spec.ts` foi editado.

## Critérios e gates

[CRITERIA.json](CRITERIA.json) preserva os 86 IDs, textos e proof bindings S3-A e registra a evidência focada dos 13 bindings de T01. Os componentes sem prova continuam explícitos: notas/comentários, tópico desconhecido, exclusão física da origem, todos os tópicos/projeções, exportação e jornada instalada. A seção mensal vazia prova competência própria e vazio explícito; não prova uma operação mensal não vazia com outra coleção vazia.

Typechecks dos três packages e guards estão **NOT_RUN**. C9 não oferece dispatcher limitado com ref alternativo para esta entrega; a lane de checks da sessão36 não foi movida, e não se criou workflow fora dos paths autorizados. [CI-CHECK-LIMITATIONS.json](CI-CHECK-LIMITATIONS.json) explicita essa fronteira. Reports nominal também está **NOT_RUN** por esta missão; o handoff original 36 e o HOLD42 anterior não são dispensados pela nova proposta.

As hipóteses estáticas de auditoria/fence não se reproduziram no fluxo de seis seções; [READ-AUDIT-INVESTIGATION.json](READ-AUDIT-INVESTIGATION.json) separa a observação do risco não confirmado. Nenhuma guarda foi desligada ou alterada.

O [handoff terminal](HANDOFF.json) libera a implementação à sessão33. Source PASS não é bundle PASS. AM01–AM06, oito seleções finais, três revisões independentes, C-G7 e D-G8 continuam com S0. Sem merge em dev, deploy, Azure, credenciais, engines, restart, testes ou servidores locais.

## Retomada exata

1. Read INPUTS and both manifests; compare every preimage against the intended immutable composed candidate.
2. Consume only owned delta paths plus the four approved shared integration postimages; preserve concurrent owner work.
3. Have session36 reconcile its complete own dependency closure and apply the two-file RPT-01 proposal; its read-reconciliation dependency is explicitly pinned.
4. Record the new composed W/tree/closure and run only authorized, deduplicated Actions selections and checks.
5. Reconcile the observed post-large-capture discovery timeout against that exact runtime; do not infer a fix from the independent first-use privacy proof.
