# Correção da auditoria adversarial

Autorização: o usuário pediu todos os fixes e determinou conclusão no merge em dev. Base de implementação: `e115b667d845822a1df5f523bbfd828ab57ca978`, já com #713 e #716 integradas. A auditoria histórica permanece intacta.

## Frentes isoladas

| Frente | Branch | Itens |
| --- | --- | --- |
| Comportamento | sf-fix-behavior | BA-01, BA-03–09, BF-01; colaboração no review compartilhado |
| Produto | sf-fix-product | B1, B6–13; review compartilhado BA-05/06 |
| Sistema visual | sf-fix-system | SYS-01/02/04, SUP-01/02, REF-01/02, reconciliação SUP-03 e refinamentos |
| Integração e BI/reviews | sf-adversarial-audit | B2–5, ROOT-01–03, composição, revisão fria, Actions, merge |

SYS-03 foi corrigido pela #716. SUP-03 e observações da última wave serão confrontados com #713 antes de alterar. A #613 permanece separada e não será integrada inteira como atalho para estes fixes.

## Regras de conclusão

- Produto e verificações executáveis somente em GitHub Actions, Linux, pelo test-ci existente.
- Preservar fonte/identidades, CAS, autorização, guards, significado financeiro e drafts.
- Manter a identidade visual Orchestra, com glass, tokens, temas e tipografia nativos.
- Testes novos verificam propriedades reais; não apagar oráculos, aumentar timeout ou usar retry para mascarar falhas.
- Capturas originais dos estados alterados e revisão independente; distinguir cobertura de conteúdo de recusa/precondição.
- Integrar somente o candidato composto revisado e verde, com SHA e recibo de merge verificados.
