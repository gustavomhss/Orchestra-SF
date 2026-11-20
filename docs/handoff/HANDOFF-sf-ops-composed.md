# Handoff — sf-ops-composed

## SHA e estado

- Estado: **COMPOSED / PENDING_ACTIONS**.
- Branch: `sf-ops-composed`.
- Base congelada: `sf-ui-c02@f732f10592fe00b04ddd8490fd3d0cade5d357d0`.
- Código da composição: `6ed717338ab983c546da64d100ea9dfb00bbe5d6`.
- Árvore de código: `996114495a9b65d2bdfd145f685f26fa9e1b05cc`.
- Operations entregue: `sf-continuation-ops@c3866403562e462f55d527d592f19cbc817ed0cf`, código final `826ac96a747ba64af13e7860a850f3bae235656c`.
- A branch foi criada no SHA exato da UI; somente sf-ops-composed recebeu escritas. Nenhuma escrita em sf-ui-c02 ou sf-continuation-ops.

## Feito

- Portados os deltas Operations dos 16 paths de código autorizados, mais seu handoff histórico.
- Reconciliados Requests/page, Sourcing/index e Suppliers/index sobre os arquivos da UI congelada.
- Preservados C02, controles bancários, source facts e controles PO da UI. Suppliers conserva data-version e acrescenta data-source-version com a mesma expressão version().
- Native-ui/procurement recebe somente o selector request de CAP26 e a whitelist de attachments do Supplier original; qty/unitPrice/C02 da UI não foram reescritos.
- Acrescentados os dois blobs Files #393 exatos como dependência declarada, sem declarar merge do PR.
- [Compare publicado](https://github.com/gustavomhss/Orchestra-SF/compare/f732f10592fe00b04ddd8490fd3d0cade5d357d0...6ed717338ab983c546da64d100ea9dfb00bbe5d6) conferido: pai único/base exatos; 19 paths de código autorizados + handoff histórico; nenhum path extra.
- Detalhes de reconciliação, decisões de equivalência e mapa integral de blobs em [COMPARE-sf-ops-composed.md](./COMPARE-sf-ops-composed.md).

## Decisões de composição

Sourcing já possuía na UI o dl de seleção/justificativa e os campos PO supplierId/qty. Esses elementos foram preservados, sem adicionar cópias equivalentes da branch Operations. Todos os outros deltas Operations desse arquivo foram aplicados.

Em Suppliers, data-version do editor permanece intacto. O detalhe tem data-version e data-source-version, ambos fornecidos pelo mesmo version(); não há contador local novo.

Os arquivos não sobrepostos de Operations e os dois arquivos de #393 mantêm identidade exata de blob. A composição não move nenhum ref de origem nem simula um merge.

## Dependências já presentes e gate pendente

- Host wp04 da UI: blob `7f15371d8bb30c2aaf4db11e7fb2b03ab486d764`, serve o WebUi real em 4174 e emite o manifest/IDs originais.
- Perfil nativo da UI: `native/select-profile.ts`, blob `7aef924e0397f54a03adf0a63c2483ca1a7115c4`.
- Files bindings: `dcf4229af5745da305906a2c1f7ce42427fd62bd`; teste original: `072a58358f4057526a932d0a22981194e7786612`.
- A raiz fornece a configuração compartilhada e ClamD real, preservando o host próprio de Operations e a proteção de artefatos autenticados.
- Gate solicitado à raiz: **uma execução integral** de `e2e/sucafina/operations.spec.ts`, sozinho, no snapshot final congelado.
- Não houve gate, PR, merge, sf-ci ou pacote neste WP. Resultado/run/artefato deste código: **NOT_RUN**.

## O que permanece aberto / unbound

- Qualificação Actions completa desta composição. O handoff não é complete.
- Os quatro cenários falhos do Operations8 permanecem apenas como evidência histórica até o próximo gate. Nenhuma falha nova foi atribuída a este SHA sem execução.
- O compare não qualifica automaticamente o PR #393 ou a Sessão 1, nem altera sua ordem de integração.

## Como retomar

1. Revisar o compare congelado e o mapa de proveniência.
2. Compor a configuração compartilhada aprovada, conferir ClamD real e congelar o SHA do gate.
3. Executar o único gate Operations centralizado. Guardar run/jobs/artefatos e a primeira falha file:line ou os cinco passes reais.
4. Em falha, corrigir causa concreta antes de nova execução. Em sucesso, atualizar handoff com o SHA exato qualificado e seguir a integração coordenada.
5. Sem GO, deploy, baseline fabricado ou verificação de pacote emitida por este WP.
