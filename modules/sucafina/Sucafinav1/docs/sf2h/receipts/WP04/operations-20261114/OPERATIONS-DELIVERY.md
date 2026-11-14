# Orchestra SF — entrega operacional WP04 + WP06

PR do grupo: [#34](https://github.com/gustavomhss/Orchestra-SF/pull/34), `astra-operations` → `sf2-stack`, em draft. O código e os incrementos comprovados estão disponíveis para integração. **Nenhum WP é declarado integralmente aceito.**

## Identidade da entrega

O candidato de produto final desta entrega é **W5 `c4a2f4ebeb88f5915e51569b921be06b3c37ddad`**, tree **`5cc00703f04845c62448a2a3239683d266d8d548`**. O commit posterior de entrega acrescenta somente este pacote de recibos; seu head/tree e o guard final constam na PR. Os typechecks e testes abaixo permanecem atribuídos aos seus candidatos W e snapshots S próprios, com reuso somente quando o fechamento de dependências está demonstrado.

Entradas consumidas:

| Entrada | Commit | Relação verificada |
|---|---|---|
| PR23 / WP04 | `91e1f60bc6f7e85517e2b4f963eec5ac7da13e62` | O produto testado `dae18b4f43f0daecf46264e876810025684a919d` recebeu apenas 31 arquivos de recibos até esse head. |
| PR26 / WP06 | `e7fd8ff797441681f360e7775155a8cc2830280c` | É o W20 testado; U20 terminou com sucesso, apesar da descrição antiga da PR. |
| Plano imutável | `dbf9547211d9b0fade619790de7c19c0869b7c7d` | SHA256 campaign.json: `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. |
| Handoffs, packs e CI | `a3d29d011ba3607a57914701300f09117a3e2de9` | WP04.md, WP06.md, packs integrais, CI.md e AGENTS aplicáveis foram consumidos. |

W1 `de6959db82dbe48bd59e3d012ff668a86347a6cd` compôs os dois heads como pais, reconciliando 269 paths de entrada: 47 overlaps, dos quais 15 idênticos e 32 diferentes. W2 `5e0c79ee7013ea84329ff1fab8b32ab04ebdc2c3` incorporou C12; W3 `d7d343ecb2ef4b4ccff925f50a5a60324d22b371` corrigiu a restrição de tipo; W4 `644324778e4a21d22424515dd698d5b8d6c01893` consumiu o primeiro host de dossiê. W5 preserva esses deltas e restaura a reconciliação pós-commit perdida no intake Finance. Os recibos intermediários e as falhas continuam registrados.

## Componentes entregues

Procurement preserva filas e projeções autorizadas, próxima ação verificável, pedido guiado com origem, comparação financeira, resumos por etapa, fornecedores e comandos originais. A composição conserva a confirmação C06 e o fluxo C12 real de preparação, revisão, ação humana, aplicação, recibo e reconciliação. O digest vem do produtor de revisão real, é vinculado à intenção privada completa e ao recibo persistido e é revalidado antes da primeira aplicação. Replay usa o vínculo durável e continua exigindo autoridade, principal, alvo e encarnação atuais.

O intake Finance havia substituído um bloco já publicado no PR23/W1. A aplicação atômica incrementa também o CAS de `cases`; usar depois a versão antiga causava 503 na reconciliação. A união `4bdd12ac162d61465557363953e25dfd99fad5e8` restaura literalmente a releitura pós-commit, igualdade integral do caso, leitura do recibo autoritativo e CAS atualizado, mantendo todas as proteções novas de revisão. H02/H03/H05, falhos em W4, passaram em W5; H06 confirma recuperação pelo mesmo recibo após perda da resposta e limpeza do cache. **Limpeza de cache não é reinício de processo.**

Importação mantém catálogo e normalização dos formatos originais, manifesto com origem, valores antes/depois autorizados, preview pelo adapter real, Apply explícito, conflitos/reprévia, atomicidade e recibo idempotente do resultado confirmado. Inclui Planner, roster, Dashboard, formatos legados e roundtrip. Foram preservadas as exceções operacionais WP06 em import-http, document-http, serviços CLI, application e backup. A correção de tipo do backup usa `typeof simulateBackup` e não muda o comportamento.

Documentos mantêm acesso/revogação, versões, origem/trecho/hash, extração e confirmação de PDF digital, DOCX e texto, Request-document e exclusão de evidência rejeitada. O dossiê consome o produtor canônico WP09 e os fatos reais de sourcing: versão, contexto, referências, propostas, FX submetido, comparação e limites. Há dois consumidores distintos, com provas distintas: o serviço CLI de dossiê e `business.procurementDossier`.

Não foram introduzidas novas políticas de compras, alçadas, scoring ou semântica de estados. Não houve edição do plano aprovado, engines, deploy/Azure/identidade/políticas financeiras, merge de sf2-control, epic por grupo, reativação de workers antigos ou reinício de desktop/server. Toda execução de produto, typecheck e guards ocorreu no GitHub Actions; operações remotas foram feitas pelo GitHub MCP.

## Mapa integral dos critérios e tarefas

O [registro de integridade](delivery-criteria-integrity.json) compara os **251 IDs e textos literais** com os packs imutáveis e preserva as dez tasks completas, seus inputs, outputs, work, dependências e condições de aceite. Não há critério agregado ou removido.

| Escopo | Critérios | Trabalho preservado |
|---|---:|---|
| WP04 | 20 | Critérios transversais de Procurement |
| WP04.T01 | 20 | Filas e projeções com próxima ação verificável |
| WP04.T02 | 14 | Pedido guiado e preenchimento reaproveitado com origem |
| WP04.T03 | 21 | Comparação honesta e valores financeiros consistentes |
| WP04.T04 | 15 | Resumo por tipo de aprovação e decisão sobre a versão correta |
| WP04.T05 | 21 | Fornecedores e preservação completa do processo de compras |
| **WP04 total** | **111** | [Mapa completo](operations-criteria-111.md) · [JSON completo](operations-criteria-111.normalized.json) |
| WP06 | 27 | Critérios transversais de imports/documentos |
| WP06.T01 | 16 | Formatos e normalização dos arquivos originais |
| WP06.T02 | 28 | Prévia do impacto e manifesto de mudanças |
| WP06.T03 | 24 | Apply explícito, reprévia e recibo fiel |
| WP06.T04 | 18 | Roundtrip e fronteiras de importação |
| WP06.T05 | 27 | Evidências documentais com confirmação |
| **WP06 total** | **140** | [Mapa completo W5](../../WP06/operations-20261114/operations-criteria-140-W5.md) · [JSON completo W5](../../WP06/operations-20261114/operations-criteria-140-W5.json) |

WP04 mantém seu baseline de **97 PASS_SCOPED históricos, 10 BLOCKED_NATIVE e 4 NOT_RUN_HUMAN**. Esses rótulos históricos não são convertidos automaticamente em aceite do produto composto; o addendum liga as observações atuais às provas e às dependências.

WP06 mantém **131 linhas com evidência de componente na entrada, sete cláusulas históricas parciais e duas cláusulas AM explicitamente parciais**. Isso não significa 131 aceites. O mapa base e os adendos conservam cada obrigação, consumidor, prova negativa e qualificação.

## Execuções e resultados

Cada snapshot S abaixo tem somente seu request adicional sobre W; o conteúdo de produto/testes/config/fixtures foi conferido. As falhas agregadas não foram renomeadas como PASS por conterem casos positivos.

| Prova | W | S | Run | Resultado |
|---|---|---|---|---|
| Bun43 | W1 | `acd7f87c28c70a68bd75ab65bac6c05477f470fe` | [43578845234](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43578845234) | **FAIL:** 100 pass, 1 timeout, 0 skip; 43 arquivos, 2052 assertions. |
| Browser3 | W2 | `26726f85ce39819fcfa376daf1e6ebea203188b2` | [43580401528](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580401528) | **PASS:** 30 casos — Procurement8, imports14, documents8; sem retries/skips/flaky. |
| Native import isolado | W3 | `c2ad4cb308ffa6e4b8d1a0cf5ed031bf1a304a01` | [43580976466](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580976466) | **PASS:** 2 casos,123 assertions, mesmo timeout e verificações; 311,30s no total. |
| Allcheck | W4 | `e4b18ec95f837985d1f138272d54f2b2732ce66e` | [43582192808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582192808) | CLI/guards **PASS**; Sucafina **FAIL só Atlas**. |
| Bun24 | W4 | `6108eafea9a35ba15968271f0aed76b1498d5ac4` | [43582205250](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582205250) | **FAIL:**114 pass,3 fail,0 skip;24 arquivos,1445 assertions. As três falhas C12 foram corrigidas e revalidadas em W5. |
| Documents browser | W4 | `5a6d4ee27f2279b8d5e6e1c19c392d8b92a8f6d7` | [43582881446](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582881446) | **PASS:**8/8, sem retry/skip/flaky; screenshot e artifact verificados. |
| Allcheck | W5 | `70bfcae5a16f8a007ee95402976cd1534d4a2ca3` | [43584394810](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584394810) | CLI **PASS**, guards **PASS**78regras/772paths/0gate/11warnings/0erros; Sucafina **FAIL só Atlas**. |
| Host + browser lifecycle | W5 | `9e1d872f453c218909d328b480ffaf8bed6f0c82` | [43584405211](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584405211) | **FAIL agregado:** H01–H08 **PASS**; startup/H09/lifecycle **FAIL** por aquisição Chromium.11casos,190assertions. |

Os recibos completos também preservam os checks W1/W2/W3, os diagnósticos próprios corrigidos e a evidência histórica dos inputs. PR23 tinha 257 passes em53 arquivos e10 casos de navegador. O ledger PR26 W20 tinha81 arquivos,301 passes e2 skips, além de22 casos browser; U20 foi conferido como6passes/3arquivos/224assertions e conclusão SUCCESS.

O timeout nativo de W1 não foi apagado. O mesmo caso passou isolado em W3 em272,633s, sem aumento do limite de300s; a comparação por etapas não demonstrou defeito funcional nem causa única do atraso. Nenhuma explicação de infraestrutura foi inventada.

No W5, o driver owner expirou na fase chromium-launch antes de adquirir um browser. H09 falhou ao pedir a lease, antes de criar a fixture de host ou enviar as chamadas HTTP da jornada. O listener Bun já havia sido criado; as verificações de navegação, review e Apply não foram executadas. O lifecycle não obteve PID de browser e **não provou encerramento físico**. Omni registrou PASS com 1 spawn e 0 delegações, nonce `e73271f7e6e425831126deb297111537`; isso comprova apenas o controle que ele efetivamente observou. Não é PASS de H09, Chromium, GNATIVE ou aceite humano.

Bun43, Bun24 e native import isolado registraram Omni explicitamente como not applicable, sem declaring tests/spawns/delegações. Os logs dos runs Playwright apresentam setup/nonce, mas não um verdict Omni positivo explícito; o pacote não inventa PASS ou N/A para essa ausência.

## Reuso discriminado

WP04: a análise inicial classificou35 dos53 arquivos históricos como afetados e18 como reutilizáveis, com fontes e exclusões por símbolo. A restauração CAS atinge o caminho pós-domínio de host-integration. Os outros quatro callers C12 examinados chamam diretamente o port inferior ou retornam antes desse bloco; seus passes W4 não foram repetidos.

WP06: os81 arquivos foram reconciliados integralmente, preservando a distinção entre arquivo selecionado, caso positivo e conclusão agregada:

| Origem da evidência no fechamento W5 | Arquivos | Observações qualificadas |
|---|---:|---|
| Histórico com closure demonstrada | 31 |137passes e2skips mantidos |
| Casos individuais W1 com escopo revisto |26|63passes |
| Native import W3 |1|2passes |
| Casos individuais W4 |22|99passes |
| Atlas sob responsabilidade do owner |1|Pendente |

Os deltas W5 foram comparados via MCP: exatamente oito paths de código,17recibos texto e11PNGs desde W4. O wrapper de dossiê é lazy e exclusivo de seu consumidor; o script Apply não é importado/emitido pelas páginas de imports/documents; os testes históricos relevantes não executam o bloco CAS restaurado. Por isso as provas nativas/imports/documents continuam reutilizáveis. O confronto cobre também os quatro fixtures owner, seus APIs e lockfile. Não se presume validade por mera igualdade do arquivo de teste.

## Consumidores e integrações

| Consumidor | Pin/caminho e prova | Estado |
|---|---|---|
| Procurement HTTP/C12 e source continuity | H02–H08 W5; produtores Finance consumidos seletivamente, CAS4bdd12ac reconciliado com PR23 | Componente real comprovado; políticas e autoridade preservadas |
| C06 Procurement → Collaboration | H01 W5, autoridade/observação/confirmado/stale/revogação reais | Componente comprovado |
| Primeiro dossiê: CLI dossier-services/workbench | Blobs0a89225f/aca602b5 do Compose4306b310;5runtime cases W4 +8browser Documents | Serviço real comprovado; renderer com HTTP de fixture identificado |
| Segundo dossiê: business.procurementDossier | Wrapper9aee116a consumido do Compose8f760659; H01 W5 exige fatos/FX/refs/contexto reais e nega mudanças/revogação | Componente comprovado |
| WP09/Collaboration produtor | PR33 `5ec1630993e4fa66684539db11af939b44ec8ecd`: dossier `ed88a6ff4f6c42eecfd80ba13824e8122fcc774e` e sourcing-evidence `2eb9ee92719402d137aca96c4861c086c6526971` idênticos aos consumidos | Fonte reconciliada; não é aceite global das rotinas |
| UI Apply com digest | Interface UI2e6c081a; driver diagnóstico76188b9f e três fixtures exatos do owner; H09 implementado/revisado | Código consumido; execução H09 bloqueada por aquisição nativa |
| Documents → BCS → Atlas | Segundo cenário WP06 preservado no arquivo Operations; patch OPS-CONSUMER-02 publicado | Caller externo pendente; mantém único erro Sucafina |
| Generic HTTP Dashboard/Planner | HTTP genérico mantido do W4 ainda recusa o quarto campo reviewDigest; Compose já publicou seu novo binding, fora dos deltas consumidos aqui | Incompatibilidade explícita no candidato isolado; owner deve integrar/validar o conjunto, sem usar a prova Procurement como substituta |

## Pendências sem redução de requisito

**Atlas / OPS-CONSUMER-02.** O caller externo precisa compartilhar o mesmo procurementEvidenceWrites com sua autoridade. O patch e a seleção estão publicados. O arquivo Compose observado contém só o cenário original; substituí-lo integralmente apagaria o cenário Documents→BCS→Atlas. A integração deve preservar os dois, corrigir o caller e executar seu teste com o controle Omni exigido, além de tornar o typecheck Sucafina verde.

**UI / OPS-NATIVE-UI-ACQUISITION.** O owner deve resolver/provar a aquisição e o encerramento físico do browser antes de qualificar H09. Nenhum timeout foi aumentado ou worker antigo reativado. A falha foi encaminhada a Interface/Compose com W/S, seleção, fase, nonce e logs. O código comprovado foi entregue imediatamente.

**Bindings genéricos / OPS03.** A UI compartilhada agora envia o digest exigido. O HTTP próprio de Procurement aceita e vincula esse payload, comprovado por H02–H08. O HTTP genérico de Dashboard/Planner no candidato isolado conserva o parser antigo de três campos; ele recusa o payload de quatro campos. Compose publicou o parser/bindAdmittedApply correlato em seu bundle, junto de outros serviços e contratos. Essa integração pertence ao owner e permanece necessária antes de usar esta branch como aplicação completa. O grupo não importa indiscriminadamente esses bindings nem declara os consumidores genéricos aprovados.

**WP04 nativo:** WP04.DOD.10; WP04.T01.CHK.18/DOD.18/SUC.18; WP04.T03.CHK.18/DOD.18/SUC.18; WP04.T05.CHK.18/DOD.18/SUC.18 continuam exigidos.

**WP04 humano:** WP04.SUC.01; WP04.T03.SUC.01; WP04.T04.CHK.01; WP04.T04.SUC.01 continuam não observados. Capturas automatizadas mantêm humanTimingMeasured=false e não suprem essas provas.

**WP06 histórico:** WP06.DOD.40, INV.40, SUC.40 e T05.CHK.40/DOD.40/INV.40/CMP.40 não recebem atendimento retroativo dos prazos originais20/35/53 ou da simultaneidade/writer lease. O T0 histórico é preservado no mapa; recibos posteriores não alteram o passado.

**WP06 AM:** T02.DOD.60 e T03.DOD.60 exigem explicitamente AM02/AM06. As demais atribuições AM02/AM06 e AM03/AM05 continuam em cada linha correspondente, inclusive consumidores IA/Atlas/rotina, importPreviewRef e documentos. As fixtures Session/Agent/MCP usam serviços reais com provider gravado; não provam inferência externa, scanner instalado ou GNATIVE completo.

**Global:** C/G7, D/G8, AM01–AM06, revisões independentes e oito seleções finais continuam exigidos pelo plano. S0 revisa, compõe TODO o trabalho, executa o epic do bundle e decide o aceite global. Não foi criada aprovação substituta neste grupo.

## Índice e preservação das provas

O `artifact-index.json` registra SHA256, Git blob, origem de auditoria e path publicado de cada novo recibo, mapa, log e revisão deste pacote. Ele resolve as referências locais de origem mantidas nos recibos sem alterar os seus bytes. Os catálogos dos mapas trazem pins de fonte, testes, consumidores, expectativas e limites; os snapshots/checks completos permitem rastrear cada observação.

As11capturas únicas dos artifacts Browser3 e Documents W4 já pertencem ao commit W5, como bytes PNG exatos e deduplicados por SHA256. O manifesto fica em `../../WP06/operations-20261114/ci-screenshot-manifest.json`. Nenhuma imagem foi reconstruída ou usada como prova de tempo/compreensão humana.

O guard do commit final de recibos é executado em modo estrito de documentação: exige W5 como ancestral e permite apenas recibos nos dois diretórios autorizados. Reutiliza os typechecks de W5 com seus resultados reais: **CLI PASS e Sucafina FAIL**. Um guard final verde não muda esse FAIL nem o aceite global.
