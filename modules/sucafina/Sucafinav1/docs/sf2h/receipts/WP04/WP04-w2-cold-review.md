# WP04 — cold review do delta W1 para W2

Revisão estática concluída em 2026-11-13 sobre o filesystem final informado por root, comparado ao payload imutável `publication-w1.json` e ao seed quando o path não foi alterado em W1. Nenhuma execução local de produto, teste ou typecheck. Nenhuma alteração em produto por este revisor.

**Nenhum novo finding bloqueante demonstrável no delta. Aceite técnico desta revisão continua condicionado ao CI hospedado do SHA final.**

## Tipos próprios

- `confirmation.ts`: `ObservationProof` explicita `unavailable|replaced` e `same` com os campos materiais da função canônica. `transactionAll<ObservationProof>` resolve a inferência estreita; não introduz `any`, cast de resultado ou sucesso fabricado. As verificações de existência/material/fingerprint/fence permanecem.
- `prepared.ts`: retorno de `execute` anotado com `ReturnType<PreparedDomainMutation["execute"]>` fornece o contexto JSON do contrato. Não muda comandos executados nem os requisitos de ator, encarnação, versão e preview.
- `confirmation-cross-actor.test.ts`: `authenticate` devolve `null` quando indisponível, conforme `DomainPortHost`; não concede autoridade adicional.
- `prepared-production.test.ts`: fixture `environment` declara seu parâmetro `Request`; o comportamento permanece o mesmo.

## Legitimidade das correções de teste

- `money.test.ts`: a ordem esperada agora segue o tie-break por ID acrescentado ao comportamento documentado de filas; as três categorias permanecem assertadas. A fixture de requisição agora possui `initialProcurementSettings`, permitindo alcançar o validador de campo pretendido. Não se converte sucesso esperado em indisponibilidade.
- `comparison-review.test.ts`: a tolerância de seis casas cobre somente a diferença binária entre 30240 e 30240.000000000004 observada no log. Mantém ausência de ranking/score na proposta divergente, comparação exata ao produto dos inputs e FX submetido 1.08; acrescenta ausência de FX corrente 2 na UI.
- `projection.test.ts`: asserts individuais preservam pesos, seleção, valores, moedas, taxa, origem, componentes, ranking e fonte. São mais específicos que os matchers agregados anteriores. O log W1 mostra `proposals.find` indisponível após o matcher agregado; o mecanismo exato não foi diagnosticado, portanto não é correto declarar bug confirmado do Bun.
- `ui-guidance` e `ui-supplier`: novos casos chamam os validadores/domínio reais, preservam contrato/ativo/recorrência salvos e distinguem aviso de nome duplicado da recusa por taxId duplicado. Não alteram políticas do produto.
- `finance-material`: empate exercita a ordem gravada da implementação existente, troca a ordem para contraprova e confirma ausência de seleção automática. Não acrescenta regra de negócio de desempate.

## CR-01

Guards de FX estritos conferidos novamente em `requestValue` e `toBase`: taxa deve ser número, finita e positiva. Assertions cobrem PO congelado, sourcing snapshot e taxa corrente malformados. O caso identificado na primeira revisão está corrigido no conteúdo final; execução final pendente.

## Typecheck global

O inventário W1 contém 150 diagnósticos/49 paths: 13 próprios/4 paths e 137 estrangeiros/45 paths. Nenhum dos 45 paths estrangeiros foi alterado no compare remoto seed→W1. As causas foram rastreadas ao seed estaticamente; não houve execução independente do typecheck do seed. Corrigir erros próprios não permite declarar package typecheck verde se os demais persistirem.

Inventário: `review/typecheck-triage.json` e `review/typecheck-triage.md`.

## Seam adicional INT-06

WP14 tipa `createSfProcurementSourceAccess.resolve` como objeto completo e o chama como função. Correção revisável: `ReturnType<typeof createProcurementSourceResolver>["resolve"]`; o Atlas deriva esse tipo automaticamente. O host WP10 deve anotar `procurementHost: ProcurementSourceHost`. A fixture WP14 antiga precisa usar lifecycle/projectScope/scopedSources e issue()/resolve()/isCurrent(), pois os exports legacy que ela espera já não existem no seed.

Patch proposto em `review/WP14-WP10-procurement-resolver-seam.patch`, sem aplicação a path alheio. O ID é INT-06; INT-05 é reservado pelo root ao shell WP01.
