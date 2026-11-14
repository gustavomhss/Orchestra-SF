# WP10 — recuperação e composição W13

Este commit continua W12 (`417038d6b3cfd1817f40ffc60e56f42e505b50a5`) na branch `astra-wp10`. O handoff e os 171 critérios literais continuam normativos. Os 128 foreign copies e os 131 inputs somente leitura permanecem arquivados; não foram promovidos automaticamente a fontes canônicas.

## Alterações próprias

- Escopos lexicais de BI, alternativas, comparações e recall Atlas impedem empréstimo de prova por outra invocação, preservam as leituras de autoridade e só reutilizam resultados completos do produtor real no mesmo snapshot autorizado.
- O recall Planner/Atlas inclui identidade da Request, principal, dia UTC, caso/incarnation/version, C08 e fontes; revalida a saída após os awaits finais e libera o escopo em finally.
- A persistência recebe `replay: planner` para o contrato publicado WP03. Nenhum cálculo financeiro é reimplementado no host.
- BI controla sua atualização e descarte sem o timer genérico substituir o DOM; inserções de bundles usam callback para preservar bytes JavaScript que contêm padrões de substituição.
- Os fixtures de browser consomem o bundle real, verificam os bytes e mantêm contraprovas de revogação; a seleção de alternativas mantém as assertions anteriores e adiciona limites temporais e de concorrência.
- O teste de revogação exige recusa do resultado ao perder a admissão real. O consumidor de saved views exige o stub opaco atual, sem dados privados do destino removido.
- O workflow conserva os checks completos e acrescenta typecheck dos consumidores WP10. O envelope de entrega só admite novos arquivos JSON/Markdown/TXT de evidência.

## Composição publicada

`intake-pins.json` preserva o histórico de pins, identifica blobs efetivos e registra exclusões justificadas. As fontes de domínio são copiadas exatamente dos commits publicados. Os ajustes de composição são escritos somente nos paths WP10.

## Limites de aceitação

Os recibos W8/W12 são históricos, não provas deste candidato. Os três autores/auditores da recuperação não assinam os três pareceres independentes finais. O pacote final deve registrar SHA W de produto, snapshots S, IDs de run/job, conclusão observada e mapa literal dos 171 critérios.

C07 continua sem executor nativo admitido nem descritores de rotina registrados neste host. A carga real de cinco perfis e dezoito skills, isoladamente, não prova inferência, 39 operações, oito outputs ou AM01–AM06. O epic e a aceitação global pertencem ao bundle completo posterior; não são declarados aqui.

Há pendências de domínio que esta composição não pode corrigir por autoria: resolver Procurement em WP14, inferências de tipos em WP12/WP14, e compatibilidade do hardening Portfolio WP13. O check hospedado deve registrar sua manifestação exata.
