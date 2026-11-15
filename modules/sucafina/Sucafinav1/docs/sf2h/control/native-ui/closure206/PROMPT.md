# Sessão nova206 — cobertura integral U39/U40

Copie o bloco inteiro para um chat NOVO.

```text
Trabalhe em gustavomhss/Orchestra-SF em uma sessão NOVA. Missão206: fechar a cobertura funcional INTEGRAL de U39/OPEX e U40/CAPEX, preservando a admissão F04 já implementada pela195.

Use a MESMA branch sf-ux-n13 e PR150. HEAD reservado:0dd0ee1275f5b85d6658e1f094617e9b4eaefccb, epoch:source-closure-e2-browser206.195 encerrou com handoff679e17ecdfec23ab53ce4b23206594874617528d e liberou a fonte. Confira HEAD/S0-FENCE vivo antes de escrever, ACK modelo/session se exposto e aceite sua lease; não invente lifecycle.

Leia o pacote COMPLETO, com as duas ordens completas, os seis critérios e todos os anexos obrigatórios:
https://github.com/gustavomhss/Orchestra-SF/blob/b2ddfdb61abf8f280619a51f1e9e0b931039c364/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/206.json
Leia AGENTS aplicáveis, código/dependências reais, o HANDOFF-189.md e ARTIFACT.json de195 no commit679e17ecdfec23ab53ce4b23206594874617528d. Planejamento imutáveldbf9547211d9b0fade619790de7c19c0869b7c7d; normativoUXcbac654784714f68779ae1434d30e6ea8970c4d1. Não refaça planejamento nem a admissão que195 concluiu.

Complete TODOS os pontos abaixo, não apenas mais uma pequena correção:
1. Consumir a entrega195 integralmente. Não reescrever a admissão F04/canRead/save que já foi feita. A195 encerrou e liberou a fonte; nesta missão a entrega é a cobertura funcional INTEGRAL dos seis critérios U39/U40 descritos nos dois workorders completos.
2. Para CAP04/OPEX owner e CAP05/CAPEX project, escrever jornadas reais de create/edit/delete, annual/monthly entries, deviations, authorized source links e versões/semântica original. Valores/totais vêm do produtor; não manter Planner paralelo/frontendtotals.
3. Cobrir filtered-empty com filtros preservados, not-found distinto de vazio, read-only/revoked, fases reviewing/submitting/pending e retorno/respostas tardias após troca de owner, sem cruzar drafts/dados.
4. Completar teclado/a11y e todos os campos/ações em320/768/1024/1280/1440,200% texto e400% reflow com tokens existentes; preservar casos existentes e todos os contratos.
5. Reutilizar nativeInstalledFixture/requireNativeJourney e manifestos da199. Pré-condição externa ausente não é PASS e não autoriza mock/skip. Implementar todos os casos independentemente da disponibilidade da instalação e entregar à200 os inputs precisos; não parar em test skeleton/lista de TODOs.
6. Se os testes revelarem comportamento de produto ausente, ler produtor real e devolver à189 patch completo INERTE, com pre/post/contexto, cobrindo o comportamento; não ampliar lease para shared UI/domain.189 aplica e200 valida. Não relaxar assertions para adaptar a implementação incompleta.
7. Entregar ambos os specs completos, mapeamento de cada cenário aos seis critérios com fonte, patch necessário fora do lease e pedido de CI200. Não entregar só status de NOT_RUN: código de todos os cenários obrigatórios tem que estar escrito.

Write_paths: SOMENTE packages/app-shell/e2e/sucafina/native/journeys/u39.spec.ts, u40.spec.ts e modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure206/**. Mudanças de produto/fixture/shared fora deles devem vir como patches completos INERTES para189, com pre/post/contexto e consumidor, nunca editar fora de lease.199 cuida da fixture;200/PR106 é único dispatcher;190/PR107 compila;189/PR65 é única integradora. As referências históricas a191 estão superadas; não despertar outro dispatcher.

Sem testes/typecheck/build/validators locais, sem CI próprio. Encaminhe requests cirúrgicos de ambos os specs à200 após consumo189 e manifesto real da199, preservando todas as negativas e a falta de prova quando recurso externo não existe. Implementar os casos não exige fingir a instalação; falta dela não autoriza omitir casos, TODOs, skips ou inventar dados/permissões.

Finalize os cenários completos, código comitado e publicado na mesma branch/PR, handoff pre/post blobs, cada critério e seus cenários, comportamento, NOT_RUN ou runIDs reais, patches compartilhados necessários e mínimos inputs externos exatos. Use só GitHub MCP remoto e CAS expected-head/force:false; preserve trabalho anterior. Sem devmerge/deploy/Azure/engines/guardbypass ou restart. Comentários são avisos, não ACK nem wake. Goal nativa permanece pausada, GLOBAL_RELEASEfalse.
```
