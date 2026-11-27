# Evidências do Orchestra-SF — arquivo do #613

Este segundo incremento é documental. Ele preserva os objetos do primeiro corte e acrescenta o corpus E11 enumerado, o fechamento C17 e os documentos de coordenação R7. A ref `sf613-evidence` tem árvore própria; ela não é fonte de produto, candidato de Release, instalação QA ou autorização de produção.

## Como conferir os bytes

O arquivo [index.json](index.json) enumera os blobs em `objects/<git-sha>`, com bytes, SHA256 e memberships. Para streams divididos, o índice dá a ordem das partes reais: a recomposição concatena os bytes UTF-8 sem separadores e sem normalizar BOM ou LF. Hashes de inteiros apenas calculados não são apresentados como blobs existentes.

As 83 entradas do primeiro índice permanecem com seus metadados e memberships anteriores. Novos memberships são acrescentados sem substituir os anteriores. O índice e README anteriores e o recibo de sua publicação são objetos desta proposta; o texto inicial do README está reproduzido literalmente na seção histórica ao final.

## Alcance deste incremento

| Conjunto | Evidência preservada | Limite |
|---|---|---|
| E11 | Fonte diagnóstica, focal, Analytics, leitor, sete exports completos e perfil em sete partes reais | Captura histórica da VM/PID; não demonstra custo exclusivo da requisição ou comportamento do C17 |
| C17 | Fonte e controle revisados, focal aprovado, main/cleanup atuais da Analytics e uniões reais dos marcadores e reports | O focal aprovado não qualifica o primeiro preview original |
| D26 C17 | Manifesto, bounds, derivação e revisão documental | Quatro bindings finais UNBOUND; bateria final ainda não executada |
| R7 | Status, README, execução e seus vínculos de revisão | Corte documental de 2026-11-27 às 19:08:31 UTC; não incorpora consultas externas posteriores |

O focal C17 passou 12 controles, com 1.052 assertions e oito reports. A Analytics original C17 terminou com um caso reprovado e um aprovado: o primeiro preview UI42 excedeu o waiter original de 60.000 ms em `design-wave-five-analytics.spec.ts:72:32`; UI43/UI44 não foram alcançadas. O caso BI passou no candidato C17. Esses resultados não estabelecem a causa do timeout nem uma economia causal das mudanças.

R7 mantém 12 de 15 áreas históricas e zero de cinco gates finais qualificados, em `NOT_READY`. O candidato final, seus aceites de Migração/Release, as reservas QA/G10 e a decisão de produção continuam pendentes nos respectivos campos. Cortes históricos negativos e posteriores aprovações limitadas permanecem identificados no índice e nos documentos originais.

## E11: transporte, captura e populações

O reader E11 exportou sete séries completas em 118 chunks: 2.097.711 B de payload. A emissão do core tem **2.829.285 B**; o terminal separado tem **2.065 B**, totalizando **2.831.350 B incluindo o terminal**. Esses valores não incluem os timestamps ou o envelope de logs de Actions.

As quatro paridades Analytics/CPU/progresso/união estão preservadas. A captura completa pertence à Analytics E11 `46028127606/1`: case 1/result 1/stdout, PID 3713, parent 3668, nonce `sf613-e11-cpu-RIlIZr`. O helper declara a base limpa `069a56a6…`; snapshot e run identificam a fonte instrumentada `ace9cecb…`. Essas identidades têm papéis diferentes.

O perfil é da VM/PID durante a janela recebida. Os contadores de solicitações Source e de pares de cópias nativas têm populações distintas; não devem ser pareados, subtraídos ou convertidos em taxa de fallback. Sequências CPU e progresso, streams e domínios de relógio permanecem separados. O launcher adicional demonstra somente preparação. Os hashes/CRCs documentados pelo reader não são uma nova aquisição ou inspeção do ZIP feita pelo arquivo.

Os sete payloads exportados estão completos no alcance declarado. Isso não equivale a publicar o ZIP inteiro, o runtime bruto, todos os PNGs ou todas as entradas do artefato. As exclusões e os arquivos presentes apenas no inventário estão explícitos no índice. Nenhum ZIP de auditoria foi baixado.

## Cadeia documental e execução

A publicação planejada tem cinco pais ordenados:

1. Arquivo publicado anterior `df0bd54bd624779b9d28836a8a4464dcf0a58ba3`.
2. Focal C17 `276fe1688727c5859a20cf393adc698c5c544d7d`.
3. Analytics C17 `7603f10c7d10a76f901425f659ee40448ee6cdfd`.
4. Focal E11 `3131f1766768473ed1e5cb69e97416b55a04aae4`.
5. Reader E11 `e63cffcea872aa538bc7ee1d6ed2768ecad80862`.

S17 e a fonte E11 ficam retidos pelas cadeias desses snapshots. Commits e árvores não são entradas de blob. A raiz revisa e cria a árvore documental, o commit e a atualização de ref; esta autoria produziu somente blobs. A árvore contém apenas `README.md`, `index.json` e `objects/<sha>`, com arquivos de modo `100644`, sem workflow ou layout executável do repositório.

A ref deverá ser mantida enquanto as evidências forem necessárias. Avanços preservam a cadeia anterior; não reescrevem sua história. O ledger histórico, o PR #613 e as refs de produto permanecem separados. A integração em `dev` segue pelo PR revisado e qualquer virada de produção exige o aval explícito do usuário.

## Texto do primeiro corte, preservado como histórico

<details>
<summary>README inicial publicado no commit df0bd54 — alcance e pendências daquele corte</summary>

# Evidências do Orchestra-SF — arquivo do #613

Este arquivo preserva os bytes já recebidos durante o trabalho do #613. A ref `sf613-evidence` é documental e tem árvore própria. Ela não é uma fonte de produto, candidato de Release, instalação QA ou autorização de produção.

O índice `index.json` relaciona cada objeto em `objects/<git-sha>`, seus papéis, bytes e SHA256, e a ordem das partes quando o original foi preservado em partes. Os arquivos usam os blobs originais; o arquivo não repete aquisições de Actions nem downloads de ZIP. Um hash de inteiro apenas calculado não é apresentado como blob existente.

## Alcance inicial

O primeiro corte cobre os pacotes e recibos C16, a revisão documental R5 e a rota técnica D26 incluídos no índice. O focal C16 passou em seu recorte funcional. A Analytics original C16 encerrou com uma falha no primeiro preview de portfólio e um caso de BI aprovado. O #613 continua com 12 de 15 áreas históricas; UI42–UI44 e a composição final permanecem pendentes. D26 está apenas preparado e revisado estaticamente, com bindings finais UNBOUND.

O índice distingue referências históricas de evidências efetivamente incluídas. A preservação completa de E11 será um incremento separado; a presença de um documento de análise não significa que todos os seus logs, exports ou partes do perfil já estejam nesta árvore. Os ZIPs conhecidos somente por metadados continuam sem download.

## Identidades preservadas

A fonte limpa C16 é `0860b3404ca54235997c4cdaee63bbe0659d5a7a`, árvore `194690fc63c26ac7feb690e44d0fea70742da88c`. Os snapshots executados são o focal `30890fcdcfd4e255185f443d128fe85ba21299ff` e a Analytics `dfa5cca0f7e20b92c23ea45897301c2327dc60ea`. A publicação do arquivo manterá esses commits como pais da cadeia documental, além dos blobs como entradas reais de árvore.

Esta ref deverá ser mantida enquanto as evidências forem necessárias. Atualizações avançam a mesma cadeia sem reescrever a história. O ledger histórico `sf613-ledger`, o PR #613 e as refs de produto permanecem separados. A integração em `dev` segue pelo PR revisado; qualquer virada de produção continua exigindo o aval explícito do usuário.

</details>
