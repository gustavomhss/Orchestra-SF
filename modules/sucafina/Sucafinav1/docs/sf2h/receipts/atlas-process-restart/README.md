# Missão35 — restauração da prova Atlas em processo separado

Correção delimitada de M29-ATLAS-003 para consumo da sessão33. O patch parte do teste/helper compostos; o caso C17 permanece byte a byte idêntico.

`INPUTS-AND-PATCH.json` fixa o input composto, os blobs anteriores/posteriores, o patch e a fronteira nativa. `preimages/` e `postimages/` contêm arquivos completos, com extensão `.txt` para não entrarem no grafo TypeScript.

O código publicado na PR38 e o candidato de prova composto têm árvores diferentes. A prova hospedada usa o composto fixado com somente estes dois postimages sobrepostos; o snapshot CI acrescenta apenas o request canônico. Não se move `sf2-stack` nem se transporta green para outra árvore.

O pai fecha SQLite antes de lançar o leitor pelo AppProcess/Omni. O PID observado vem do handle; o filho usa o leitor canônico Atlas e o consumidor real de recall. Os dados lidos são comparados à identidade, digest, envelope e captura gravados antes do fechamento, e o pai reabre o estado para conferir que Atlas/outbox não mudaram.

Identidades e associação do primeiro harness continuam declaradamente sintéticas. `nativeSessionWitness:false`; a prova não fecha AM05 nativo, SessionV2, SkillLoadReceipt, integração final ou gates globais.

Resultados e W/S/runs serão registrados em recibo próprio após a execução. Nenhum teste de produto foi executado localmente.
