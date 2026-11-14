<!-- FINANCE-CURRENT-RECONCILIATION -->
# Reconciliação atual e escopo do registro histórico

Esta observação usa Finance `0c4a2545a63b4903c7eedb00d3f0989eb74ed398` e as fontes inspecionadas Compose `ed10a3806a4ffdf6ad5891e2065d93a4c91412cf`, Interface `cccd00c568aea65bb0c1b5cb4a82c2a236c7e775` e drift `4bd1f807e449d040e3db61c4d2b1e177b205ac69`. O [registro central de dependências](../../WP11/finance-20261114/external-reconciliation.md) prevalece sobre diagnósticos e campos chamados “atuais” no documento histórico abaixo.

Compose já adotou `advantageComparisonRef` e implementou seis destinos BI protegidos com retorno de foco. A proposta de seleção inversa abaixo é histórica; o host atual avançou além dela. Os novos consumidores ainda precisam de validação e o teste owner tem TS2345. C17 com ledger, fonte record-only e captura Atlas protegida prévia também existe; seus limites permanecem explícitos. Não reaplicar os patches COMPOSE4 superados.

Mensal contrato/HTTP/UI conserva os três blobs base do patch, sem adoção. N/A exige rota/prova humana; Procurement exige a closure canônica publicada de quatro arquivos. Preservar Finance apply/result/request e os incrementos W25 de mutations/Hot Topic. O run BI S16 `43591377679`, W25, passou 1 caso/86 assertions; isso não concede aceitação nativa, C/D ou do bundle.

## Documento histórico integral preservado

Todo o conteúdo abaixo permanece no seu instante e pin originais, inclusive suas antigas palavras “atual”, “pendente” ou “não aplicado”. Não constitui nova instrução de intake nem resultado de execução nos heads acima.

# Vantagem persistida — delta de seleção para astra-compose

Estado: **PROPOSED_NOT_APPLIED_TO_OWNER**. Base inspecionada: `a1e9eb62aa7fa862322622cc38474ef0ff5a7d09`. O [patch](advantage-selection-proposal.patch) altera somente o transporte e a igualdade de uma referência opcional. Os [pins](advantage-selection-proposal-pins.json) conservam hashes de base, proposta, produtor e verificação.

| Fonte externa | Blob base | Blob proposto |
| --- | --- | --- |
| `apps/cli/src/sucafina-product/bi-selections.ts` | `5bb690b8072d932f1717206b5967c95b45e3b365` | `3e1d2ec43831e689c19c5178a0ff370e60001e40` |
| `apps/cli/src/sucafina-product/bi-services.ts` | `7d44c1982c3c62fdaf21f98945ded9e572fd359a` | `acbb95b4a11d63be8414c4f7b47bfb372c920f00` |

## Mudança proposta

O seletor de cenário admite `advantageComparisonRef?: string`, conserva o campo no parser e exige sua igualdade no callback `revalidateProjection`. O serializador existente já usa `JSON.stringify` do seletor tipado e não requer implementação adicional. Os checks de encoding, tamanho, objeto, strings não vazias e campos fechados permanecem; o seletor de portfólio continua com seus dois campos exatos. Seleções anteriores sem o novo campo continuam possíveis.

O resolver de cenário existente já encaminha `...selected`; o adapter próprio WP05 já transporta a referência para `createStoredScenarioBiProjection`. O patch não cria uma comparação inversa nem escolhe automaticamente uma. O caller deve fornecer a referência de uma comparação inversa efetivamente produzida e persistida no C08, depois da autorização canônica.

## Cercas do produtor verificadas por leitura

O produtor próprio vem de Finance W14 `fe13ee693bdcec1830190bcdb5cc7f2794942c1f`, tree `1ce4e9fcb2e9fb81e12dcfd773aa2daae64be39a`; `stored-scenario.ts` possui blob `f5bb6d732ffc588626553097d53d3c0e1457a81c`.

A comparação opcional deve ter a referência solicitada, a mesma caseRef integral do cenário e endpoints inversos aos da comparação principal persistida. O produtor verifica moeda/horizonte da projeção autorizada, recusa substituir uma comparação que a projeção já possui e clona os callbacks. Relê cenário, comparação principal e comparação de vantagem; exige igualdade integral entre observações e repete a cerca de projeção. O valor conhecido, seu estado e suas fontes são copiados do resultado inverso. Nenhuma subtração, inversão de sinal, regra de FX, concessão humana ou nova autorização é introduzida no host.

## Verificação executada e prova ainda necessária

`git apply --check --whitespace=error-all` retornou **exit 0** em uma cópia temporária dos dois blobs base. A cópia base e os fontes inspecionados conservaram seus hashes. Isso verifica aplicabilidade textual, sem aplicar o patch ao owner; não verifica TypeScript, produto, browser ou sessão nativa.

O owner deve executar, no seu head composto, round-trip dos seletores antigos e novos, recusas de campos inválidos/ausentes/trocados, substituição da referência durante revalidação e negativas de caso, endpoints, revogação e replay alterado. No mount real, a vantagem deve vir da comparação persistida: `30000` condicionada antes do training e `-10000` completa após training `40000`, com referências, moeda, horizonte, retorno e foco preservados. A confirmação humana e o ChoiceRecord histórico permanecem separados de aplicação de operações.

Não houve execução local de testes, criação de run, push ou alteração de fontes externas. Se o owner avançar qualquer blob base, o patch precisa ser reconciliado nesse novo pin. Nenhum READY/DONE, C/D ou aceite do bundle é inferido desta proposta.
