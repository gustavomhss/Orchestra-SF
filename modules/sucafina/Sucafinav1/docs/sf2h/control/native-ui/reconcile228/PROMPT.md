# Sessão nova 228 — reconciliação e composição após handoff

Um único bloco para copiar e colar. A preparação independente pode começar; a escrita de produto exige o recibo de transferência previsto no pacote.

```text
Trabalhe no repositório gustavomhss/Orchestra-SF, em uma sessão NOVA. Missão 228: reconciliar todas as entregas e concluir a composição somente após o handoff exclusivo da 211.

Sua branch inicial é sf-closure-intake; HEAD reservado 2c1c2b089e76b8f135988cb849c725bc8dc89b16; epoch closure-reconcile-e1-browser228. Nela você escreve SOMENTE receipts/closure228/** e os patches INERTES ali arquivados. A branch de produto sf-closure-bundle/PR191 continua com a 211. Publicar ACK e ler HEAD/S0-FENCE antes de qualquer escrita. Não inventar morte de sessão, revogação de token ou autoridade.

Leia seu pacote COMPLETO e todos os anexos obrigatórios:
https://github.com/gustavomhss/Orchestra-SF/blob/9373e979218a9fb59fc1f626d90bb86dfcf8da94/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/228.json
Leia AGENTS, plano imutável dbf9547211d9b0fade619790de7c19c0869b7c7d (START, WORKFLOW, COMMON e seu pack S0 completo com anexos), UX cbac654784714f68779ae1434d30e6ea8970c4d1 e código/dependências reais. Preserve 15 WPs, 74 tasks, 17 contratos, 1.610 critérios e todo UX aprovado.

COMECE AGORA PELO TRABALHO DISJUNTO:
1. Use a base 998f0afd6047409956418f40c570dc9c48dc6c8f e o lote completo no pacote. S0 já conferiu dez preimages de220/221/222. Reconciliar todos os terminais215–227 e o originalA06 recuperado pela218, preservando código que211 já compôs.
2. Preparar um patch de integração COMPLETO, com todos os arquivos reais em bytes/content, pre/post blobs, árvore/diff esperado, dependências, contratos e consumidores. Resolver overlaps por semântica, não substituir host-context ou registry inteiros de uma branch antiga. Fonte já consumida não se reaplica.
3. Examinar as três mudanças C12 inertes de220: manter revisão humana, Apply explícito, grants/ACL, CAS, key+digest, único efeito e política financeira original. Não aceitar patch por nome ou relatório. Completar todo restante independente enquanto se verifica a autoridade da211.
4. Preparar candidato proposto, mapas de critérios/consumidores e requests cirúrgicos para CI. Reutilizar todos os handoffs/erros anteriores e ler novas entregas dos produtores já contratados pelo Git; não depende de mensagem nova ao chat.

GATE DE ESCRITA OBRIGATÓRIO:
Não atualizar produto, criar outro writer daPR191 ou substituir a211 por silêncio. O pacote já define o único recibo que pode ativar essa fase:
modules/sucafina/Sucafinav1/docs/sf2h/control/native-ui/closure-ledger/HANDOFF-211-228.json na sf2-control.
Ele precisa registrar por S0 o encerramento/release confirmado da211, atores/epochs, branch, expected-head e fencing CAS. Somente depois de verificar recibo e autoridade atual, adotar a epoch exclusiva indicada, reconciliar o HEAD vivo e aplicar o patch completo na sf-closure-bundle. Isso é dado de handoff previsto nesta missão, não uma nova instrução no chat. Não presumir que o recibo existe.

APÓS HANDOFF VÁLIDO, sua missão continua até fechar a composição INTEGRAL: consumir fontes215–227, conectar produtores/consumidores reais, corrigir defeitos de integração, preparar C coerente para aceite de S0 e dados de evidência D, guards C/G7 e D/G8 e rechecks independentes. Não encerrar após um lote arbitrário. Falta de instalação real bloqueia somente sua prova dependente; termine código/consumidores/drivers autorizados e registre o mínimo input exato. Não marcar C aceito, AM ou GLOBAL_RELEASE por conta própria.

Se todo trabalho disjunto terminar e ainda não houver recibo de handoff, publique o patch completo e checkpoint exato, sem polling vazio ou autoridade inventada. Assim o trabalho preparado fica consumível sem perda ou reautoria.

Nenhum teste/typecheck/build/validator local e nenhum CI próprio.223 é o dispatcher até transferência explícita confiável;190 compiler preservado. Não duplicar runs e não tratar componente/negativa/catálogo como prova nativa positiva.

GitHub MCP para remoto, CAS expected-head/force:false. Sem gh/push/token/devmerge/deploy/Azure/engines/restart/segredos/guardbypass. Não mesclar sf2-control no produto, não criar segundo S0/watchdog/plataforma. Goal nativa pausada; GLOBAL_RELEASE=false. Entregar commits/PR/handoff completo com código/payloads, paths/prepost, critérios/casos, validação real/NOT_RUN, consumidor e próxima ação.
```
