# W20 — G03: composição própria de trabalho

**Builder; não constitui revisão independente. Pacote congelado, CI hospedado pendente.**

O bridge liga `createSfWorkSignalList`/`createSfWorkRefIssuer` ao caso resolvido pela seleção C08 real. A chave privada deriva de `assets.services.signingKey` mais installationId, com separação de domínio própria. A chave e os registros internos não saem na apresentação. Ausência de chave deixa a leitura indisponível: não vira uma fila vazia fabricada.

A navegação começa pela lista completa do produtor. O actionRef seleciona exatamente um item; não é uma autorização para ler diretamente IDs. Cada conteúdo exige sua própria admissão UI real no mesmo Request. A página própria usa o mount/Surface Dashboard existente e não invoca ações humanas nem mutações de domínio; todos os destinos conhecidos passam por produtor real. A leitura canônica ainda pode materializar capturas e reconciliar preferências derivadas C17, antes da testemunha. O handler GET reabre seleção, item e destino e revalida depois de renderizar.

Os produtores podem materializar capturas e reconciliar sinais. Essa etapa termina antes da testemunha C08. A leitura integral é repetida e o produto compara o conteúdo e a testemunha completa, incluindo snapshots, __sfProductV1, estado C08, fontes, autoridade efetiva, diretório/dia, binding, payload, lease e método/URL/headers da Request. A última prova mantém o snapshot real durante os awaits de autenticação; após seu retorno só há checagens síncronas e criação da Response.

## Arquivos e provas

`source-manifest.json` fixa seis caminhos próprios e suas dependências estrangeiras somente lidas. `package/` contém os bytes próprios congelados. `host-context-G03.patch` é a injeção mínima para o root aplicar sobre o host AI já selado: não editei esse arquivo compartilhado. Os hashes do produto e desse patch estão no manifesto.

O arquivo inteiro `work-bridge.test.ts` contém seis testes com C08/SQLite, fontes, case, seleção e thread reais; prova concessão específica, reload de bytes da chave, identidade, versões, destino existente e revogação durante leitura/saída. `memory-fixture.ts` só ganhou parâmetros opcionais de ator/case; a semântica padrão é textualmente idêntica depois de reverter essa parametrização. `memory-services.test.ts` deve acompanhar a seleção de CI por essa dependência. Não executei testes, build, typecheck, imports de produto ou browser locais.

## Limites precisos

O controle positivo do host tem registro de sinais canônico realmente vazio. A prova de referência opaca usa bindings C17 registrados de verdade pela fixture de Memory, cujos cenários e regras são inputs upstream declarados; nenhum SignalBinding, captura ou recibo aceito foi fabricado. Ainda falta uma prova hospedada de sinal não vazio atravessando o host instalado inteiro. Reload de objetos do host mais bytes duráveis não qualifica restart nativo/MCP. PR33 reviewContexts não foi composto. Destinos desconhecidos, fontes sem rota corrente válida e grants ausentes ficam indisponíveis. Os três revisores independentes, execução nativa e epic global permanecem pendentes.
