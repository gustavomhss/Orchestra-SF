# Rodada 3 — revisão focal independente do workflow

Julgar o candidato exato commitado e a diferença para0aa2405bb3668314f60d6a674d2bd53fd5003091. Não repetir a investigação de código de produto inalterado sem indício concreto de regressão. Os três revisores são novos, sem autoria no delta e sem leitura das conclusões uns dos outros antes da entrega.

1. Supervisor: lançamento/ACK/admissão, capacidade global/pools, estado de sessão, transporte real, ownership/epoch, recuperação, término e reservas.
2. Contexto: seleção completa de tasks/axiomas/contratos, branches/partes, hashes, instruções de lançamento e expansão de fonte, cobertura de produtores/consumidores.
3. Evidência: dispatcher/dedupe, invalidadores, oito seleções finais/AM01–AM06, C/D, control separado, retries, guias antes do freeze, guards e proveniência.

DoD: relatório JSON+Markdown com SHA, escopo, achados fundamentados, veredicto e limites. Invariants: não editar candidato; não implementar produto; não reduzir escopo; não converter NOT_RUN em PASS. Quality standards: requisito/localização/contraexemplo/consequência/correção/severidade explícitos. Completeness: acompanhar a borda alterada até produtor, consumidor e gate. Success: APPROVED_FOR_EXECUTION apenas sem P0/P1 aberto e com disposição explícita de P2; qualquer correção material recebe rechecagem proporcional.

Os reviewers podem ler ferramentas de validação e executar apenas validação documental pertinente. Não executam produto, CI, deploy ou novas integrações. Relatórios iniciais são preservados e todos os achados encerrados ficam vinculados ao candidato corrigido.
