
## 9. CI via GitHub Actions — autorizado a todo mundo que entrega

Cada entrega precisa de prova real, não de inferência. Você PODE e DEVE abrir um **PR draft** do seu `sfa-*` para **`close-final-candidate`** — o `sf-ci.yml` dispara no `pull_request` e roda o CI full novo no Linux. Depois:

- aguarde e REPORTE o resultado: `run_id`, `head SHA`, `job IDs` e a conclusão EXATA de cada job (preflight/static/omni/5 unitárias/3 UI/`sf/verify`);
- **nunca mergear, aprovar, fechar ou empurrar direto** para `sf-ci-lean`, `sf2-epic-c` ou `close-final-candidate`; o PR é rascunho — quem decide merge é o dono (+ A6/A1);
- se seu MCP do GitHub não permite criar PR, **PARE e relate** em vez de contornar com push direto ou outro branch;
- o CI é caminho COMPLETO de evidência: sucesso aqui não apaga a necessidade de `BLOCKED_BY_ENV` nos itens de VM/Microsoft; nada de verde do PR vale como Azure qualificado.
