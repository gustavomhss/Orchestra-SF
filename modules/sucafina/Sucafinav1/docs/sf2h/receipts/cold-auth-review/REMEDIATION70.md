# Missão70 — proposta de correção para os writers

Este documento é uma proposta de desenho e de rechecagem, vinculada ao SHA `7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85`. Não contém mudança de produto aplicada nem instrução para executar testes nesta missão. 60/S0 devem encaminhar cada item ao writer com lease vigente;60 encerrou sua lease antes desta publicação e não é retomada automaticamente; a aceitação posterior exige revisor que não tenha escrito a correção.

## AUTH-01

### Invariantes que a correção deve preservar

State continua ligado ao browser, consumido uma única vez e validado com PKCE/nonce. Sessão mantém expiração absoluta. Logout concluído impede reaparecimento da mesma sessão ou de sessão derivada de callback cancelado, inclusive após restart, em outra instância e quando refresh/Graph/code redemption já estavam em andamento. O isolamento de tenant/app/origem e o ciphertext autenticado permanecem.

### Desenho proposto

1. Registrar emissão e estado de cada handle de modo durável. Um handle fornecido pelo caller somente gera cancelamento persistido se existe correlação de emissão. A correlação deve ser compartilhada entre instâncias.
2. Separar o consumo do segredo do challenge da retenção mínima de sua identidade. O consumo único pode retirar verifier/nonce, conservando um registro reduzido de callback pendente/emitido/concluído/revogado. Consumo e transição precisam ser atômicos.
3. Para handle nunca emitido, limpar cookie e terminar logout sem nova linha/Map. Para handle conhecido, gravar revogação de modo idempotente antes de declarar logout concluído, mantendo o fence imediato e o durável.
4. Não usar apenas `secrets.get(handle) === undefined` para descartar revogação: `take` já removeu o challenge quando um callback pendente ainda pode criar sessão. Essa simplificação reabriria a corrida atualmente cercada.
5. Conservar marcador de login até o fim da janela máxima do callback e de qualquer sessão derivada admissível. TTL do challenge sozinho não basta. O prazo também precisa tolerar instâncias com configurações de sessão distintas dentro do máximo permitido.
6. Adicionar índice por expiração e expurgo incremental em lotes, independente de retorno ao endpoint e do perfil operator. A manutenção não pode abrir escrita aninhada dentro de autenticação realizada sob transação de negócio; o `get` atual evita esse lock intencionalmente.
7. Limitar emissão/challenges ativos e capacidade compartilhada, recusando novas emissões quando atingida. Não desalojar sessões ou revogações válidas para abrir espaço. O Map deve acompanhar um conjunto limitado de handles realmente emitidos; não pode crescer por handles arbitrários.
8. Remover payloads expirados e marcadores somente quando os dependentes já não podem ser válidos. Propor coleta física/compactação separada se necessária; exclusão lógica e tamanho do arquivo SQLite não são a mesma métrica.

### Provas discriminantes a produzir pelo owner

Casos independentes: login abandonado, sessão expirada sem logout e logout de handle inventado. Registrar somente contagens/bytes, sem payloads/tokens. Demonstrar capacidade limitada e progresso do expurgo. Preservar casos de callback duplicado, logout durante redemption e durante write de sessão, refresh/Graph concorrentes, duas instâncias, restart, cópia de cookie, GC concorrente e expiração no limite. Não usar carga destrutiva como prova.

## ISO-01

### Desenho proposto

Para comandos sobre registro existente, calcular a autorização de visibilidade antes de produzir resposta observável de existência, versão ou conflito. ID ausente e ID fora do escopo devem terminar com a mesma resposta pública. Remover dados privados de erro não corrige sozinho a distinção404/409/403.

Manter `create` separado, pois não depende de registro anterior. Para o registro visível, preservar conflito409 com CAS e os controles atuais de status, holder, lock, alçada e transição. Visibilidade não concede permissão de editar: essas duas decisões continuam necessárias. Aplicar a regra também aos ramos approve/reject e às demais ações que possam consultar ID oculto, sem ampliar autoridade financeira.

### Provas discriminantes a produzir pelo owner

Usar A requester-only e B criador de uma PR. Fixar Request/origem/headers e variar apenas ID/versão. Comparar status e forma pública do corpo para inexistente, invisível com versão igual e invisível com versão divergente. Demonstrar que nenhuma negativa grava estado, auditoria ou efeito; demonstrar separadamente que A autorizado conserva conflito409 e edição válida. Não presumir que remover `stored` ou tornar mensagens iguais torna status equivalentes.

## HTTP-01

### Desenho proposto

Impor teto em bytes enquanto o stream é consumido, antes de `Request.text()`/buffer completo. O Workbench precisa de seu limite de65.536 bytes antes da alocação proporcional ao corpo; a fronteira Node→Web também deve aplicar o orçamento global/por rota em pedidos sem Content-Length.

O writer pode usar um stream medido ou leitura limitada do adapter, mas deve definir explicitamente: propriedade responsável pelo limite, status413, tratamento do erro canônico, cancelamento/abort/disconnect e liberação do reader. Tamanho declarado e efetivamente consumido devem convergir para a mesma política. Preservar bytes binários, método, headers, Request.signal e fences de origem/Host/forwarded.

A proposta52 `sanitized.arrayBuffer` deve ser julgada com o serviço MaxBodySize realmente fornecido pelo listener completo. Ela não substitui um teto de rota aplicado antes de text e não resolve sozinha a divergência16MiB/25MiB. O owner precisa decidir o limite autorizado por rota sem aumentar teto global indiscriminadamente. O valor de negócio para contrato está em Application; qualquer ajuste deve preservar upload autorizado e recusar excedente de forma limitada.

Falhas precisam conservar redaction: somente erro de tamanho identificado de modo canônico deve alcançar o tratamento413; causas com URL, callback, cookies ou corpo não devem escapar em logs/respostas. O código atual já possui duplex half e cleanup do readable; preservá-los.

### Provas discriminantes a produzir pelo owner

Usar listener Node completo (`IncomingMessage`, middleware global, instalação SF e runtime disponível). Cobrir POST JSON válido e negativo, chunked/sem Content-Length acima do teto, Content-Length excessivo, binário autorizado dentro do limite de negócio e abort/disconnect em diferentes etapas. Registrar bytes consumidos e interrupção antes deEOF, sem induzir OOM. Confirmar Host/origin/forwarded e ausência de spans/segredos. `toWebHandler(new Request(...))` não substitui essa prova.

## Integração e rechecagem

O writer publica release com pre/postimages, modos e dependências. O integrador explicitamente autorizado reconcilia HEAD/leases e integra; a lease anterior de60 está encerrada. Qualquer alteração dos três arquivos do mapa Microsoft exige novo mapa de composição e pointer da fixture coerentes, preservando o mapa55/archives49. Não aplicar apenas o mapa52 sobre o canônico21236af; não transplantar target_base/preimage históricos para o novo CAS.

Qualificação usa o lane Actions existente e o candidato composto exato, sob os owners autorizados.70 não despacha esse trabalho. Rechecagem independente verifica a correção causal e os novos logs; não aceita apenas a presença de teste ou receipt de autor. G01–G03 e os gates finais seguem abertos até sua própria evidência.

A ativação53 exige acordo e implementação de hook canônico que vincule Request/contexto/command, faça fresh auth dentro da transação e invoque admission.current imediatamente antes de um único execute. O harness atual não é esse hook. Não ampliar alçadas ou declarar Apply da substituição financeira resolvido por corrigir qualquer um dos três achados.
