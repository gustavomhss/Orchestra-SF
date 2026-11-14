# W27 — Composição e observação Memory

O callback próprio `readMemoryCanonical` usa o mesmo factory real de records já composto, para uma chamada Atlas completa após a closure ser comprovada pelo helper Memory. O pacote não implementa um produtor alternativo nem modifica C08, BCS, Atlas, refs estrangeiras ou o engine.

O teste preserva as 84 expressões expect anteriores em ordem, a cauda inteira de lifecycle/stale/cancelamento/output/capture byte a byte e os budgets de 225.000/240.000 ms. Oito assertions adicionais observam as chamadas e conclusões reais Atlas sob o root: duas em prepare, verify e accept-output, e uma no recall isolado. Contadores globais C08/root/nested/evidence continuam sendo chamadas de API, não conexões físicas ou commits.

Este é um selo autoral de duas fontes. O helper Memory está selado separadamente; o generic v1 preservado recebeu finding de egress e não será composto. Somente seu sucessor v2, após recheck independente, é elegível. O resultado e qualquer ganho temporal dependem do CI hospedado no SHA composto. Não houve teste, import, build ou typecheck local de produto. FINAL=false; sem aceite nativo/global.
