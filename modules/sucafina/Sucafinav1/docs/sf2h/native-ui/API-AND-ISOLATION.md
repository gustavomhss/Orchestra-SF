# API, identidade e isolamento — decisões após o cold review

**Especificação; implementação não executada.** O contrato normativo completo está em [execution/CONTRACTS.md](execution/CONTRACTS.md) e no [catálogo de operações](execution/contract-catalog.json). Este documento explica as decisões e substitui a matriz aproximada de endpoints da primeira revisão. O executor não projeta uma segunda API de negócio.

## 1. Transporte e reutilização

Reutilizar os endpoints JSON, handlers, payloads, outcomes e mecanismos de admissão existentes por família. Wrappers browser-safe ficam em Schema/Client e adapters finos nos subtrees exclusivos A. Campos e ações são referenciados pelo source pin e símbolo/branch de origem; a UI não parseia HTML, não recebe Snapshot privilegiado e não reimplementa cálculo financeiro.

Uma projeção nativa nova só existe para a capacidade que hoje está exposta exclusivamente pelo renderizador. O catálogo define os métodos e shapes fechados. Ela usa o mesmo domínio/ACL/versões e não cria outro engine, store ou semântica de comando.

## 2. Bootstrap sem dependência circular

Um único recurso global de descoberta, `GET /api/sucafina/installations`, publica metadados mínimos de instalações registradas por factory confiável, filtrados pelo contexto servidor/projeto autorizado. Descritores usam IDs opacos, origin, mount e revisão de contrato; não retornam directory, principal, papéis, grants, dados SF nem segredos.

O descriptor não autentica ninguém na Sucafina. Depois de selecionar binding válido, o client consulta o contexto SF dentro do mount, com a sessão SF real. Nenhuma inferência de papel vem do login global Orchestra, email, URL, nome ou origem de tenant B2B.

Esse recurso usa a geração pública já existente **uma vez na integração**. Não há novo alvo dedicado de codegen, cópia manual de arquivos gerados nem registro dos dados SF na API global. Os paths e a injeção sem dependência Server→CLI estão fechados em CONTRACTS e nas fichas F01/I00.

## 3. Montagem correta da projeção

`runtime/application.ts` rejeita path que não seja uma das três superfícies legadas antes de chamar sua product chain. Portanto, simplesmente acrescentar `/api/native` à product chain produziria 404.

A montagem nativa acontece na fronteira local de entrada **depois de `identity.prepare(request)` e antes de `business()`**, mantendo a proteção externa de transporte/privacidade. O objeto Request recebido pelo host é preservado; autoridade privada WeakMap não é serializada nem reconstruída a partir de IDs do renderer.

O primeiro acesso nativo inicializa somente mapas ausentes pelo bootstrap legítimo já existente: associação admin real da superfície, mesma política e proteção de mapa vazio intencional. Não exige visitar o HTML legado antes e não cria papel para resolver um estado vazio. A consulta de contexto e o catálogo de destinos refletem os mapas do produtor.

## 4. Browser e desktop têm transportes distintos

**Browser:** shell e instalação SF compartilham a origem aprovada para o perfil web; cookie mantém Path do mount, HttpOnly, SameSite e Secure atuais. Cross-origin incompatível não recebe CORS amplo nem mudança de cookie como atalho. A descoberta pode identificar conexão, mas dados exigem topologia admitida.

**Desktop:** `oc://renderer` não compartilha a origem do cookie SF. D01 entrega um broker mínimo main-process, com Session isolada por binding, login real na mesma partition e IPC tipado por operationId. O main calcula destino/origin da configuração validada, usa o catálogo fechado e rejeita URL, header, cookie ou path arbitrário do renderer. Nenhum token/cookie é devolvido à UI. Login Microsoft, local-operator, cancelamento, downloads e revogação têm contratos separados e concretos em CONTRACTS.

O broker é uma capacidade **nova planejada**, não um recurso já encontrado em Platform.fetch. O transporte passa pelas mesmas verificações do servidor. Web verde não prova desktop; ambas as superfícies integram o aceite.

## 5. Identidade de operação e resultados incertos

O host exige `Idempotency-Key` nas chamadas UI não GET/HEAD, incluindo leituras POST. O client cria e conserva a identidade conforme o tipo catalogado da operação; uma leitura nova tem identidade própria, uma reconciliação usa a correlação exigida pelo produtor. Não confundir uma request key com prova de que todo comando é idempotente.

Uma mutação é disparada uma vez por intenção confirmada. Resposta perdida conserva a operação pendente. Se há receipt/status canônico, consultá-lo; se o comando só retorna estado, usar a releitura autorizada prevista e manter a incerteza que restar. Não criar recibo sintético, redispatch automático nem inventar aprovação.

Unions de payload/outcome e affordances são fechadas no catálogo. Ação disponível na UI é orientação, não grant. O servidor revalida principal, superfície, escopo, holder, versão e fontes no momento do efeito.

## 6. Owner, cache e drafts

O owner de dados inclui server/projeto/instalação/principal e a geração de autoridade. O provider de dados/drafts fica fora da boundary keyed por chapter, preservando navegação no mesmo owner; troca de contexto cancela recursos, remove projeções privadas e só então monta o próximo owner. Resposta atrasada não publica em owner novo.

O contrato de componentes fixa eventos de draft e refetch em [COMPONENT-CONTRACTS](execution/COMPONENT-CONTRACTS.md). Timeout/503 não prova revogação; perda comprovada de acesso limpa conteúdo afetado imediatamente. Sessão expirada bloqueia apresentação privada até revalidar a identidade. Não usar URL, localStorage, service worker ou preferência de vista como armazenamento/autoridade de dados sensíveis.

HTTP, reason code e outcome do produtor permanecem distinguíveis. 400 input, 401 sessão, 403 negativa comprovada, 404 não divulgação, 409 conflito, 413 limite e 503 indisponibilidade não são fundidos no cliente. O catálogo conserva exceções semânticas reais por operação.

## 7. Limites e provas futuras

Origin/CSRF, limites de upload/JSON/parser/scanner, logs redigidos, privacidade de downloads, autoridade humana e ordem de transação continuam nos produtores. Nenhum header sensível, OAuth code, documento, salário ou prompt é registrado em log/fixture/URL de navegação.

Casos de aceite incluem primeiro login sem visita ao legado; roleMap ausente versus vazio intencional; POST de leitura com key; comando com resposta perdida; dois usuários/servidores/projetos; revogação; atraso de resposta; escape de IPC/URL; cookies isolados; download; e equivalência de operações web/desktop. Execução ocorre somente no harness autorizado e não é alegada por este documento.

Qualquer incompatibilidade entre source pin e contrato interrompe a parte afetada com finding explícito. O executor não escolhe novos nomes, relaxa auth ou usa endpoint genérico como workaround. O restante independente pode avançar segundo o manifesto.

## Declarações e seams adicionais fechados

Os tipos novos e sua localização por pacote estão em [host-signatures.ts](execution/host-signatures.ts); o DTO público de rotas está em [route-signatures.ts](execution/route-signatures.ts). Schema/Client nunca importam App/CLI. O registro central tem metadata de todas as operações, sem importar todos os adapters: I00 injeta somente codecs reais já admitidos no candidato. Ausência é resultado fechado antes de rede; o aceite final exige o catálogo integral resolvido.

No desktop, `registerConnection` é uma capability nova separada de `bind/invoke`: valida a conexão resolvida, obtém confirmação nativa da origem para conexão remota e só então permite discovery pelo novo broker. OwnedServe usa sua configuração confiável do main. Credenciais globais suportadas servem ao discovery da mesma origem, não concedem papel SF. Copy do diálogo e cancelamento estão fechados em COPY-02, sem import de i18n App no main.

Rotinas e Schedule reutilizam os tipos BusinessPorts existentes por seams HTTP específicos. A leitura de detalhe de Schedule é uma nova porta privada opcional e tipada; sem binding real, a edição contextual fica indisponível. Não reconstruir recurrence/timezone a partir de uma lista que só fornece ref/versão/estado, nem consultar o core Schedule para contornar a autoridade SF.
