# S13 — interação no timeline de componentes

## Falha observada

O run `43589341922`, job `132430554445`, executou o produto W21 `8d065831356e8a73cfd0e4fbb072c5041b95d05f` no envelope `bd50d55e7613e9571e0e9ffaf71ce7a5ba8d9531`. O teste único falhou após `158571.55 ms`, dentro do limite global existente de `180000 ms`. O erro foi o limite de clique de `10000 ms` em `choice-history-bi.test.ts`, na fase `training-origin` posterior à cotação. O Playwright encontrou o grupo `training:11`, índice46, mas reportou que não estava visível.

O log registra80expect calls. Antes da falha, o teste havia atravessado o resultado canônico `250000` completo, a tabela de componentes e a vantagem persistida `30000 → -10000`. Isso é progresso observado dentro de um run **falho**, não aprovação da jornada nem prova atribuída a outro snapshot.

## Causa e correção

`product/analytics/decision-view.ts` tornava cada grupo SVG interativo, mas colocava nele apenas uma linha horizontal. `y1` e `y2` são iguais. A linha tem stroke visível, porém sua caixa geométrica tem altura zero; assim o grupo não fornecia uma área retangular utilizável para a interação observada. A lista, a tabela e o número de marcas estavam presentes. O finding não requer supor corte por altura do viewBox, remoção do componente47 ou defeito financeiro.

A correção acrescenta uma área de interação transparente ao próprio grupo: altura20, largura de pelo menos20unidades e coordenadas limitadas ao eixo0..600. A linha e seus endpoints permanecem iguais; os48componentes após a cotação continuam em suas posições. Não há alteração de valor, período, cobertura, moeda, cálculo de vantagem ou referência. `role`, `aria-label`, `tabindex` e os handlers de clique, Enter e Space foram preservados.

O teste existente agora verifica dimensões positivas para **todas** as marcas interativas por `getBoundingClientRect`, além da contagem exata já existente. Mantém o clique normal na marca de treinamento, Enter após foco, abertura pela tabela e igualdade exata da origem. Nenhum `force` foi adicionado, nenhuma assertion foi removida e nenhum timeout mudou.

## Pins congelados

| Caminho relativo a `modules/sucafina/Sucafinav1/` | Antes | Depois |
| --- | --- | --- |
| `product/analytics/decision-view.ts` | `4a4edc6549684202b3d5ddab4933d6ff56e0aa59` | `bb4e49ccf5eb0ea8957400322fb3a75e8e2ce5f8` |
| `test/product/wp05/choice-history-bi.test.ts` | `c939c5e39c80f3cdbc08fd700cd017a7b0ed50b4` | `68b68ee4b6638b6c4d0d4ab5624abcf32b0774ef` |

O manifesto `bi-timeline-visibility-files-ready.json` contém SHA256, tamanhos, provenance do run, guard contra `remote-state.json` e limites. O diff completo está em `bi-timeline-visibility.diff`. O revisor independente `/root/bi_timeline_review` recebeu os dois blobs congelados e os originais.

## Validação e limites

Não executei Bun, teste de produto, navegador, CI nem escrita remota. A única validação executada foi de metadados: hashes, igualdade de todas as linhas de assertions anteriores e preservação dos limites. A seleção exigida é o próprio `Sucafinav1/test/product/wp05/choice-history-bi.test.ts` nos bytes publicados. É ela que deverá provar a interação real, além das invariantes financeiras existentes.

Nenhuma fonte alheia, host, artifact-store compartilhado, engine ou política financeira foi alterada. A revisão e o teste desta correção não constituem prova nativa, aplicação instalada, C/D, epic do bundle ou aceite global.
