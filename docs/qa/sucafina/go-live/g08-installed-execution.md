# Execução instalada e agregação de G08

Esta rota junta as nove obrigações Teams, U15 (6), U39 (22), U40 (22), F04 (3) e as seis fases AZ02 (37, incluindo os 32 casos históricos). São **99 obrigações operacionais** em onze invocações separadas. Controles de parser, listagem e CI hosted continuam sendo preparação.

O workflow canônico é `.github/workflows/g08-installed-complete.yml`. Ele contém dois jobs mutuamente exclusivos: `installed-group` produz um grupo, e `installed-aggregate` confere produtores já concluídos. Ambos usam o environment `g08-isolated-qa` e o runner self-hosted Linux x64 com label `orchestra-sf-g08-qa`. A concorrência é serializada. Nenhum deles instala um release, reinicia serviço ou executa uma virada de produção.

## Pré-requisitos reais

Antes de executar:

1. Migração e Release confirmam o mesmo candidato C/T; G07 verifica o tar original desse candidato.
2. O operador instala exatamente esses bytes na VM isolada reservada e mantém o recibo original G07.
3. A reserva e as permissões de cada invocação são registradas em fontes originais de autorização, verificáveis pelo GitHub. A autorização deve ser anterior ao início real do job; string ou hash preenchido no plano não basta. A preparação que depende do runId/tentativa deve terminar enquanto a execução ainda está retida pelo controle autorizado do environment, antes de liberar o runner.
4. Os contextos Microsoft originais, os dados e as permissões exigidos por cada caso já existem. O registro consulta a descoberta atual, F01/F02 e a UI/reader originais. Não cria identidades, sessões, servidores ou dados.
5. O observador instalado confirma o binário, a factory, o tar, a instalação, a VM, o processo, a configuração, o listener e o ingresso HTTPS reais.

O plano privado original `sf-g08-private-plan-v1` permanece fechado. Cada invocação tem raiz privada0700 própria, arquivos0600 sem links, nonce próprio, run/tentativa/workflow, quatro atores distintos e referências de autorização explícitas. Os planos nativos podem usar principais diferentes dos nove casos Teams. O administrador sem Team das nove obrigações é preservado; os nomes das chaves nunca concedem papéis.

O host, C/T, tar, manifesto e reserva são comuns entre as invocações. Os principals e suas referências continuam identificados por plano; não são fundidos em um roster presumido. As seis fases AZ02 preservam os mesmos atores e o cookie requester original entre actors, producer, after-revoke, logout e after-restart.

## Preparação privada por grupo

O operador prepara, fora do checkout, a raiz exclusiva da invocação com:

- `plan.json` canônico, com o run e a tentativa que serão executados.
- `package-receipt.json` e o tar original G07, ambos com os hashes aprovados.
- `authorization.json`: referência à declaração original, autor e hash do corpo, no contrato do módulo de proveniência.
- Arquivo `browser-endpoint.txt` com o endpoint CDP loopback original para os grupos que observam os contextos existentes. O wrapper fixa `SF_NATIVE_BROWSER_ENDPOINT_FILE` nesse arquivo e o manifesto em `native-installed-manifest.json`.
- Para AZ02, `az02-config.json`, cookies originais privados e corpos originais dos dois testes negativos, conforme o executor AZ02.

Os inputs do workflow são `mode=group`, `kind`, `private_root` e `invocation_id`. O checkout é o próprio SHA do workflow; não se aceita um C indicado somente por metadata. A árvore Git e o status limpo são observados antes do uso do host.

A chamada original é `bash script/sf-ci/g08-installed-run.sh "$SF_G08_KIND"`. O wrapper não aceita shell arbitrário, módulo de callback, comandos extras ou arquivo de ambiente para source/eval.

Para TEAMS, ele reutiliza `g08-private-run.sh` integralmente. Para U15/U39/U40/F04, chama o adapter original de registro, encerra a preparação e executa o processo específico do grupo. U15 rederiva as cinco URLs da seleção validada. F04 é um processo Bun/HappyDOM separado, sem CDP, com três casos e Omni declarado/fresco. Os processos preservam seus exit codes reais; stdout/stderr ficam privados.

O observador original roda antes e depois. O wrapper confere o checkout e emite `execution-status.json` somente com os valores efetivamente recebidos. Falha de comando, registro, observador, limpeza ou alteração de fonte impede o recibo positivo. O relatório não pode omitir, acrescentar, pular ou repetir casos.

## Ordem e restart de AZ02

Executar as fases AZ02 na ordem original:

| Fase | Obrigações | Condição |
| --- | ---: | --- |
| preflight | 16 | Instalação e atores originais disponíveis |
| actors | 14 | Principais e cookies atuais, sem substituição |
| producer | 2 | Negativas CAS409 e validação422 autorizadas sobre Request original |
| after-revoke | 2 | Revogação real feita pela administração autorizada |
| logout | 2 | Logout original, preservando os mesmos bytes para replay |
| after-restart | 1 | Watcher original iniciado antes do restart autorizado |

Todas as jornadas UI terminam antes do restart. O executor AZ02 não reinicia o serviço: observa o processo anterior, espera a ação autorizada do operador, observa o processo novo, redescobre o novo hostId e reenvia o cookie já revogado.

O modo `after-restart` do observador revalida os bytes instalados e o processo novo. Somente o PID/startTicks/boot, o listener original correspondente e hostId podem mudar nessa transição prevista; o restante do placement continua fixo. O plano original não é reescrito. Um sidecar que declara reboot, um serviço indisponível ou uma nova autenticação não substituem essa cadeia.

## Recibos e verificação posterior

O job de grupo publica somente um `receipt.json` allowlisted no artefato `g08-group-<kind>-<invocationId>-<attempt>`. Ele vincula C/T, tar, plano, reserva/VM por hashes, referências de atores/mutação, inventário, exit code, fontes e hashes dos arquivos privados. Nesse momento mantém `installed=false`, `liveQualified=false` e `g08Closed=false`, pois ainda falta conferir o produtor original e reunir todos os grupos.

Os relatórios brutos, GUIDs dos atores, cookies, descriptor CDP, dados do produto, logs de erro e observações privadas permanecem no host autorizado. Screenshots, vídeos e traces não são publicados.

Depois que os onze runs produtores terminarem, a invocação de agregação usa outra raiz privada com `aggregate.json`, as referências dos onze artefatos originais e o recibo real de cleanup do dataset. A entrada contém somente referências/expectativas; não contém um campo manual PASS.

O agregador:

- Relê os arquivos privados e executa os verificadores originais de cada grupo.
- Recalcula o recibo de cada grupo e exige igualdade byte a byte com o recibo preservado.
- Consulta run, tentativa, job, commit/árvore, workflow e artefato no GitHub original. Confere o vínculo `check_run_url` fornecido pelo job; não afirma uma consulta independente à API de check-runs.
- Baixa o ZIP original, confere tamanho, digest, CRC e o único receipt.json; exige os mesmos bytes locais.
- Confere a autorização original anterior ao início, o mesmo C/T/tar/reserva/VM, os onze nonces/roots distintos, as fases AZ02 em ordem e a continuidade do cookie revogado.
- Liga o recibo privado de cleanup à atestação posterior de seu operador/observador. Essa parte permanece explicitamente classificada como atestação da fonte original; não é inferida do parser nem descrita como observação automática.

Só depois dessa cadeia o recibo agregado pode registrar as 99 obrigações instaladas e `g08Closed=true`. A função isolada de checagem de formato `requireCompleteGate` continua insuficiente para isso. Os controles sintéticos do agregador não são evidência LIVE.

O fechamento de G08 não aprova G05/G06/G07/G10 nem a produção. A virada continua dependente da janela específica e da decisão explícita de go/no-go. Até existirem os dados, as autorizações, o tar e as execuções reais desta rota, o estado operacional permanece NOT_RUN.
