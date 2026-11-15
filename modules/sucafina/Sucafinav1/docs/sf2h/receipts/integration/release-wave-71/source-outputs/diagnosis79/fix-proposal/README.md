# M79 — propagação de aborto Node para o Request final74

Proposta inerte contra instalação74 `8a62babdccaa4bcecbfc64e385b728315208a7c1`. Nenhum produto foi alterado nem teste executado por este revisor. A74 continua a única writer do transporte.

O S1 reportado pelo root passou os POSTs28/77, persistência real, EOF com consumidor lento e413 antes do EOF. Falhou porque a origem Node abortou e o leitor rejeitou, mas o signal do Request final não estava abortado. Esta delta conserva a ponte74 e adiciona somente a propagação explícita de Node aborted ao signal composto.

O listener de aborted é anexado antes da validação declarada e removido em finally em todos os caminhos. Nenhum end/close gera aborto, nenhum socket é destruído e nenhum EOF é inferido de Content-Length. Um guard de error permanece até close porque o aborto síncrono cancela o leitor Effect e pode remover o error handler do adapter antes do erro Node já enfileirado.

A limpeza de close é idempotente e cancela qualquer Immediate pendente. Como a implementação Bun marca closed antes de emitir error/close, a origem já closed usa um Immediate unref para permitir a entrega desses eventos e remover o guard mesmo se close já aconteceu. O finally não remove prematuramente esse guard.

`abort-signal-delta.patch.txt` é a mudança contra74 exata. `complete-C34.patch.txt` contém a unidade completa de cinco caminhos, com helper/http74 preservados e mapa+lookup Microsoft fechados. O mapa muda apenas os três campos do postimage da instalação; o mapa histórico55 permanece intacto. O root deve recalcular os hashes do mapa se adicionar instrumentação ao candidato de validação.

A qualificação deve manter a asserção signal.aborted e retirar o observador diagnóstico de error no teste de disconnect, pois ele poderia mascarar erro sem listener na produção. Depois de close e dois turnos, verificar zero listeners próprios e nenhum callback pendente. Os resultados ainda são PENDING; consulte MANIFEST.json.
