# Next bundle 49-108

Compared with `git diff --stat origin/close-final-candidate FETCH_HEAD` after `git fetch origin pull/N/head`.
Candidate `a63c4c7335`. Branch base `origin/sf-red-clusters` `26ffe24cf8`.

49 6345 UNIQUE
50 6350 UNIQUE
51 6345 UNIQUE
63 6383 UNIQUE
64 6385 UNIQUE
66 6385 UNIQUE
67 6290 UNIQUE
76 3362 UNIQUE
83 3137 UNIQUE
88 2941 UNIQUE
91 2916 UNIQUE
94 2446 UNIQUE
97 1962 UNIQUE
98 1961 UNIQUE
99 3375 UNIQUE
100 1960 UNIQUE
106 1797 UNIQUE
108 1716 UNIQUE

Ported the docs-only residual missing on the candidate, without deleting an assertion: 83, 91, 94, 97, 98, 100, 108.
Left UNIQUE and unported because the residual is large: 49, 50, 51, 63, 64, 66, 67, 76, 88, 99, 106.
