# G05 e G06 — controles e requalificação final

## Estado e donos

Esta sessão Astra implementou as rotas de prova [G05 #637](https://github.com/gustavomhss/Orchestra-SF/pull/637) e [G06 #638](https://github.com/gustavomhss/Orchestra-SF/pull/638), preservando a integração G01–G04/pool com a Migração. Os SHAs, árvores, runs, artefatos, hashes e merges estão no [registro de execução](execution-2026-11-22.md) e em [status.json](status.json).

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

### Prova executada nesta frente

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

O oitavo caso contém dois subcasos separados: texto de 54 bytes com formato incompatível e XLSX verdadeiro truncado de 6.569 para 6.547 bytes. Ambos passaram pelo ClamAV real no staging e receberam HTTP 400 `needs-input` no preview. O oráculo compara snapshots e blobs depois do staging para provar ausência de novo efeito durável indevido. Os quatro fixtures foram removidos; os processos encerrados pertenciam ao job.

A lacuna inicial `MALFORMED_APPLICATION_PAYLOAD_NOT_DEMONSTRATED` foi resolvida **no candidato de trabalho acima**. Protocolo ClamD inválido e EICAR continuam casos distintos; não foram usados como substitutos de corrupção benigna de formato.

### Rota para o candidato final

Arquivos integrados: `.github/workflows/sf-operations-scanner.yml`, admission/verificador `script/sf-ci/team-profile-scanner.mjs` e seus controles, setup/service/cleanup/tools.lock/parser em `script/sf2h/operations-scanner/` e os três arquivos acima.

1. Confirmar C/T com Migração e Release; C deve conter a rota e a composição pertinentes.
2. Criar snapshot S com parent único C e única alteração `.ci-run.json`. Usar o envelope `teamsProfileScanner` de schema `teams-profile-scanner-v1`, C/T reais e seleção `controls`.
3. Recalcular o request normalizado; o digest da seleção observada foi `5d8d0ef32b33cc90cb86cd02484927e53585cda803cacddaf57d6bc96204d610`. O admission verifica parent, árvore, branch, request e ausência de outras mudanças.
4. Executar em Actions na ordem dos três arquivos. O primeiro para o daemon de erro que o terceiro observa. Usar binário e bases oficiais íntegros, daemons próprios e loopback.
5. Guardar relatório JUnit, logs/exit code, setup, package/databases/service/daemon-controls, cleanup, summary e receipt. O verificador recusa casos obrigatórios ausentes, pulados, extras ou cancelados.
6. Observar cleanup mesmo em falha. Um recibo positivo exige cleanup concluído e evidência preservada.

O workflow fornece `CI=true`, canal prod, Omni strict/declared, nonce novo e a identidade real de Actions. Não fabricar variáveis de run/runner fora de Actions para satisfazer admission. O wrapper de identidade privada desta prova é `local-operator`; conservar o alcance explícito. Se a composição necessária ao candidato final for alterada, requalificar com sua admissão real, sem bypass de identidade.

**Fechamento G06:** scanner real, payload benigno inválido, admissões privadas e ausência de efeito indevido aprovados no C/T final pertinente, com inventário completo, integridade e cleanup. A homologação Microsoft instalada continua G08.

## Referências históricas e coordenação

O run histórico [44684352036](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44684352036), fonte `6f9b66a2aaa8b057653244c94183254bb6f008b2`, preserva os sete controles de origem, 59 controles do verificador e 162 asserções; seu artefato e alcance permanecem no registro estruturado. A nova prova não altera o recibo histórico.

O último agregado da Migração observado, [44987301540](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44987301540), fonte `b4ba7f595e6b3b5ff10a3379cd91b6771bb1b793`, terminou com falhas, inclusive pool/SF4/SF5/SF8/UI. Sua correção e integração continuam com a Migração.

Compras 222 (2) mantém seu aceite original de QA. G07 usa o mesmo C/T final confirmado, e G08/G10 qualificam o tar instalado em ambientes reservados. Nenhum resultado de componente ou roteiro libera produção.
