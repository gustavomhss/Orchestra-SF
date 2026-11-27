# Evidências do Orchestra-SF — arquivo do #613

Este arquivo preserva os bytes já recebidos durante o trabalho do #613. A ref `sf613-evidence` é documental e tem árvore própria. Ela não é uma fonte de produto, candidato de Release, instalação QA ou autorização de produção.

O índice `index.json` relaciona cada objeto em `objects/<git-sha>`, seus papéis, bytes e SHA256, e a ordem das partes quando o original foi preservado em partes. Os arquivos usam os blobs originais; o arquivo não repete aquisições de Actions nem downloads de ZIP. Um hash de inteiro apenas calculado não é apresentado como blob existente.

## Alcance inicial

O primeiro corte cobre os pacotes e recibos C16, a revisão documental R5 e a rota técnica D26 incluídos no índice. O focal C16 passou em seu recorte funcional. A Analytics original C16 encerrou com uma falha no primeiro preview de portfólio e um caso de BI aprovado. O #613 continua com 12 de 15 áreas históricas; UI42–UI44 e a composição final permanecem pendentes. D26 está apenas preparado e revisado estaticamente, com bindings finais UNBOUND.

O índice distingue referências históricas de evidências efetivamente incluídas. A preservação completa de E11 será um incremento separado; a presença de um documento de análise não significa que todos os seus logs, exports ou partes do perfil já estejam nesta árvore. Os ZIPs conhecidos somente por metadados continuam sem download.

## Identidades preservadas

A fonte limpa C16 é `0860b3404ca54235997c4cdaee63bbe0659d5a7a`, árvore `194690fc63c26ac7feb690e44d0fea70742da88c`. Os snapshots executados são o focal `30890fcdcfd4e255185f443d128fe85ba21299ff` e a Analytics `dfa5cca0f7e20b92c23ea45897301c2327dc60ea`. A publicação do arquivo manterá esses commits como pais da cadeia documental, além dos blobs como entradas reais de árvore.

Esta ref deverá ser mantida enquanto as evidências forem necessárias. Atualizações avançam a mesma cadeia sem reescrever a história. O ledger histórico `sf613-ledger`, o PR #613 e as refs de produto permanecem separados. A integração em `dev` segue pelo PR revisado; qualquer virada de produção continua exigindo o aval explícito do usuário.
