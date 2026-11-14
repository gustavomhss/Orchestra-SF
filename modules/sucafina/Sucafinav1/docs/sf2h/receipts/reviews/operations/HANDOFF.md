# Handoff — revisão independente de Operações

**Estado da revisão:** COMPLETE_WITH_FINDINGS.  
**Aceite integral do produto:** NOT_GRANTED.  
**Revisor:** Astra. Data: 2026-11-14 UTC.

## Pin revisado

- PR: https://github.com/gustavomhss/Orchestra-SF/pull/34
- Head: `ba8a09e371ce8d93eb917eabb102caaee5affaf4`.
- Tree: `eb427121bcfd8c2511aac31d908f3c0d52c1915e`.
- Produto W5: `c4a2f4ebeb88f5915e51569b921be06b3c37ddad`.
- Recuperados: #23 `91e1f60bc6f7e85517e2b4f963eec5ac7da13e62`; #26 `e7fd8ff797441681f360e7775155a8cc2830280c`.
- Fonte normativa: `dbf9547211d9b0fade619790de7c19c0869b7c7d`.
- Branch documental: `review-operations`; destino: `sf2-control`.
- Base documental preservada: `d3d411f7e2476a562a57aa7620823980eaf34e46`.

## Ações por owner

| Item | Classe / prioridade | Owner | Próximo passo |
|---|---|---|---|
| D-OPS-01 | Defeito estático confirmado / P2 | Operações, WP06.T05 | Corrigir reuso de schema/intenção ao repetir o form; provar duas submissões contra serviços reais, após confirmação e após resposta perdida. |
| I-OPS-02 | Inferência de consumidor apoiada em H05 executado / P2 | Interface/WP01 com Operações/WP04 e WP11 | Oferecer recuperação autorizada do recibo pós-commit com caso concorrente; provar reabertura/reconciliação sem novo efeito e sem perder a edição concorrente. |
| E-OPS-01 | Ausência de evidência | Interface/WP01, WP04, WP10/WP11 | Demonstrar restart completo C12; H06 é cache clear na mesma fixture e H09 não completou. |
| E-OPS-02 | Ausência de evidência | WP06 com WP10 | Recriar runtime de importação sobre o mesmo banco, recuperar manifest/receipt e repetir Apply sob acesso corrente sem duplicação. |
| E-OPS-03 | Ausência de execução | WP10 | Qualificar recusa de diretório/banco com UID estranho; dois casos foram skipped por condição de privilégios. |

Os detalhes de reprodução, consequências, arquivo/linha, critérios e correção esperada estão em [REVIEW.md](REVIEW.md). A matriz de runs, W/S, jobs, hashes e blobs está em [EVIDENCE.json](EVIDENCE.json).

## Resultados que continuam parciais

- Os mapas contêm os 111 critérios WP04 e 140 WP06 com IDs/textos canônicos exatos; isso não é aprovação de 251 critérios.
- H01–H08 usam implementação/SQLite reais e passam no W5; o run agregado 43584405211 falha em startup/H09/lifecycle.
- Run 43584394810 mantém typecheck Sucafina FAIL em Atlas; run documental 43586639212 tem guard PASS e ambos typechecks skipped.
- Os sete logs auditados coincidem com os hashes/tamanhos declarados. ZIP/PNG não foram auditados integralmente.
- Browser WP06 usa renderer real e HTTP sintético. Sessão/MCP usa serviços reais com provider gravado. Não qualificam scanner instalado, inferência externa ou GNATIVE completo.
- Resultados posteriores de Compose/Interface foram mantidos nos seus próprios SHAs.

## Pendências anteriores preservadas

Referenciar os registros existentes de Atlas/OPS-CONSUMER-02, H09/OPS-NATIVE-UI-ACQUISITION, parser genérico/OPS03, provas humanas WP04, AM/GNATIVE WP06, produtor público Procurement Choice e existing-receipt/Dashboard reload. Este parecer não cria IDs novos para essas mesmas pendências.

## Restrições cumpridas

Somente documentação no diretório autorizado. Sem alteração de produto, políticas, plano ou branches dos autores; sem testes locais, disparo de CI, epic ou merge. Toda operação remota por GitHub MCP. Evidência adicional acima é solicitação ao owner para uma correção futura, não execução autorizada por esta revisão.

S0 deve reconciliar os achados e as provas no candidato final antes de considerar aceite integral. A revisão está entregue; o produto permanece não qualificado integralmente.
