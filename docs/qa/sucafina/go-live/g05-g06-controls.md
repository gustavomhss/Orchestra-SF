# G05 e G06 — controles e requalificação final

## Estado e donos

Esta sessão Astra implementou as rotas de prova [G05 #637](https://github.com/gustavomhss/Orchestra-SF/pull/637), [G06 #638](https://github.com/gustavomhss/Orchestra-SF/pull/638) e o [suplemento Microsoft/Team #660](https://github.com/gustavomhss/Orchestra-SF/pull/660), preservando a integração G01–G04/pool com a Migração. O dono desta frente mantém os controles e recibos de G05/G06; Migração e Release confirmam o candidato final. Os SHAs, árvores, runs, artefatos, hashes e merges estão neste documento, no [registro de execução](execution-2026-11-22.md) e em [status.json](status.json).

As execuções são de candidatos de trabalho. **Nenhum resultado é herdado automaticamente pelo SHA final.** Antes do tar de produção, Migração e Release devem confirmar C/T; ambos os gates precisam de novos recibos compatíveis com esse candidato.

## G05 — HTTP real e isolamento por Team

### O que foi implementado

A PR #637 acrescenta um transporte TCP loopback real ao exercitador de Server e mantém a opção existente de handler direto. A prova seleciona explicitamente o listener real, observa o peer do socket e registra seu encerramento. A chamada ao handler em processo não é classificada como tráfego de rede.

O catálogo inclui explicitamente o mount de descoberta `GET /api/sucafina/installations`, que não era coberto só pela enumeração OpenAPI. O inventário de trabalho tem **409 casos** por modo. Os três modos têm funções distintas:

| Modo | Prova exigida |
| --- | --- |
| coverage | Confronta catálogo obrigatório e seleção; detecta casos ausentes, extras e pulados |
| auth | Executa o inventário de autorização contra HTTP real e registra respostas observadas |
| effect | Executa o inventário de efeitos contra HTTP real, com oráculos e limpeza |

A prova específica de isolamento usa a factory Microsoft real com Entra/JWKS/Graph controlados, sessões assinadas e dois Teams. Ela demonstra admissão de cada Team, gravação e releitura, recusas anônimas e de instalação/tenant/seletor/rota incorretos, Team desabilitado/revogado e ausência de efeito cruzado. Os oráculos reabrem SQLite somente para leitura e comparam registros ordenados e blobs, incluindo bytes, tamanhos e hashes; não criam autoridade por SQL.

O relatório mantém o catálogo esperado, seleção, resultado por caso, fonte, logs e digest. O workflow coleta as contagens Omni reais dos scripts, sem converter chamadas de script em testes Bun fictícios. Recibos positivos são emitidos depois do encerramento dos runtimes e do listener, com verificação de ausência dos diretórios próprios. GLOBAL vazio é recusado antes da execução; o global fornecido pelo operador é preservado e sua propriedade não muda por releitura de variável de ambiente.

### Execução de trabalho e limites

A fonte exata e o último run estão no registro de execução. O [run 45024901473](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024901473) aprovou os cinco jobs no head `db896193346305fb1fee2d0d389cfc0b73077a01`, árvore `027c26022afe0ef74ae61f40c21e8e5b0b3995c6`: 409/409 por modo, 11 controles Teams/123 asserções, zero falha/skip/missing/extra, tipos e guards limpos. Os cinco ZIPs e 39 hashes internos dos quatro bundles foram conferidos. A PR #637 foi integrada em `48768330ce2bdd6dc6673cd0b4926b61778e3bd4` depois da repetição completa que incluiu a correção de cleanup. **Um PASS anterior não aprova um head posterior.**

A PR #660 extraiu a fixture Microsoft HTTP de G05 para `modules/sucafina/Sucafinav1/test/fixture/microsoft-http.ts`, compartilhada com o suplemento G06. O [run 45031531759](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45031531759) reexecutou o caso G05 e aprovou seus 11 controles no candidato `c7d90669f3b2b7fd3c6a35c9ec2fc5322d9f8898`, usando o snapshot de solicitação identificado na seção G06 abaixo. Os modos coverage/auth/effect não foram repetidos nessa extração: a prova de 409 casos por modo continua vinculada ao head `db896193346305fb1fee2d0d389cfc0b73077a01` da #637. A aprovação do caso Team na #660 não transporta o PASS desses três modos para outro candidato.

A identidade controlada de CI permite provar os mecanismos de HTTP, autorização e isolamento. O recibo mantém `installedTeamsProof:false` e `finalCandidate:false`; não representa login corporativo nem homologação G08.

### Reexecução sobre C

A rota integrada pela PR #637 é `.github/workflows/g05-http-proof.yml`. Após confirmar C, criar uma referência própria `g05-http-*` apontando **exatamente a C**, sem acrescentar um commit de CI ao produto. O workflow faz checkout do SHA do evento e executa os três modos, os controles Teams, os typechecks e guards.

Comandos do exercitador, no diretório `packages/server`:

~~~sh
ORCHESTRA_HTTPAPI_EXERCISE_TRANSPORT=loopback bun run script/httpapi-exercise.ts --mode coverage --fail-on-missing --fail-on-skip
ORCHESTRA_HTTPAPI_EXERCISE_TRANSPORT=loopback bun run script/httpapi-exercise.ts --mode auth --fail-on-missing --fail-on-skip
ORCHESTRA_HTTPAPI_EXERCISE_TRANSPORT=loopback bun run script/httpapi-exercise.ts --mode effect --fail-on-missing --fail-on-skip
~~~

O workflow é a fonte dos inputs completos e do setup Bun/Omni. Para qualificação final, não usar filtros que reduzam a seleção; o inventário deve ser reconciliado se C adicionar endpoints. Validar run/attempt/head/tree, resultados dos três modos, resultado do isolamento, hashes dos arquivos de evidência, veredito Omni e cleanup. Não copiar um JSON de um run anterior.

**Fechamento G05:** três modos completos e isolamento Team aprovados no mesmo C/T final, HTTP real observado, sem missing/extra/skip/falha e com recibos íntegros. **Bloqueio final:** C/T ainda sem confirmação conjunta e sem replay integrado final.

## G06 — ClamAV real e payload inválido

### Prova de origem nesta frente — #638

A PR #638 reconciliou a rota mínima preservada de scanner com a linha atual, acrescentou o controle de payload inválido benigno da aplicação e foi integrada em `babc660b2cda3e20ed6b68ecab86b973110652cb`.

| Campo | Evidência |
| --- | --- |
| Fonte / árvore | `9a6b7323bb35463005c978af5257f4107f7e62d1` / `b189a570fd57ce9cc6a39c1c41dbb321de9cdb2d` |
| Snapshot de requisição | `a99d4c650c30ae6581d23c7463e1379757778348`; somente `.ci-run.json` difere da fonte |
| Run / attempt / job | [44998523282](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44998523282) / 1 / 137134720749 |
| Verificador | 69 controles aprovados |
| Controles reais | 8 casos, 3 arquivos, 218 asserções; zero falha/skip |
| Omni | 4 declarações, 5 spawns reais, sem delegação |
| Artefato | [14744986410](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44998523282/artifacts/14744986410) |
| ZIP SHA-256 | `71552dcaa03d1576c6e52047b3f2d6133eca7ebfad98ab931e6337df018bccc8` |
| Classe | `COMPONENT_REAL_CLAMD`, `installedTeamsProof:false` |

O ZIP foi adquirido e revalidado independentemente nesta frente, incluindo os 14 hashes de arquivos referenciados, relatório real, recibo e cleanup. Typecheck Sucafina e 78 guards também passaram. Não houve execução instalada em QA ou emissão de aprovação final.

### Inventário preservado e ampliado

| Arquivo em modules/sucafina | Obrigações reais |
| --- | --- |
| `Sucafinav1/test/product/operations-scanner-closure/real-clamd.check.ts` | Clean → EICAR recusado → clean; limite de tamanho real; indisponibilidade após parar somente o daemon próprio de erro |
| `Sucafinav1/test/product/operations-installed-finish/real-malformed.check.ts` | Comandos de protocolo ClamD e INSTREAM inválidos recusados; daemon continua saudável |
| `Sucafinav1/test/product/operations-installed-finish/private-admission.check.ts` | Importação e upload privados clean/EICAR, negativas sem novo efeito durável; ambas recusadas com daemon indisponível; payload benigno inválido aceito pelo scanner e recusado pelo parser da aplicação |

Na execução da #638, o oitavo caso contém dois subcasos separados: texto de 54 bytes com formato incompatível e XLSX verdadeiro truncado de 6.569 para 6.547 bytes. Ambos passaram pelo ClamAV real no staging e receberam HTTP 400 `needs-input` no preview. O oráculo compara snapshots e blobs depois do staging para provar ausência de novo efeito durável indevido. Os quatro fixtures foram removidos; os processos encerrados pertenciam ao job.

A lacuna inicial `MALFORMED_APPLICATION_PAYLOAD_NOT_DEMONSTRATED` foi resolvida **no candidato de trabalho acima**. Protocolo ClamD inválido e EICAR continuam casos distintos; não foram usados como substitutos de corrupção benigna de formato.

### Suplemento Microsoft/Team executado — #660

A PR #660 acrescentou prova da composição `createMicrosoftInstallation` original, com admissão por Team, configuração real de scanner, HTTP loopback e persistência privada isolada. Entra/JWKS/Graph e o relógio são controlados na fronteira de teste; o login/callback, a emissão da sessão assinada, o ingresso, a autorização, o scanner e as transações são os mecanismos originais do produto. Essa prova é de componente e não representa sessão corporativa real nem instalação de tar.

A alteração ficou restrita a seis caminhos de teste, helper, runner e workflow. Os três arquivos legados e seus oito casos permaneceram intactos. A fixture compartilhada passou a integrar o inventário de fontes com hashes verificados pelo admission.

| Campo | Evidência da #660 |
| --- | --- |
| Branch de trabalho | `teams-scanner-proof` |
| Candidato de código C | `c7d90669f3b2b7fd3c6a35c9ec2fc5322d9f8898` |
| Árvore de produto T | `ef239daab90453d69d678ddabc5e2de921d8be74` |
| Snapshot de solicitação S | `683a1c3a50d869bf7a4d10dcb0fe1f6665f4cf69`; parent único C e única alteração `.ci-run.json` |
| Árvore do snapshot S | `b5ae74f889138f297acefbcf6625abb27c0d8a1c` |
| Request normalizado SHA-256 | `34c69603a855eb6b85952c53621140803262a70e86a71809257e35da754796de` |
| Envelope / seleção | `teams-profile-scanner-v2` / `controls-with-teams` |
| Run / attempt / job | [45031531759](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45031531759) / 1 / 137235976665 |
| Resultado do run | SUCCESS; concluído em 22/11/2026 às 14:14:15 UTC |
| Verificador | 107/107 controles Node; zero falha, skip ou todo |
| Controles reais | 12/12 casos Bun em cinco arquivos; 1.085 asserções; zero falha, skip, caso ausente ou extra |
| Composição do inventário | Oito casos legados + três casos Microsoft/Team + um caso G05 com seus 11 controles originais |
| Omni | PASS; quatro declarações, cinco spawns reais, zero delegações e nonce novo vinculado à invocação |
| Tipos / guards | Typecheck Sucafina aprovado; 78 regras, zero finding de gate, zero erro e um aviso consultivo reconciliado abaixo |
| Artefato | [14757916479](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45031531759/artifacts/14757916479); 35.388 bytes |
| ZIP SHA-256 | `8fe6d13a8cbe00af4e5a22ff9cac35840576be3787559f2f5d53405607b8e56f` |
| Merge da #660 | `ca490e9802248ad2f7bf71f9b4daef5790415bbf` |

Os três casos adicionais estão em `modules/sucafina/Sucafinav1/test/product/teams-scanner/private-admission.check.ts`:

| Caso Microsoft/Team | Resultado efetivamente observado |
| --- | --- |
| Upload privado clean → EICAR recusado → clean | Executado nos Teams A e B. Upload e download assinado do arquivo limpo retornaram HTTP 200; os bytes persistidos foram conferidos independentemente em SQLite/blobs. O mesmo download assinado no outro Team retornou 403. EICAR real de 68 bytes retornou 422, sem alteração nos snapshots/blobs de A ou B. Foram 26 requisições HTTP. |
| Owner ou membership inválidos | Instalação incorreta, tenant incorreto, divergência seletor/rota, Team desabilitado e membership revogado retornaram 403. A comparação integral e ordenada de snapshots e blobs confirmou ausência de efeito durável nos dois Teams. Foram 21 requisições HTTP. |
| Daemon real indisponível | O controle legado verificou e encerrou somente o daemon de erro pertencente ao job. O suplemento observou `ECONNREFUSED` no mesmo endpoint e recusou o upload nos dois Teams com 422, sem efeito durável. O daemon principal permaneceu saudável. Foram dez requisições HTTP. |

Todas as requisições dos três casos tiveram peer TCP loopback observado pelo listener e passaram pelo ingresso original. A comparação de dados é independente e somente leitura; não consulta `authentication_payloads` nem cria autoridade por SQL. Cada marcador positivo foi emitido depois de encerrar o listener, descartar a instalação e comprovar por `lstat`/`ENOENT` a remoção física de seu diretório. A execução também comprovou a remoção dos quatro fixtures legados e o cleanup dos dois daemons próprios.

#### Integridade e revisão independente

O root adquiriu o ZIP do run, conferiu SHA-256, tamanho e CRC, e revalidou os **17 hashes internos** referenciados no recibo agregado. Eles abrangem JUnit, summary, log, exit code, nonce, admission, argumentos, recibos G05/Microsoft e os oito arquivos de evidência de setup, pacote, bases oficiais, serviço, controles de daemon, configuração, lock e cleanup.

| Arquivo de evidência | SHA-256 |
| --- | --- |
| `receipt.json` | `f00b036903238e6c258a224b630097eb429b8997a77cfadc6bf0959d8cdc9526` |
| `microsoft-teams-receipt.json` | `a45ffcf354616bb6d365ccf680ccad9efdc14708b340d16184544922d26988fe` |
| `g05-team-http.json` | `49b8955bcba842e8fd353df6828357a8d786f91fb5ca75b4ba15a35b700cf1b3` |
| `report.xml` | `96016cedc5f78bcb9ca4d7a860d9d946b1e1fa16da87dde65d369926e75a50fe` |
| `summary.json` | `8e87736c90ef8195357c625a7e2fdd463799c06be3d33e9536be8e37e8390e1e` |
| `bun.log` | `b38485cdf67b8400dfc99ca7e723433fb5072ee6524e62f59bd0367f315686ec` |

A revisão independente do agente G07 examinou os controles, o helper, o consumidor G05, o runner e o workflow no mesmo head e não encontrou bloqueio material. O merge ocorreu depois da verificação do artefato pelo root. Não houve testes locais, alterações de host ou execução instalada.

#### Aviso dos guards reconciliado

O aviso `test-assertions-removed` foi emitido para `g05-http-team-isolation.test.ts` porque oito pontos de `expect(...)` da autenticação foram movidos para o helper compartilhado. A conferência de código preservou os **35 pontos estáticos** originais: 27 no consumidor e oito no helper. Isso descreve pontos no código, não uma nova contagem de testes. Os 11 controles originais permaneceram no inventário e passaram na execução.

A skill `guardrail-usage` classifica WARN como consultivo. A movimentação foi conferida em revisão e registrada na PR; nenhum ignore ou label de aprovação foi adicionado. O helper extraído também foi vinculado pelo inventário de hashes críticos.

#### Alcance e bloqueio do importador privado

Os recibos da #660 mantêm `proofClass:COMPONENT_REAL_CLAMD`, `composition:MICROSOFT_TEAM_FACTORY`, `identityProvider:CONTROLLED_ENTRA_GRAPH`, `installedTeamsProof:false`, `finalCandidate:false`, `g06Closed:false` e `teamsPrivateImportProof:false`.

**O suplemento comprova upload privado de fornecedor por Microsoft/Team. Ele não substitui a importação privada nativa nem fecha G06.** No candidato C examinado, `runTeamBusiness` configura o scanner de assets, mas não monta o produtor nativo `import-admit/import-preview` utilizado pelos controles de Operações. Uma recusa 415 antes dessa admissão, ou o preview legado de workbook, não comprova essa obrigação. O controle de arquivo malformado após staging continua ligado à composição local-operator dos casos legados.

A integração do importador na composição pertinente precisa ser coordenada com o dono de produto/Imports e a Migração. Esta frente não altera esses caminhos compartilhados nem substitui sua autoridade por fixture. Depois da integração e do pin final, executar os três controles na composição pertinente e registrar sua identidade, fonte e resultados reais.

### Rota para o candidato final

Arquivos integrados: `.github/workflows/sf-operations-scanner.yml`, admission/verificador `script/sf-ci/team-profile-scanner.mjs` e seus controles, setup/service/cleanup/tools.lock/parser em `script/sf2h/operations-scanner/`, os três arquivos legados, o suplemento Microsoft/Team, o caso G05 e a fixture compartilhada.

1. Confirmar C/T com Migração e Release. C deve conter a rota, a integração e a composição pertinentes; a prova de trabalho da #660 não aprova automaticamente seu merge ou qualquer descendente.
2. Criar snapshot S com parent único C e única alteração `.ci-run.json`. Para conservar o suplemento Microsoft/Team, usar o envelope `teamsProfileScanner` de schema `teams-profile-scanner-v2` e seleção `controls-with-teams`. A seleção legada `teams-profile-scanner-v1`/`controls` continua disponível para os oito casos originais, com alcance local-operator, e não substitui a seleção ampliada.
3. Gerar e normalizar o request pelos contratos presentes em C. O digest observado da seleção ampliada é `34c69603a855eb6b85952c53621140803262a70e86a71809257e35da754796de`; o digest histórico da seleção legada é `5d8d0ef32b33cc90cb86cd02484927e53585cda803cacddaf57d6bc96204d610`. Recalcular os valores se o contrato ou inventário mudar. O admission verifica parent, árvore, branch, request, arquivos críticos e ausência de outras mudanças.
4. Executar em Actions os três arquivos legados, seguidos pelo suplemento Microsoft/Team e pelo caso G05. A invocação ampliada observada contém 12 casos em cinco arquivos. O primeiro arquivo verifica e para o daemon de erro que os controles privados posteriores observam. Usar binário e bases oficiais íntegros, daemons próprios e loopback; manter nonce novo e o controle Omni.
5. Guardar relatório JUnit, inventário exato, logs/exit code, argumentos, setup, package/databases/service/daemon-controls, cleanup, summary, admission e recibos agregado, Microsoft e G05. O verificador recusa casos obrigatórios ausentes, pulados, extras ou cancelados, além de divergências de identidade, transporte, armazenamento ou cleanup. Preservar separadamente C/T, S/árvore do snapshot e o hash do request.
6. Observar cleanup mesmo em falha. Um recibo positivo exige cleanup concluído e evidência preservada. Adquirir o artefato e conferir ZIP, CRC, tamanho e hashes internos antes de registrar o aceite daquele C.

O workflow fornece `CI=true`, canal prod, Omni strict/declared, nonce novo e a identidade real de Actions. Não fabricar variáveis de run/runner fora de Actions para satisfazer admission. A identidade dos casos legados é local-operator; a dos casos adicionais é Microsoft com autoridade Entra/Graph controlada. Conservar os dois alcances explícitos. Se C alterar a composição ou acrescentar o importador nativo de Teams, adaptar a seleção e os oráculos à integração original e requalificar sem bypass de identidade.

O caso G05 incluído nessa invocação serve à regressão da fixture compartilhada. Para fechar G05 no C final, executar também sua rota completa de coverage/auth/effect descrita acima.

**Fechamento G06:** scanner real, payload benigno inválido, admissões privadas e ausência de efeito indevido aprovados no C/T final pertinente, com inventário completo, integridade e cleanup. **Bloqueios finais:** pin conjunto C/T, integração/prova do importador privado na composição pertinente e reexecução completa sobre esse C. A homologação Microsoft instalada continua G08.

## Referências históricas e coordenação

O run histórico [44684352036](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44684352036), fonte `6f9b66a2aaa8b057653244c94183254bb6f008b2`, preserva os sete controles de origem, 59 controles do verificador e 162 asserções; seu artefato e alcance permanecem no registro estruturado. A nova prova não altera o recibo histórico.

O agregado da Migração registrado na preparação inicial, [44987301540](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44987301540), fonte `b4ba7f595e6b3b5ff10a3379cd91b6771bb1b793`, terminou com falhas, inclusive pool/SF4/SF5/SF8/UI. Sua correção e integração continuam com a Migração.

Compras 222 (2) mantém seu aceite original de QA. G07 usa o mesmo C/T final confirmado, e G08/G10 qualificam o tar instalado em ambientes isolados cuja reserva e autorização tenham sido confirmadas. Nenhum resultado de componente ou roteiro libera produção.

