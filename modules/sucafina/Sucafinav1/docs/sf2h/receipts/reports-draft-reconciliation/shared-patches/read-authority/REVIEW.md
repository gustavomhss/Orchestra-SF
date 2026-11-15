# Missão48 — conjunto compartilhado coerente de 21 paths

## Estado e composição

Este diretório contém um manifesto único, um patch completo e pre/postimages completos de 21 paths. É uma proposta inerte para CAS do integrador47; nenhum shared source ativo foi editado e nenhum teste/build foi executado localmente.

Todos os preimages são os bytes verificados em C19 `5b11f1460fa44426626ea7674ccb8baf0a083e0a`. Os 18 preimages anteriores e 17 de seus postimages permanecem byte a byte iguais aos de `prepared/shared-patches/read-authority`. O único delta interno nesses 18 é o consumo da lease nos três catches de leitura de `product/reviews/http.ts`. Os três paths novos são `extended-http.ts`, `product-authority.ts` e `extended-review-cycle.ts`.

`compose21.py` somente monta artefatos e verifica hashes; não importa, compila nem executa código do produto ou testes. O hash completo do patch e os hashes de todos os arquivos estão em `manifest.json`.

## Contrato preservado

Os patches anteriores mantêm a separação produtor→HTTP→client: negativa real de autoridade/alvo/escopo resulta denied403; drift de conteúdo entre leituras autorizadas resulta stale409; armazenamento/evidência indeterminados resultam unavailable503 sem conteúdo. A intenção/chave pendente e os drafts privados sobrevivem à reconciliação recuperável. Revogação, logout e mudança comprovada de binding continuam purgando. Nenhuma mutação é repetida automaticamente.

As probes legadas de reissue continuam distintas das verificações estritas de leitura; esta composição não exige que a referência de outro ator já tenha o escopo do destinatário antes da emissão própria. Os gates de C05, receipts, históricos, Request e grants não são removidos.

## Delta final de leitura instalada

Em `reviews/http.ts`, cada um dos três blocos afetados registra `validated=true` somente depois do retorno verdadeiro de `ui.validate`. No catch, a ausência de `requestFor` só demonstra perda após esse consumo. Exceção anterior ao consumo permanece503; retorno falso de revalidação, mudança do produtor ou perda real de Request após consumo permanece403. Os finally.finish permanecem.

Em `extended-http.ts`, o GET real do formulário Reports entra na revisão mesmo com `page` igual à página de origem. A sentinela Generate Report continua válida, e todas as validações de seleção/autoridade permanecem. A admissão e as exceções dos modos de revisão não compactam indisponibilidade em403. O mesmo cuidado com o consumo da lease protege a página usada pelo focus probe. BI não foi ampliado. Os resultados de `reviewCycle.update` recebem o mapa denied403, unavailable503, stale/conflict409 e needs-input400.

Em `product-authority.ts`, somente `sf_review_prepare` e aliases `sf-read:`/`sf-human:` cujo action pertence ao registro fechado `collaborationReads` deixam a rejeição de resolve chegar à boundary. O caller instalado de colaboração usa o alias sf-human. A ausência real de identidade e todos os gates de grants permanecem negativos. Writes e admissão nativa mantêm o tratamento anterior.

Em `extended-review-cycle.ts`, a segunda leitura canonical negativa é preservada diretamente. A revalidação explicitamente falsa continua denied; resultado não ok recuperável é propagado; digest divergente após duas leituras autorizadas retorna stale sem value. Exceções retornam unavailable, salvo uma revalidação posterior explicitamente falsa. Há o mesmo número de leituras canonical e nenhuma repetição de mutação. Os escopos/identidades C05 já foram validados pelos leitores de produção.

## Novo teste próprio e limites

`proposal-tests/installed-review-entry.test.ts` e seu sidecar `installed-review-entry-manifest.json` contêm quatro casos, cada um limitado a 60 segundos. Os três casos anteriores mantêm seus limites e assertions; o quarto é independente. Estado: NOT_RUN. O teste closure anteriormente bloqueado não foi alterado nem incluído por este addendum.

O fixture existente fornece SQLite, identidade, grants, fontes, factories instaladas e assets reais. Não há grant adicional, mock global ou fabricação de autorização positiva. Os casos cobrem entrada real, validação de seleção, identidade de comando indisponível, erro de resolver antes do consumo e na entrega, recuperação explícita e revogação real. O alias sf-read possui positivo autorizado; o alias sf-human existente é exercitado com interrupção do resolver e, depois da recuperação, negativa pelo grant ausente. Não se afirma positivo autorizado nesse alias.

O quarto caso cria agenda e preserva C05/receipt pelas rotas HTTP de produção usando o grant reviews.preserve já presente. Interrompe somente a I/O de autoridade no segundo read canonical e exige503 nas rotas review-update e review com previousReviewRef; nova leitura recupera, e revogação real exige403. Não fabrica uma mudança autorizada de corpo C05; o branch stale de digest permanece coberto por revisão estática.

As quatro jornadas de browser continuam obrigatórias sobre a composição explícita. Este conjunto não declara todo status legado de extended-http uniformizado: branches não alteradas podem continuar usando409 recuperável para indisponibilidade. A conclusão limita-se aos caminhos corrigidos e aos resultados reais do gate hospedado que o root executará.

## Leitura de autoridade e instruções

Os ancestrais apps/cli/src/sucafina-product foram verificados na leitura anterior registrada em `proposal-producer/apps-agents-read.json`; não havia AGENTS intermediários. Root AGENTS foi lido integralmente e exige testes hospedados. O root verificou os ancestrais modules. `ui-authority.ts`, `product-authority.ts`, `extended-http.ts` e `extended-review-cycle.ts` foram lidos integralmente; o caller de admitRead em host-context.ts foi relido no trecho 300–345. Os três novos preimages foram verificados por MCP no C19 e comparados aos bytes W3. Nenhuma permissão, branch ou grant foi inferido de um resultado de teste.
