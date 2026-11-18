# Close proof for PRs 181-280

Candidate: `origin/close-final-candidate` `a63c4c733523294450f605e73de3306edff81e58`.

Close rule, and no other: for a PR head, `mb=$(git merge-base origin/close-final-candidate FETCH_HEAD)` and files are `git diff --name-only $mb FETCH_HEAD` (two-dot, not three-dot). Close only when that list is empty, or every file has the same blob token on the PR head and on the candidate. A differing file is unique work and stays open. A closed PR with any differing file is reopened. An open PR whose files all match is closed with `gh pr close N --repo gustavomhss/Orchestra-SF` and no `--comment`.

Absence token: bare `git rev-parse <rev>:<path>` writes the spec to stdout and exits 128 when the path is absent, so it cannot be the MISSING token. The token is `git rev-parse --verify <rev>:<path>`, and MISSING when that command fails with empty stdout. Present-path tokens were checked against `git ls-tree` for every compared file; none disagreed.

PR heads were `git fetch origin pull/N/head`. Named refs in an isolated clone are that fetch. Control: `git fetch origin pull/276/head` then `git rev-parse FETCH_HEAD` equals `refs/proof/pr-276` (`a6c4a6eb040fad48d2338264442acbde290a33d2`).

Not used: three-dot diff, tip-to-tip `git diff --quiet`, a bundle commit that mentions the number, tests, CI, merge, push to `sf-red-clusters`. No branch was deleted. #237 was not fetched, closed, reopened, or commented.

## Result

- Closed by this pass: 7 (#191, #208, #225, #226, #232, #236, #276)
- Reopened by this pass: 0
- Left open (unique work): 71
- Already closed and matching, left closed: 4 (#233, #240, #255, #256)
- Merged, untouched: 17
- Skipped: #237 (still OPEN)

Left open: #181, #182, #183, #184, #185, #186, #187, #188, #189, #190, #192, #193, #194, #195, #196, #197, #198, #199, #200, #201, #202, #203, #204, #205, #206, #207, #209, #210, #211, #212, #213, #214, #215, #216, #217, #218, #219, #220, #221, #222, #223, #224, #227, #228, #229, #230, #231, #234, #235, #239, #242, #244, #245, #246, #247, #248, #249, #250, #251, #252, #253, #254, #257, #258, #259, #260, #268, #270, #272, #274, #280

Merged untouched: #238 EMPTY, #241 EMPTY, #243 MATCH, #261 UNIQUE, #262 MATCH, #263 MATCH, #264 MATCH, #265 UNIQUE, #266 UNIQUE, #267 UNIQUE, #269 UNIQUE, #271 EMPTY, #273 UNIQUE, #275 MATCH, #277 EMPTY, #278 MATCH, #279 UNIQUE

## Controls

- `git diff --name-only` of the candidate against itself is empty.
- The candidate tip commit changes 25 files; an added path is MISSING on the parent and a blob on the candidate; a modified path has two different blobs. Both candidate blobs match `git ls-tree`.
- An absent path is exactly `MISSING` on two different commits, so both-absent compares equal.
- An unchanged path has equal tokens.
- NUL and line file counts agree on that tip commit.
- Every EMPTY verdict also has `git diff --quiet $mb <head>` exit 0. Every non-empty verdict has exit 1. No rename-format path and no count mismatch.
- Spot checks: #191 merge-base equals its head and the file list is empty. #240 `packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts` is `ed2ea1dcf1716dddbd71e358001be22291cca564` on both sides. #229 `apps/cli/src/sucafina-product/native-ui/live-context.ts` is `c0f11d5ee6aeda3b5ac708df5c8d4436e602f830` on the PR head and `573f1af22df6bba4408d4727e8a8dba9ad5db059` on the candidate.

After the closes, a fresh state read matched this proof: no open match/empty PR, no closed unique PR, #237 open. Refs were refetched first and no head SHA had moved. Candidate SHA was unchanged.

## Per PR

| PR | before | after | verdict | action | files | differs | head | merge-base |
|---:|:---|:---|:---|:---|---:|---:|:---|:---|
| 181 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 6 | 6 | `0730dfa7134ca46df3d89c46801ee200f28e168e` | `913b6b8f143e6c3e869eee293d02f04259c7cdd1` |
| 182 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 13 | 10 | `2c0416ca80c2367843be7b39dbc4a7fb677a2185` | `6607c60d2a2be183d59c2e929b3ff06633e1cb54` |
| 183 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 7 | 3 | `34a00f196de20de359b53f51fbe9007442f8cea4` | `6607c60d2a2be183d59c2e929b3ff06633e1cb54` |
| 184 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 7 | 7 | `3ec7a4ca7db735c08f1f63e164734a0bda245ac7` | `6607c60d2a2be183d59c2e929b3ff06633e1cb54` |
| 185 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 8 | 7 | `cb7a19356da4e9ba33c902264a1b4aa25639d976` | `4426445c05823ed4932b8a8e35391df024bf74f3` |
| 186 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 6 | 5 | `1f9220cd68f84237f4c2dc6d3f28b858f5de2bda` | `4426445c05823ed4932b8a8e35391df024bf74f3` |
| 187 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 6 | 3 | `e6e8ecdc63ea7cc8070c15aec16c001c4b657a13` | `4426445c05823ed4932b8a8e35391df024bf74f3` |
| 188 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 8 | 6 | `c8af58da3cb7c8734c2d2f126e63fd1ddabd0440` | `4426445c05823ed4932b8a8e35391df024bf74f3` |
| 189 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 13 | 9 | `df9fdd3afa36ccc2f686d165104546819eb96dfc` | `4426445c05823ed4932b8a8e35391df024bf74f3` |
| 190 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 21 | 7 | `9b512eeffa9c437967b03d5af6dab11a1718f48b` | `6607c60d2a2be183d59c2e929b3ff06633e1cb54` |
| 191 | OPEN | CLOSED | EMPTY | CLOSED_BY_US | 0 | 0 | `998f0afd6047409956418f40c570dc9c48dc6c8f` | `998f0afd6047409956418f40c570dc9c48dc6c8f` |
| 192 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 10 | 10 | `cca757a0e125de371cb677342802509fb769bbd2` | `6130f682014662964a2f2fcd2c0c487a904ecd3e` |
| 193 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 9 | 8 | `e8dfeb4cb4e122318b6289fbeb8fe4da9ef53f64` | `7abf6c425e9b480bb43ba4a82f29c02a55445b92` |
| 194 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 12 | 7 | `6f65ea078a3c596fca02961a68d98d36778bd54f` | `7abf6c425e9b480bb43ba4a82f29c02a55445b92` |
| 195 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 8 | 7 | `14f894e3c70d14092a50931cc511250d276e107c` | `7abf6c425e9b480bb43ba4a82f29c02a55445b92` |
| 196 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 8 | 7 | `0d37528d52eb27c2cfafd9772508914e03f2f7f4` | `7abf6c425e9b480bb43ba4a82f29c02a55445b92` |
| 197 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 15 | 13 | `6ec7d43fdaa63268540f30e80d590d9af85d2988` | `7abf6c425e9b480bb43ba4a82f29c02a55445b92` |
| 198 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 15 | 9 | `155091aa164f18e65a7fb6c398dad3d6789d22c7` | `7abf6c425e9b480bb43ba4a82f29c02a55445b92` |
| 199 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 9 | 7 | `8f4f7e102ac1b73dc014e23737cc62bba84043ee` | `7abf6c425e9b480bb43ba4a82f29c02a55445b92` |
| 200 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 7 | 7 | `8781a3b7c4c648e5e637caf94bfd187f87c9327a` | `e6488a4d7694464d9d7d457f0604abe93e0ea49e` |
| 201 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 9 | 7 | `f4fc2af5809f8af6c2dc5b8ddcb176ee3409f002` | `e6488a4d7694464d9d7d457f0604abe93e0ea49e` |
| 202 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 10 | 9 | `b3d7fcfe5a1a76a673de1914eb01bff2f233f647` | `e6488a4d7694464d9d7d457f0604abe93e0ea49e` |
| 203 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 17 | 14 | `124901e88d21595de205f2e2a26846a5409682b7` | `c5703ca53399a4ead279cdf4df3c1261eef1dd8e` |
| 204 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 14 | 11 | `c2f0ef0ce180aad3fe31bd3af8485400ee4e0d79` | `998f0afd6047409956418f40c570dc9c48dc6c8f` |
| 205 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 21 | 19 | `1872cc6a60809dec489ce1b486114aaa6e87a77b` | `998f0afd6047409956418f40c570dc9c48dc6c8f` |
| 206 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 85 | 85 | `ad330d3ce08649671aae5c7e6aa3b3f40e446c72` | `529142f63683de8e4b1f7d4232f88faf8ffcef6c` |
| 207 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 19 | 19 | `b8d0e46d6fcca835f345bd5e0d5f719d8047c757` | `998f0afd6047409956418f40c570dc9c48dc6c8f` |
| 208 | OPEN | CLOSED | EMPTY | CLOSED_BY_US | 0 | 0 | `728dc732cd070a539df1ef055566b3ace3224d11` | `728dc732cd070a539df1ef055566b3ace3224d11` |
| 209 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 23 | 21 | `95322577a4f4b1392163695b990199e5f88655fb` | `998f0afd6047409956418f40c570dc9c48dc6c8f` |
| 210 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 8 | 8 | `5d99be45187df73a89b4f31a3f7db22aa0c49c98` | `998f0afd6047409956418f40c570dc9c48dc6c8f` |
| 211 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 17 | 10 | `28489fdaa75f326c77926d717a0523099339902b` | `998f0afd6047409956418f40c570dc9c48dc6c8f` |
| 212 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 32 | 27 | `01a957f081cfb3a022ce9a235e965be2509d6b7b` | `998f0afd6047409956418f40c570dc9c48dc6c8f` |
| 213 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 16 | 14 | `98680073f6f193c0c9632493f9cfe3f470c19aa1` | `998f0afd6047409956418f40c570dc9c48dc6c8f` |
| 214 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 16 | 14 | `715dd8771a78925551086a6cfb91dfe4d98bcc68` | `395012bcf4e142f0769ae6fa8138c4b7097a04b9` |
| 215 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 44 | 41 | `2ad6b5dc0cb16bbe5b3508a2fe824f1dda740619` | `998f0afd6047409956418f40c570dc9c48dc6c8f` |
| 216 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 27 | 26 | `ea49ca9fa6a8f7191aecceaf9fdb6bbf06e41282` | `395012bcf4e142f0769ae6fa8138c4b7097a04b9` |
| 217 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 6 | 6 | `c060c89937ed0cb3a3da9172c47cd81be6d4ae11` | `81d183dd0ee520e1accf4543ed05de70c1c2d8b8` |
| 218 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 7 | 7 | `a147233718906c78b16117678c39dec88d643d16` | `81d183dd0ee520e1accf4543ed05de70c1c2d8b8` |
| 219 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 8 | 8 | `010adbefece7fa81964595ff09f392df018cb3e3` | `bd97460230ce73a823e4a13b16ddd751ff78aa69` |
| 220 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 4 | 4 | `23039b6391feb0187098d5aa33922c849d12e6e7` | `27a2a5a4de019b6319a1751651ea86a4bf43dd5d` |
| 221 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 7 | 7 | `81ebae7f37b2a9cca3ed9c64a1992f07adb02010` | `728dc732cd070a539df1ef055566b3ace3224d11` |
| 222 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 43 | 5 | `2100afcf9fcb5d8edadda2efa43e22705b6f3081` | `728dc732cd070a539df1ef055566b3ace3224d11` |
| 223 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 43 | 19 | `892fe88128e4f692192c740b7932f71b03a4d850` | `728dc732cd070a539df1ef055566b3ace3224d11` |
| 224 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 38 | 9 | `c4e662b150608071a06804b11909443bf1f19a42` | `728dc732cd070a539df1ef055566b3ace3224d11` |
| 225 | OPEN | CLOSED | EMPTY | CLOSED_BY_US | 0 | 0 | `104f844380e4b86da1ac2283f645602a45d4a43a` | `104f844380e4b86da1ac2283f645602a45d4a43a` |
| 226 | OPEN | CLOSED | EMPTY | CLOSED_BY_US | 0 | 0 | `b62718a69462ed8e9c8745f1a2da767627d0f0de` | `b62718a69462ed8e9c8745f1a2da767627d0f0de` |
| 227 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 54 | 30 | `3ab96612169009bb9fa533e41a1b738a66f1cab9` | `17a0ba0e931b4d185c4b61b558bf6e7c1992c9e7` |
| 228 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 27 | 16 | `b9a2c66da682a86a572be06e0f7179afec15afcc` | `05f6eb06c8424fd66a0e927fc9dc04095c5b4473` |
| 229 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 2 | 1 | `709aede6d9d5b80941b64bd2329c163abc98da38` | `226c6b73669761bb925a4173b5d336816af3a6e4` |
| 230 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 48 | 22 | `387725772170391936a880eea0d8c026a8d68c27` | `17a0ba0e931b4d185c4b61b558bf6e7c1992c9e7` |
| 231 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 6 | 1 | `cda588e0614988a0d70a9ee8a878794631d79771` | `ae1a9c0ccc1436e475f6713f9223becbbf2636ad` |
| 232 | OPEN | CLOSED | MATCH | CLOSED_BY_US | 4 | 0 | `2371296ca4b4f3c585884c7687c1218e277987ad` | `ae1a9c0ccc1436e475f6713f9223becbbf2636ad` |
| 233 | CLOSED | CLOSED | MATCH | LEFT_CLOSED | 9 | 0 | `05467fa52088a0b6c7370012d58705738eef0140` | `ae1a9c0ccc1436e475f6713f9223becbbf2636ad` |
| 234 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 49 | 22 | `32030c5924b719647e19e4f7ddbef16eae5cd425` | `17a0ba0e931b4d185c4b61b558bf6e7c1992c9e7` |
| 235 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 60 | 30 | `61ddba8cd9e0167fcb740dcdc1cf8722e79a39f6` | `17a0ba0e931b4d185c4b61b558bf6e7c1992c9e7` |
| 236 | OPEN | CLOSED | EMPTY | CLOSED_BY_US | 0 | 0 | `4f6752b3fcdf38088f0c16f3b836392de14c72f7` | `4f6752b3fcdf38088f0c16f3b836392de14c72f7` |
| 237 | OPEN | OPEN | SKIP | SKIP | 0 | 0 | `-` | `-` |
| 238 | MERGED | MERGED | EMPTY | MERGED_UNTOUCHED | 0 | 0 | `54017d2901d264381c6632a86126cbe490fee88c` | `54017d2901d264381c6632a86126cbe490fee88c` |
| 239 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 2 | 2 | `d1f86986a8fa7e1df46a126dba8f51b71531c0f6` | `104f844380e4b86da1ac2283f645602a45d4a43a` |
| 240 | CLOSED | CLOSED | MATCH | LEFT_CLOSED | 1 | 0 | `cb943677b95a5cd6e111d4d36cffe9fc0054b181` | `42d344a0efc4d85187388f149c54acac2db171da` |
| 241 | MERGED | MERGED | EMPTY | MERGED_UNTOUCHED | 0 | 0 | `3a99b06c585f8963af754b977f1b9f710d3ddba9` | `3a99b06c585f8963af754b977f1b9f710d3ddba9` |
| 242 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 16 | 5 | `2f94d74d50dceee8a3c0562feac27a7335171ae8` | `ae7850a7e397e8f0e60033ae4c5eca5e11b77c7f` |
| 243 | MERGED | MERGED | MATCH | MERGED_UNTOUCHED | 1 | 0 | `2e1cee39a133400c41bfe3426f9a3927885cbff4` | `1cb77b8deb144e01a655c36987922338b1474003` |
| 244 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 5 | 5 | `bd902fe45aab81fb61f58f5eb79f80c833f4954e` | `1cb77b8deb144e01a655c36987922338b1474003` |
| 245 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 4 | 4 | `59012d8dc7a5a7efce5e0b24ef4b610101014e65` | `1cb77b8deb144e01a655c36987922338b1474003` |
| 246 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 26 | 10 | `d93b695b04876b4194dfa267ca3b795d87f2737d` | `1cb77b8deb144e01a655c36987922338b1474003` |
| 247 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 25 | 12 | `a8634972abb4e042fc4cf401c2c6c966f2f56cb7` | `ae7850a7e397e8f0e60033ae4c5eca5e11b77c7f` |
| 248 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 44 | 29 | `7c68373566bb659f1cd025fb6429820c234d8be7` | `ae7850a7e397e8f0e60033ae4c5eca5e11b77c7f` |
| 249 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 35 | 20 | `23792c2d1e2baf55e3ec17723147e27d0d6af840` | `ae7850a7e397e8f0e60033ae4c5eca5e11b77c7f` |
| 250 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 26 | 11 | `28ac635a371e91504bc2eec9d193e6c1225a1eb8` | `ae7850a7e397e8f0e60033ae4c5eca5e11b77c7f` |
| 251 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 25 | 10 | `7aafa32d6673d13f456a4a9caffd307614129dea` | `1cb77b8deb144e01a655c36987922338b1474003` |
| 252 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 35 | 18 | `e8f6fc475514488cf7aa40df350fc46674263935` | `ae7850a7e397e8f0e60033ae4c5eca5e11b77c7f` |
| 253 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 22 | 7 | `831e0ea2862fd2ce111f1fbe4304d05077d213df` | `ae7850a7e397e8f0e60033ae4c5eca5e11b77c7f` |
| 254 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 5 | 3 | `b67cb17eef6962e4007dab7a0cde27672367f92b` | `1cb77b8deb144e01a655c36987922338b1474003` |
| 255 | CLOSED | CLOSED | MATCH | LEFT_CLOSED | 1 | 0 | `0b53c61dda85401f9245ed9528e3d9669f6e69f1` | `1cb77b8deb144e01a655c36987922338b1474003` |
| 256 | CLOSED | CLOSED | MATCH | LEFT_CLOSED | 1 | 0 | `22002409d2b2fce52427c6b7a53fd7b733b40f96` | `1cb77b8deb144e01a655c36987922338b1474003` |
| 257 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 16 | 7 | `591424661cf43baedf798b470a112d32b9b0c514` | `1cb77b8deb144e01a655c36987922338b1474003` |
| 258 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 14 | 9 | `cfb01f61e8c48c5779288b0b4b24220cc28662ab` | `1cb77b8deb144e01a655c36987922338b1474003` |
| 259 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 1 | 1 | `a5ab1f4b7bd5e2729c572fc5ae23ebf68debcffe` | `42d344a0efc4d85187388f149c54acac2db171da` |
| 260 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 65 | 39 | `aec42536013f06d518e0cf5053982e319a41199a` | `1cb77b8deb144e01a655c36987922338b1474003` |
| 261 | MERGED | MERGED | UNIQUE | MERGED_UNTOUCHED | 1 | 1 | `cdd9cf0533080cc1351a5833c12d966b9b3effc6` | `42d344a0efc4d85187388f149c54acac2db171da` |
| 262 | MERGED | MERGED | MATCH | MERGED_UNTOUCHED | 10 | 0 | `58fc3945d759b307cb2a963fa2a23f823af21d4c` | `c383a7e05ccccded6161247a077504d0119cd5a8` |
| 263 | MERGED | MERGED | MATCH | MERGED_UNTOUCHED | 1 | 0 | `405c4b72eb748278f89d2ffd6d66cb333aa3267c` | `1cb77b8deb144e01a655c36987922338b1474003` |
| 264 | MERGED | MERGED | MATCH | MERGED_UNTOUCHED | 1 | 0 | `9cd3ac2a415e443cb95b76143c2296341cc3200e` | `1cb77b8deb144e01a655c36987922338b1474003` |
| 265 | MERGED | MERGED | UNIQUE | MERGED_UNTOUCHED | 15 | 8 | `8903d27f5d6a546f20f16ab651a4d4241d29bc2e` | `1cb77b8deb144e01a655c36987922338b1474003` |
| 266 | MERGED | MERGED | UNIQUE | MERGED_UNTOUCHED | 25 | 10 | `c49089244ea6c0e5c9d79ec0caa076127cedcaad` | `1cb77b8deb144e01a655c36987922338b1474003` |
| 267 | MERGED | MERGED | UNIQUE | MERGED_UNTOUCHED | 16 | 7 | `591424661cf43baedf798b470a112d32b9b0c514` | `1cb77b8deb144e01a655c36987922338b1474003` |
| 268 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 8 | 8 | `9802e2779dc2190203f672e60a3ed9d58d5d4438` | `42d344a0efc4d85187388f149c54acac2db171da` |
| 269 | MERGED | MERGED | UNIQUE | MERGED_UNTOUCHED | 12 | 9 | `88ef34d600932c155b7770977b71e9e5d173dcb8` | `42d344a0efc4d85187388f149c54acac2db171da` |
| 270 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 14 | 13 | `78e35990f84335e5ddb6fcd40e785a4925141373` | `42d344a0efc4d85187388f149c54acac2db171da` |
| 271 | MERGED | MERGED | EMPTY | MERGED_UNTOUCHED | 0 | 0 | `c91e888609bf5658deb7f4368e9ee17db9f6b08e` | `c91e888609bf5658deb7f4368e9ee17db9f6b08e` |
| 272 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 14 | 13 | `78e35990f84335e5ddb6fcd40e785a4925141373` | `42d344a0efc4d85187388f149c54acac2db171da` |
| 273 | MERGED | MERGED | UNIQUE | MERGED_UNTOUCHED | 2 | 1 | `9e26dd225d626742d31948b3db3e1a58a5bd452e` | `c91e888609bf5658deb7f4368e9ee17db9f6b08e` |
| 274 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 1 | 1 | `47b555b2cc20d48b468e765e90431e04fa1c464a` | `c91e888609bf5658deb7f4368e9ee17db9f6b08e` |
| 275 | MERGED | MERGED | MATCH | MERGED_UNTOUCHED | 1 | 0 | `05046277256939a7ba0323568a34652ae0ee54b2` | `88e37c1f82823d8482051ef279cff433b6f18691` |
| 276 | OPEN | CLOSED | MATCH | CLOSED_BY_US | 1 | 0 | `a6c4a6eb040fad48d2338264442acbde290a33d2` | `a1e774ec9e1fc28c81e0b42a1889c0425060aed9` |
| 277 | MERGED | MERGED | EMPTY | MERGED_UNTOUCHED | 0 | 0 | `a1e774ec9e1fc28c81e0b42a1889c0425060aed9` | `a1e774ec9e1fc28c81e0b42a1889c0425060aed9` |
| 278 | MERGED | MERGED | MATCH | MERGED_UNTOUCHED | 1 | 0 | `6323f58c3b044d50fecd7ab79c51bf35b23259bf` | `a1e774ec9e1fc28c81e0b42a1889c0425060aed9` |
| 279 | MERGED | MERGED | UNIQUE | MERGED_UNTOUCHED | 39 | 3 | `c64919de72d3ed81fb49491aacb9051a6d1af20c` | `d624e44db8e2f8f15825566277ced51cfac8b0c7` |
| 280 | OPEN | OPEN | UNIQUE | LEFT_OPEN | 10 | 9 | `f212c3d0ac6107e38f129d331b36fb674b39f303` | `a1e774ec9e1fc28c81e0b42a1889c0425060aed9` |

## Match evidence

Every path below is in `git diff --name-only $mb <head>` and has the same `git rev-parse --verify` token on the head and on the candidate.

### #232

- `packages/core/package.json` `20e797fd5b5b3328d8e5ff652b2da647cdfef962`
- `packages/core/src/host/session-prompt.ts` `f700f5bf53f3f737d05892fe63603b776cccf8dc`
- `packages/core/src/session.ts` `33778d390e7d69a283eadb77b43610c311c898f5`
- `packages/core/test/session-prompt-observer.test.ts` `0c9c08892cbaedbbcc93e92e105934add1be8fc6`

### #233

- `modules/engine-adapters/claude-code/src/v2/host.ts` `157298c688432abbed6144d53f807461425a7ec8`
- `modules/engine-adapters/claude-code/test/v2-host-gate.test.ts` `b73211110a9c168004a696ffabccfa96720baf2f`
- `packages/core/src/session/runner/direct-commands.ts` `93e4de0452ed534467900539eedbacd7ee0f6ff5`
- `packages/core/src/session/runner/execution-host.ts` `138736184cd41fb9ef816811f555217cbee47c59`
- `packages/core/src/session/runner/llm.ts` `bd019e1a7176d9fc780de30c1d8ef1484a7cfc6a`
- `packages/core/src/session/runner/skill-load-receipt.ts` `86b14fc5677008c2bba0fa935fc53c84635f8e70`
- `packages/core/src/skill.ts` `4fe232a113aef92a3adde83cc2bfbea074945790`
- `packages/core/test/session-skill-observer.test.ts` `8228ad586491d61dee9bf8f919537ca7f698aee5`
- `packages/core/test/skill-load-receipt.test.ts` `430400f49daab66aa1c141e693d7eed8b7754f6e`

### #240

- `packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts` `ed2ea1dcf1716dddbd71e358001be22291cca564`

### #243

- `godfile-waivers.json` `1b5df4e9ea65c11657654d6117d03aba8d9fa657`

### #255

- `modules/sucafina/Sucafinav1/test/installation.test.ts` `dd8ad154a36b014f106f90ffe70b2b823435f766`

### #256

- `packages/app-shell/test-browser/sucafina-native/draft-quarantine.test.ts` `e058f78c1bbcaec5038bd1f1e272b386b2a64166`

### #262

- `.github/workflows/test-ci.yml` `fa45579123a38a4e909ff4ed1ddbc621af9b1bda`
- `modules/sucafina/Sucafinav1/test/installation.test.ts` `dd8ad154a36b014f106f90ffe70b2b823435f766`
- `packages/core/test/test-ci-request.test.ts` `46c52e307ed2c6857820b1a591b0c47187cbb355`
- `script/test-ci-request.ts` `1a0d476f7cec8c03daedcf14eb1fa99cbdb22019`
- `script/test-ci.ts` `7f763c99ac53c8d343b3e2257ec5fd33caba1419`
- `sf/release-target.json` `d09d113a3d7d328fdeb2f8b8a504dd478a3080ba`
- `validation/final-bundle/dispatch-agent.md` `80ebb024d44302fabd0ec95c0513b8b68a189ddb`
- `validation/final-bundle/gpt-plan-001-brief.md` `38e1c58f66c38dc0e2991b461690fc652b524cf7`
- `validation/final-bundle/gpt-review-pr240.md` `cc96371b2c8a7d93631d02e3b41c7e8df0e92bce`
- `validation/final-bundle/gpt-review-pr242.md` `f96e1eb9e45620645f4a0292146e14539606938e`

### #263

- `modules/sucafina/Sucafinav1/test/installation.test.ts` `dd8ad154a36b014f106f90ffe70b2b823435f766`

### #264

- `packages/app-shell/test-browser/sucafina-native/draft-quarantine.test.ts` `e058f78c1bbcaec5038bd1f1e272b386b2a64166`

### #275

- `packages/app-shell/test-browser/sucafina-native/transport-integration.test.ts` `92306fdd4c17620c929b184e9c5a11662b914d4b`

### #276

- `packages/app-shell/src/orchestra/chapters/sucafina/planner/overview/index.tsx` `19088961b21d227d9bdd3d41ebc14f7092d87acb`

### #278

- `packages/app-shell/src/orchestra/chapters/sucafina/planner/overview/index.tsx` `19088961b21d227d9bdd3d41ebc14f7092d87acb`

## Empty evidence

File list from `git diff --name-only $mb <head>` is empty. The head tree equals the merge-base tree, and the merge-base is an ancestor of the candidate.

- #191 head `998f0afd6047409956418f40c570dc9c48dc6c8f` merge-base `998f0afd6047409956418f40c570dc9c48dc6c8f`
- #208 head `728dc732cd070a539df1ef055566b3ace3224d11` merge-base `728dc732cd070a539df1ef055566b3ace3224d11`
- #225 head `104f844380e4b86da1ac2283f645602a45d4a43a` merge-base `104f844380e4b86da1ac2283f645602a45d4a43a`
- #226 head `b62718a69462ed8e9c8745f1a2da767627d0f0de` merge-base `b62718a69462ed8e9c8745f1a2da767627d0f0de`
- #236 head `4f6752b3fcdf38088f0c16f3b836392de14c72f7` merge-base `4f6752b3fcdf38088f0c16f3b836392de14c72f7`
- #238 head `54017d2901d264381c6632a86126cbe490fee88c` merge-base `54017d2901d264381c6632a86126cbe490fee88c`
- #241 head `3a99b06c585f8963af754b977f1b9f710d3ddba9` merge-base `3a99b06c585f8963af754b977f1b9f710d3ddba9`
- #271 head `c91e888609bf5658deb7f4368e9ee17db9f6b08e` merge-base `c91e888609bf5658deb7f4368e9ee17db9f6b08e`
- #277 head `a1e774ec9e1fc28c81e0b42a1889c0425060aed9` merge-base `a1e774ec9e1fc28c81e0b42a1889c0425060aed9`

## Unique evidence

A row is `head-token`, `candidate-token`, path. MISSING means `git rev-parse --verify` failed. Any difference keeps the PR open.

### #181

- `12e74ed9246b0a3e7c558ee32d7e21af76592e37` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure188/ACK-188.json`
- `e5385b7f540fac71d54b820b4e5fd647de35d5e3` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure188/CLEANUP-PROPOSAL-188.json`
- `8705a7cefd2a263a13f2df4ad437732365ad6a0c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure188/F04-REVIEW-188.md`
- `a542b16e0e28d37da59439fb2a3a4b691bb7898d` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure188/GATES-188.json`
- `f5af35206c5341d65cca8221da3722e960154f6c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure188/REVIEW-188.md`
- `3a35048ea1752f23c76c32686fee8f0e3c175b7f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure188/VALIDATION-REQUEST-188.json`

### #182

- `53c31e752c5d176b2b78d3ae99776ed477fe536f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure196/ACK.json`
- `55ecfd42cc0a7a74b05e0399eb3bc4b4a576423b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure196/CI-REQUEST.json`
- `d688cb12689d02c87d8d0e0e1c4dd270dc2ef899` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure196/HANDOFF.json`
- `52ba2addbf4a1c66fb5b695fcff66f52d088a238` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure196/HANDOFF.md`
- `48299ec512a3e1a55d4aac712c90195a7c62e4b9` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure196/RESOURCE-MANIFEST.json`
- `4603663dcee09735fe2a1703866316358ef0a832` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure196/S0-FENCE.json`
- `37f8ab7a943d840c191c7e4c177513104e5e06f2` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure196/patches/189-WP12-native-C16-receipts.json`
- `71170944471b600c01d80d921bb4bf356931ba8a` `e345f3c4d7a910865c37494ce4b0da4d05f00486` `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am01/recall-five-profiles.test.ts`
- `fdee242c35f56644c3aaba912eb33f40f49216d7` `2610f2e2f346d122dac6f347f372ef1649ffa1d8` `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am02/observe-native-c16.ts`
- `39fadbd24ce24da349393ea5a1bcddd8a010f597` `a4d576684d38259aff85d1c38dcf51e94762c326` `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am02/performance-public-c16-reopen.test.ts`

### #183

- `27ea80d727c3212b61f3484f31dacf32b218009e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure198/HANDOFF.md`
- `7417cc518b672196dd700a5f2071cbc23b836cab` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure198/S0-FENCE.json`
- `84e877ae68746702e2485b6dc80adda83320ae4a` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure198/ci-request-191.json`

### #184

- `fb38703b02df10990049adf865bf2da66ab0de8f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure197/ACK.json`
- `f6e52735a8296b57e86ec2bb3f6b0ac8a375a6d0` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure197/CI-REQUESTS.json`
- `3b3c3b981b44ef887dbd445f90be1d4374a21aab` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure197/HANDOFF.md`
- `8ea145e2a38c2320f9fd2912af2ff61d3b437966` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure197/S0-FENCE.json`
- `530b1d6618218f11cefa699e3e6def1bd8f96270` `bb4cdec036331bc180db16795c7dcae215cfbe98` `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am03/functional-boundaries.test.ts`
- `1fbabb2be4bd2540f1f280cf432630e6dd3f486d` `aa144a649d9f3378f9b0861941b3c7f4379fc472` `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am04/domain-recovery-functional.test.ts`
- `4a7100ca6d4a3c109924674fc6d6ae8c4e79aee0` `20be7565a7d63a1f042a718dbc1c5787340b62e1` `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am04/receipt-key-collision.test.ts`

### #185

- `57258fd1d415eb9c45b09b85853a75455c667059` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair201/ACK.json`
- `6505f424e12c533204e2df699c5ebd7a622d2a2a` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair201/HANDOFF.json`
- `bc998554dd404173373345ee7aaea4698dc1241b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair201/PATCH.diff`
- `699f90d5f1631ea8ff78bb8d9a055fd332c50973` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair201/REQUEST-190.json`
- `7130edc296634175910305d6fd7b2d377cae2a43` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair201/REQUEST-200.json`
- `c7c1c2d3412cf964bbf7628c868d992ea1a57a44` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair201/S0-FENCE.json`
- `1ccd3e4b2181e927321d95d5ab4afe6788aa6a99` `beb05c8db34378fff05f53a14e9e367a400ae9e0` `modules/sucafina/Sucafinav1/test/native-ui-contract/work.test.ts`

### #186

- `1406e7aa7b4832ccf923cf02f1789b6a1defccce` `573f1af22df6bba4408d4727e8a8dba9ad5db059` `apps/cli/src/sucafina-product/native-ui/live-context.ts`
- `8c1eabe2994860ca8d50de68eb80da6b935baaae` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair202/ACK-202.json`
- `7e4d60541b1b0378557f905851ff28a5f0da710a` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair202/HANDOFF-202.json`
- `ed03c4feaa8b4984d04d3062b6389b6d985714cd` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair202/REQUESTS-202.md`
- `0eadcf7fe1085e50c1340873b6a7bae631f93494` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair202/S0-FENCE.json`

### #187

- `cb984ed35a59df1acbd982b190d132bc73f1425a` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair204/HANDOFF-204.md`
- `da5df647874357789fd12c5faba5506c0eb69917` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair204/PATCH-204.diff`
- `fafb8f1ff9556254c8d96bdbb0da75473b396219` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair204/S0-FENCE.json`

### #188

- `76318ce8ab47e7b4572200909f8b4b3ed0ef5608` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair205/ACK.json`
- `bf2d8f7237ed6fd6dc05444b4f9b0fe6819dcafb` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair205/ARTIFACT.json`
- `70766fb8af11398a12e35f5b7113680d361729e9` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair205/HANDOFF.md`
- `506a85fec8f328c3ea35739a8d1985f25b3afb93` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair205/PATCH.md`
- `298e9e894fda018c895ed4be0f968563355e03e3` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair205/S0-FENCE.json`
- `d1fef669f7d75e31896fa1d12965e7dbdb5cded4` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair205/VALIDATION-REQUESTS.json`

### #189

- `b7d1bade301057c65cfa8e3bcf6896362bc38429` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair203/ACK.json`
- `6c0f0680608bd6f8876f5c2ed7f809b26e63d9ae` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair203/HANDOFF-203.md`
- `7c7b37e95d9d27ca8fb42f98e695528a290f5eea` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair203/REQUESTS-203.json`
- `f2f443b8c7924f5f06b5f514ea7df4bede61fd63` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair203/S0-FENCE.json`
- `cfe5b74495ac10781e85128f80cc5388b48696b1` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair203/handoff-203.json`
- `bcff5d5a4277b9f98dc2d325b696e3cfaf56d51d` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair203/inert-router.ts.diff`
- `f21dd3aa61c429bb804c3a96d6f035ff9a712ec4` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair203/inert-shared-patches.json`
- `5f84350736768c2220469624bff020d2fd3d2b48` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair203/inert-transport.test.ts.diff`
- `f32f9bd221598fa1279108d12c96fa6b75a77f7c` `a6172389d87a55f07da18ba6d0a99173b37c6989` `packages/client/src/sucafina/transport.ts`

### #190

- `a448b0b626801cff57df3178df8dab39e75160a5` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure199/ACK.json`
- `e624bb5765d322e386d4accd8dac8b15b908ced8` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure199/ARTIFACT.json`
- `a02fb1acfd5af132c8f3a6a71311478fe896444f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure199/EXTERNAL-DEPENDENCY.json`
- `1d71bf4bb82c7847e53b06d7d158df058e8e54ff` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure199/HANDOFF-199.md`
- `659e9b958bb59904a526de212cd9483cd975f35b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure199/INERT-189-PLAYWRIGHT-PRODUCTION.patch`
- `79dbfe90be2fcd70d0080e52aac548cabefbdc75` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure199/S0-FENCE.json`
- `7a85a85d13895ce7e1a95c543f1b3a8f13757582` `ed2ea1dcf1716dddbd71e358001be22291cca564` `packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts`

### #192

- `dcdd88767beb74579d809ff460bec3bc76a7cec1` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/archive210/ACK-210.json`
- `22871e18c2c291ed725abd59808489e704e8966a` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/archive210/CONSUMERS-210.json`
- `14986fe8ead6e778e712fbad056d05d92498d1ea` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/archive210/HANDOFF-210.json`
- `8ca82840cb32f53eb447cb856b6bcacfcc841d30` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/archive210/HANDOFF-210.md`
- `0a623f990bd5974e3c7217f2f50977ecdb54fd6e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/archive210/INDEX-210.json`
- `594e556d4866bb45232630057201865403334d7c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/archive210/INERT-189-MANIFEST.json`
- `25b420f611f7cb7e8feddb8b33687e9c9a84f92c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/archive210/INERT-189-READER.patch`
- `5645027f4104a38f0de3cd98b67dcc91b377bb2a` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/archive210/PREPOST-210.json`
- `ddf452e52692e8bbc552b2bf40594a2c3ae205c3` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/archive210/READER-210.mjs`
- `b91b77c8631917896cc66ffdbf5780367f4aa32c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/archive210/S0-FENCE.json`

### #193

- `91219023187c582dfd9d7fd1a145c37fa589add9` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure212/ACK.json`
- `f6b6632f07fbcf045892c19426b5ba23ac6835da` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure212/CI-REQUEST.json`
- `0a04b3b17abc43fd35927e83183f404330e512da` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure212/COMPILER-REQUEST.json`
- `b4d65db453de5e7f4d7e4237a05a7a48f6f28f47` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure212/HANDOFF.json`
- `b825c1d916aea4d40ee8eb57b5c2e99b18cb3f58` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure212/HANDOFF.md`
- `88289588ab8aef53e456950eadaee5aba5ed7df2` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure212/S0-FENCE.json`
- `3e9dce2d5fbb5d27a73cbf83ce0cff3fca85a494` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure212/patches/211-native-scenarios-review.json`
- `f20fdab67655572f181f78e64b3023f993346d7c` `d520f7d5e72f0802838accff5c45b25769518ba3` `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am01/hypothetical-closure212.test.ts`

### #194

- `e917ead66491a878cdae3e0a7b71b2608c7e6c0f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure213/ACK.json`
- `7ee097427844fe91ea91169de37e0be26f8a5726` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure213/ARTIFACT.json`
- `7d24dab23bbd61df9cbc3d649ee023db893d179e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure213/HANDOFF-213.md`
- `2802e04fdbd0aacd3b3eeffb22daed8fe6135224` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure213/INERT-211-CROSS-LEASE.json`
- `809c5b1eef50447001c5cc7b3e8c7ff92818230d` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure213/INERT-211-CROSS-LEASE.patch`
- `730d1235e8f5908fe0eebc7e8e2921215206d828` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure213/REQUEST-214-190.json`
- `70c1d9dea0e825c1e0ccba4f70102f552ec0dfcd` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure213/S0-FENCE.json`

### #195

- `a87061d5f7e7754482e04c6610644f381b3a7e14` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair216/ACK.json`
- `4e033f94ebaaaf6a9d1b4a4c8911ed6e886c3571` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair216/CI-REQUEST-214.json`
- `8a670da3f73c0896379eb7a15685be25aa224489` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair216/HANDOFF.json`
- `46ab8de5c5851fc255b5247f244b6b4b20395fee` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair216/OUT-OF-LEASE-211.md`
- `e069b2d688f5219eec4a1ea2ecbee11ab1707eef` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair216/RECHECK-208.md`
- `31710282a0d8342891865213506b85c5525c271e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair216/S0-FENCE.json`
- `a935ce97e97f03f1f6a02f03cabc6b271a0ec645` `5be45773fb9da02c4b09706cf1fef142f9683f30` `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am05/sequence-integrity216.test.ts`

### #196

- `1e39c299605ccf56e9fa2c76654816ca1180872f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair215/ACK215.json`
- `c058c0293bfc9b0f4cc348112f45cc7a91eb796a` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair215/CI-REQUEST214.json`
- `87da6b7a0dfb101b0072ef7ea66029dbc63637b6` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair215/HANDOFF215.json`
- `65f590a92acd5982cd8661b604a4367bdf7ef330` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair215/INERT-PATCH211.json`
- `fa7aec1870573f610dd1b925db32ddb7b9e64fba` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair215/RECHECK208.json`
- `2c06335e292d410630d0238f6fd6a407b49375d5` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair215/S0-FENCE.json`
- `603d37dfbbe1c474781dc38bb26fde503750f671` `5b3dfae7948015027d1d1c218bac32e2fc36318d` `modules/sucafina/Sucafinav1/test/product/analytics/unit-integrity215.test.ts`

### #197

- `a2e1041871a553498b92f159ef9b28c874a3cfb6` `6e202424537f69d2ed4df5f8dd0c2a3a5fa629c9` `apps/cli/src/sucafina-product/native-ui/files.ts`
- `3f716172765fb0fac6c3af6083b0d5ba5b17902a` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair218/A06-SOURCE-CLOSURE.json`
- `8826bb249ec58fb5ee0577b7e3515f3b4bd7a44c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair218/ACK.json`
- `06455ac480c412797a200f8da6993621af891918` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair218/HANDOFF.md`
- `924f5befdc88b565962c5f7fb1e6a6ee2407297e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair218/PREPOST.json`
- `c9849bbacf38c19d4a135bfe81521b4985e808f2` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair218/RECHECK207.json`
- `9dc7697683d0dc246f41b755cfae39ef364fbc0f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair218/REQUEST214.json`
- `975b8c7ca4e6528e6947235e991405e28694ce4f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair218/S0-FENCE.json`
- `074910632f22780cc42ba130d93e01bcadeffa57` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair218/patches/A06-shared-closure.patch`
- `a302126ef23e706972b3b80b14c78f3280feacf3` `09023e83a000befece1b1d84fcab0db468e8a846` `modules/sucafina/Sucafinav1/test/product/import-history218/real-receipts.test.ts`
- `c503bb0904a5f989076583b30d91f9cd43d2bb4a` `95bbda4324f635f7bb360dc40d6a40b2863f1bed` `packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx`
- `18d0e2f143fffc965d3b0a632c87f2aa59f7b302` `dcdbddc3a9e8280cf16b48ba1df2797350b19097` `packages/client/src/sucafina/files.ts`
- `e211b2f6ff6cfa4131ace51d3fa1f6e803b7e35c` `1ce6d771734f172443e458e426d18fb3edfdce45` `packages/schema/src/sucafina/files.ts`

### #198

- `1da1ea25efbb65ed48b1b93c3056aca760b9c40b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair217/ACK.json`
- `83726d4aaee788f259a73495872db6f34f6c9a48` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair217/HANDOFF.json`
- `79c01bd9b9612837eb8b898a3bb164ad9ba95c06` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair217/INERT-PATCHES.json`
- `16b75139714ffb38994008a2980eccb8a6005aa5` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair217/REQUEST-207.json`
- `a378bde653c78f13b083a4d6d8670b17e3898e2b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair217/REQUEST-214.json`
- `b9dd97e3453628a0fd8ffc2556c978a2fe140c2d` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair217/S0-FENCE.json`
- `e39fbb08e92ab7e816cd0db3ca38bc60a8ac6e91` `5a25d8c29a077d91d3c0675f2bd9d14652563572` `packages/app-shell/src/orchestra/chapters/sucafina/memory/index.tsx`
- `c63a98050984e937da4105b2667b670b73579d28` `8a28f5047328e9c3a43b22d7ba44fc5474b3280c` `packages/client/src/sucafina/memory.ts`
- `fdb236cfc7eed079904d0664c69a953aaa9112e7` `c29e1024d86f58053e28835b3a9509ed81bcc8e4` `packages/schema/src/sucafina/memory.ts`

### #199

- `b81e7f93a2f6c031b51b63ba36bcba129be45a73` `13b7db59d3f305bc2ecf83acdd343099ffb1c5e0` `apps/cli/src/sucafina-product/host-context.ts`
- `cdbfa5f3bc36a52bea034d0010acb5ba1f0fae40` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair219/ACK.json`
- `dc5f23c4197be80e43e6c37787b73a4b4e636ac9` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair219/CI-REQUEST-214.json`
- `b20d381ea3960733e65337f3076da0bb7384a4d1` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair219/HANDOFF.json`
- `bba22c08b1e1b148bdce0637e6abf95a4b6c7d4c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair219/INERT-211-routine-services.diff`
- `4ecbdba0e1387adcb4ee8415b3ba455bc9ae291b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair219/RECHECK-209.json`
- `718e60078018e64eb5dd757fff65c4254b18f93c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair219/S0-FENCE.json`

### #200

- `e0ca68a923c932fd557f2851d87a79fee21d411d` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair221/ACK.json`
- `11b2f0817e6680dde6b12a2e670ea2d4623753c2` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair221/CI-REQUEST214.json`
- `2f7b5eef721421f21989248fe31f5e1000e0a8bc` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair221/HANDOFF221.json`
- `d78ffa575df08da16b284607b2c694629f3b004b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair221/INDEPENDENT-RECHECK.json`
- `f07c560a5a33a48dc13d770a91f3993fa2081e96` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair221/PREPOST.json`
- `4625dd5281a75041a241b4de21cb99d1124eea26` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair221/S0-FENCE.json`
- `55aec41da6c1f1dd30c1b31c3a96e4b04bbc9ed8` `d520f7d5e72f0802838accff5c45b25769518ba3` `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am01/hypothetical-closure212.test.ts`

### #201

- `7088ea43f951034520b19c0ff5bfc0b07dd34bf2` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair220/ACK.json`
- `9cf2877266055ae57ad337e06564749d7e260205` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair220/HANDOFF-211-214.json`
- `f200c095fea543ad6c437974cc99f9afbb56ed15` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair220/INERT-PATCH-211-v2.json`
- `72f4a529a4bb65c16c3eeb379e1922986ea4c6c7` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair220/INERT-PATCH-211.json`
- `678f8fe6df7c691c7cef9b514a0153c2678a205a` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair220/S0-FENCE.json`
- `dbdbde9d95ffcdf59c50ee64b880e631b37e433a` `880235336ad2d5afee7a65d11a56dd82b4249ef0` `modules/sucafina/Sucafinav1/test/native-ui-contract/decisions.test.ts`
- `52fc1a3fc52b39c0d18f0064bcc17417421ce3c7` `105bbf39914e75540f14ce5b0d07aa191ae58b1b` `packages/schema/src/sucafina/decisions.ts`

### #202

- `54edb88133f0fa2a4942b19df6180b52665bb25f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair222/ACK.json`
- `9a0512a14dbc56d2e21ecd90f1fa66d598b8e734` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair222/CASES-222.json`
- `af566bc49b0993f54d5f05402274302dc88656d6` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair222/DIAGNOSIS.md`
- `c7b610be874bfee3897ca164a2e917e40731f04c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair222/HANDOFF-211.json`
- `b2de0151d48bb55da5735ea44b4a3fe7993ed51f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair222/PREPOST-222.json`
- `de9d7cab7d9a2fd6b6160ad4332844e1dd6ae83b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair222/RECHECK-222.json`
- `2608cb9ed28ee8764966b33971432be867f2c10f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair222/REQUEST-214.json`
- `a21c05cf1b69072eb2372d9e1dcf7cf12578f511` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair222/S0-FENCE.json`
- `aa48bb72137de7e123cbb38625e396825bbfa99e` `a4d576684d38259aff85d1c38dcf51e94762c326` `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am02/performance-public-c16-reopen.test.ts`

### #203

- `de7e1f974ab5e11e0e4710666d0e7470f62744a3` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure225/ACK.json`
- `dcc0daa76fc4b15a3714a0a940a31991f5774251` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure225/HANDOFF.md`
- `75c8e8e0c2945e505f4714e7b012ea357b32ef9d` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure225/S0-FENCE.json`
- `1949a39853efd07a20dcb546c26ccb62c0e286f8` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure225/inert-211/delta-211.json`
- `7b61a4f203d49598b0feb6c929cc85ed07a6df39` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure225/inert-211/index.d01.postimage.ts.txt`
- `5b1cb5eebd73599a48f43a24c2b0985142f4d4a4` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure225/inert-211/network.d01.postimage.ts.txt`
- `ec9636ed5005c8057c5d6656f7b8c54034e6365f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure225/inert-211/protocol.d01.postimage.ts.txt`
- `829309cd3a9cc5411474709884e738e10e8db354` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure225/inert-211/transport.f02.postimage.ts.txt`
- `7db2c9d67a724db736169251659d66cdeb457fea` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure225/inert-211/u14.legacy.postimage.spec.ts.txt`
- `32d09aa12f4ec47f470de974c9c1a46aeb812173` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure225/provenance.json`
- `97ab6d75a9cf5b62aca6a1b10c76ac987d779b50` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure225/recheck207.json`
- `d78e1162880fe1fda5bb4dd6a92016c089841f59` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure225/request223.json`
- `e354b0f5fcfc1c8aaf1aba447dfa0a60df233c93` `b357c4496a6a9e30572706a2b15fe698c573874a` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/suppliers/index.tsx`
- `a71569ca0b3ad34c17ace04d33c855f120b7870c` `272c2643bc6c5e0773526402766b906d34c71b7b` `packages/schema/src/sucafina/procurement.ts`

### #204

- `c344dcef0bc5d4d852610fa4061852cbe7a02fef` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure227/ACK-227.json`
- `65ff7e50fcaddce9f83c4a64fe642434e512dafc` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure227/HANDOFF-227.json`
- `652c79246423fc0b86aa039607dbd0395bedb3be` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure227/INERT-211-BINDING.md`
- `b3debea1de90244df4002b2d48cba7d87b6dc81b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure227/RECHECK-207.json`
- `964801602cf6c4ef3f925acd83a84b006880c666` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure227/REQUEST-190.json`
- `336c2bd32678db10496f725875a6fe2941945383` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure227/REQUEST-223.json`
- `3a99f0dbb7d5d2c2ac3a096f448606dda9e980d4` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure227/S0-FENCE.json`
- `876f95feadd07d6628d13a6c34e454a5ce382ea4` `7674c079e9b614fa84085d3fa11ae75b2564183b` `packages/app-shell/src/orchestra/chapters/sucafina/context/contracts.ts`
- `2a993c4d30e63cb534326d5586fe2c871b340d1b` `8638f3bb5b37ee26fa8c8981793380f0c72c2fca` `packages/app-shell/src/orchestra/chapters/sucafina/context/index.tsx`
- `7e66c610cd4bbb8e27e4c16a239b2142d5b208ba` `9067ca8b93eadf01f1cc7e29d167704321fa3398` `packages/app-shell/src/orchestra/chapters/sucafina/home/index.tsx`
- `6e74148eb42efb18f15ecf25d098cbe1bf5f038d` `c1c55b6423ded5574f65bee3fd2b113ca90a0fa3` `packages/app-shell/src/orchestra/chapters/sucafina/navigation-state/index.ts`

### #205

- `a2e1041871a553498b92f159ef9b28c874a3cfb6` `6e202424537f69d2ed4df5f8dd0c2a3a5fa629c9` `apps/cli/src/sucafina-product/native-ui/files.ts`
- `1aa59adc0e252feefaeaf2a783b0c94ee51a19e3` `a3f09c2a9006c016d51c660043d1189bb2df4c29` `apps/desktop/src/main/sucafina/index.ts`
- `134cf26a0b65ed4b3f606f975925ad865902c021` `787e1a8f13c0d017f2ebe026ecf2aa51d6e931ae` `apps/desktop/src/main/sucafina/protocol.ts`
- `ef0fbb90aaf0f528a0faf4c8cd7a7332addafa15` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure226/ACK.json`
- `38a42682c6dbe85cf1dca5132cc7de97c5d9703c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure226/HANDOFF.json`
- `751ca2d1e57a2fcb54973ff134de51d6b035b487` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure226/INERT-211-PATCHSET.json`
- `c873b140e3c6b69d360ebfc9c466b61e7675e779` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure226/README.md`
- `5e5367301c5fcb867325f0e9d2d0a920551a6341` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure226/RECHECK.json`
- `6b9a993a140ba656f05b1b32d54aa0922450348e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure226/REQUEST-190.json`
- `96ade07f3b1fd6f788af04d3462bb2a9b0e0b831` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure226/REQUEST-223.json`
- `55ec32f51b2c251b2f3500c9d73eb27dc15fc46d` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure226/S0-FENCE.json`
- `1c4d58aaf184a277ca2dd04b263ce0ad500a66d6` `4d9ab87bc931052e606b7e68c27773a6c29a63e0` `modules/sucafina/Sucafinav1/test/native-ui-contract/files.test.ts`
- `4f29bf65fe6f128fb3d34d24beeaddef983c1e6b` `dcdbddc3a9e8280cf16b48ba1df2797350b19097` `packages/client/src/sucafina/files.ts`
- `221098f0f73b0048574522f114cf92be8344440a` `821afc16662512d0888f5d1609eeacdd34a9359f` `packages/client/src/sucafina/files/codecs.ts`
- `368f4420e7c74fbbdb45a6d55c442915bbaba16c` `a6172389d87a55f07da18ba6d0a99173b37c6989` `packages/client/src/sucafina/transport.ts`
- `f01f7d06169f0b396baf38ada9f97a9a25831f8c` `5a0cda0b1e0090b3428f2e4f8e9b49e9855625c5` `packages/client/src/sucafina/transport/files.ts`
- `7e120681b3ccffa6dcdb05585a6b916fcab960fc` `554e92882bedf76f52d157ba610ab8bc99ddbb3d` `packages/client/test/sucafina/files-transport226/source-codecs.test.ts`
- `e211b2f6ff6cfa4131ace51d3fa1f6e803b7e35c` `1ce6d771734f172443e458e426d18fb3edfdce45` `packages/schema/src/sucafina/files.ts`
- `72859baa8ae358038274edd14bb20d9a3334a031` `e5507f5b97a57d5c8f8e39d15620781257b426a8` `packages/schema/src/sucafina/files/structures.ts`

### #206

- `c71332432e9566d24d6f7a57011fb6c499a00e6a` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance150/ACK150.json`
- `53222139605b828002bb2061c267be0d08ab6e27` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance150/FINDINGS-150.json`
- `40d6dd67d41c6b39f477161a5757329273565a7f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance150/HANDOFF-150.md`
- `8b1b68db022ed7d0b7921c6b4061922d294e5d84` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance150/QUEUE-150.json`
- `02f595bc84a8022bb49eb0d781452127a1cf0c22` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance150/REQUESTS-150.json`
- `651dd81cb5e34cc85aa1d21e18c6206dd9bbb88d` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance150/RUNS-150.json`
- `21d60b8466fe6c3df49c0ecf3a4da3cf01e8ceb4` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance150/S0-FENCE.json`
- `5728ca3dcd88a0dbffb75d71768f03a161596a0f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/ci-after-c53-120/ACK120.json`
- `7e9940211a78b51f02cfcbbb117514d96f65b3e7` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/ci-after-c53-120/CHECKPOINT-120.md`
- `6fcce00aa157d7e4d082cdef295a2ade26302c43` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/ci-after-c53-120/FAILURE-QUEUE-120.json`
- `329e208dbc8d7a413b1837e606911b0beb86d15e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/ci-after-c53-120/RECONCILED-QUEUE-120.json`
- `698664537a8a80edd94a9277c22cf8598d027eec` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/ci-after-c53-120/RUNS-120.json`
- `29006fd00b70947d356d91b06d701b42caa3fe51` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure214/ACK-214.json`
- `2275eba52d11bb189185243c1869f986b859f4ce` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure214/DISPATCH-214-01.json`
- `6d987cd3af6e51f63f1bdf15f008bf3aa7b03b49` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure214/FINDINGS-214.json`
- `eff6b92b19f9d8e8e2597faad5f3bd2d8f030172` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure214/HANDOFF-214.json`
- `d8b04ed68856f6a501f42de1ca387d3cadfcb51e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure214/HANDOFF-214.md`
- `6579a0b87b8ed1d3761fe2c0644b86f687b2f90a` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure214/INERT-211-CAUSAL-PATCHES.json`
- `5a56120c034b0a7038ee41325f4e159d021e3114` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure214/INERT-211-CLIENT-MIME-214.json`
- `3277e9db7f7048a26e7b470bfb671d99ce53eb1c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure214/QUEUE-214.json`
- `f4e3bb33bcc3bbaa1a54d701e9cd3c2144870b8f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure214/RUNS-214.json`
- `2217ec0669fb60d0b393eb81c73f1c1b814bbe02` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure214/S0-FENCE.json`
- `bb4cdec036331bc180db16795c7dcae215cfbe98` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure214/inert/am03-functional-boundaries.test.ts.txt`
- `aa144a649d9f3378f9b0861941b3c7f4379fc472` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure214/inert/am04-domain-recovery-functional.test.ts.txt`
- `20be7565a7d63a1f042a718dbc1c5787340b62e1` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure214/inert/am04-receipt-key-collision.test.ts.txt`
- `bdde554d78b3c2e9c880499d879388a65147b3f0` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure214/inert/apps-cli-operations-projection.ts.txt`
- `fef5c0a8702ffde3921a7cd65829cfba9259716d` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure214/inert/client-f02-transport.test.ts.txt`
- `1c58e55c375598591c24654fab4c88f5cd506f98` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure223/ACK-223.json`
- `769abf84c1d8dd6a36c99923fe7d2c9107b40df8` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure223/FINDINGS-223.json`
- `3ada568447d73d4798c00d7840510002a2606d36` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure223/HANDOFF-223.json`
- `e22b82b03e174b90a37526f32909ddabb1d9fdcd` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure223/HANDOFF-223.md`
- `452f21c6a78c858935cf876f5592bb9e29b99bc1` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure223/INPUTS-223.json`
- `5777371dace866bf589c37543f38bc5698ad9768` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure223/QUEUE-223.json`
- `48aabd02fa43bff1473bf3106e567311453ed3a6` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure223/RUNS-223.json`
- `077f3ec538da89a0943b6db2e18f5deed17d0296` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure223/S0-FENCE.json`
- `72670fec7857302038e001ffa044f8268593e2dc` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure232/ACK.json`
- `876518b6de4b48953507987359e7d490ea60dfba` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure232/FINDINGS.json`
- `57b66b43bcd1eff480fe2986da2f36c7580216db` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure232/HANDOFF.json`
- `953730d788bc606ffe6af43a76aa6d868eef0ba5` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure232/INERT-PATCH-MANIFEST.json`
- `c2180b83566acbd773903357a2bff59d73225052` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure232/QUEUE.json`
- `f5c93194b81ac6cd594a7a08d0a4062b89b889fe` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure232/REQUEST-MANIFESTS.json`
- `f01ddb1e4a1f01552e30922500ff5cbbb5cd63a6` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure232/RUNS.json`
- `ae3d8c46360c2641f51ba162446a7c877aa1d91b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure232/S0-FENCE.json`
- `9821126644bb1101fe74a239add220dacac1777d` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure232/SOURCE-PARITY.json`
- `f8553b2ce1e784b6aaf707d4cc6991767a8ac7c3` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/product-ci-c53-107/ACK107.json`
- `54067d8a747e659cbeba079b868f342c3e56af83` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/product-ci-c53-107/CHECKPOINT-107.md`
- `f2c455b1e0da1e926a54c93f4efeb2242bd457b6` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/product-ci-c53-107/FAILURE-QUEUE-107.json`
- `4d1fbfcdaddb517206c5154acf6ddc0f8269164e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/product-ci-c53-107/RECONCILED-QUEUE-107.json`
- `cc4d2fe55fdd6a80fa8e190c115ec7033a7513e9` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/product-ci-c53-107/RUNS-107.json`
- `d92db7f81e4a86a8d90dec731a4102640ae26806` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/product-ci-execution/ACK101.json`
- `ca97883dde8319d3b17932bf09c477b47330a5c6` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/product-ci-execution/CHECKPOINT-101.md`
- `f1f9923df9b098ada0dec99c2d1b500c9360b23b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/product-ci-execution/FAILURE-QUEUE-101.json`
- `a07c9ea3f3ac94344f3aa3a9d798d18f74c5ac4c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/product-ci-execution/RECONCILED-QUEUE-101.json`
- `62e7bb1d01277d6325c2615ccc74b37525a426b6` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/product-ci-execution/RUNS-101.json`
- `29350dac2ca46fdc469ad6b766db8a527a2cd25f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/product-ci129/ACK129.json`
- `117edb69e07fcba985c5515d863d6e585809ffc8` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/product-ci129/CHECKPOINT-129.md`
- `a073d13be1be187f8e76e221ab87e1f0dd4a0bc5` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/product-ci129/FINDINGS-129.json`
- `bce50dc094c8456806127e9d5ba998c876461175` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/product-ci129/HANDOFF-129.md`
- `40da80815094f08c4e56ab3a7d4c54259060679d` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/product-ci129/REQUESTS-129.json`
- `602e0b9751d6df9fb03a427377d065735d0e775f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/product-ci129/RUNS-129.json`
- `fdabb8ccc31144bac3c2acb90989f1366936cce4` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/product-ci129/S0-FENCE.json`
- `5a898161fad6fea143f20227ba032d2f4dff3fb3` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation164/ACK164.json`
- `da6a10cba8c0027ce7850aa8a74a9884479e6923` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation164/CHECKPOINT-164.json`
- `c185d38925d8bb013e05362d34bdc5a1c473ffd2` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation164/FINDINGS-164.json`
- `b98b82e296bd8ecb66d681016f1749548fb5bc11` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation164/HANDOFF-164.md`
- `9ff7a91b519bb736d87222edce41eb57e84d2eba` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation164/QUEUE-164.json`
- `3385f35eabeae7288758f57bcde38653651ce812` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation164/REQUESTS-164.json`
- `bbdc31af0e4f3eac1a4c8b590c3df28b4698c377` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation164/RUNS-164.json`
- `42172ab6fbcc68b19b9c7cdab5d4c53ef20a86bf` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation164/S0-FENCE.json`
- `cdbcb131c21ec2ec70cca8916579ecd2c4994590` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation191/ACK191.json`
- `eeb4b114da23c37e2c038af56adb01273e778a6a` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation191/CHECKPOINT-191-01.json`
- `472d6014f61c8b6db249a0b7affab5650bf6ccf4` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation191/CHECKPOINT-191-02.json`
- `eea3d7f48fb2e90b7fdfae2a7d157b25e02f82bc` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation191/CHECKPOINT-191-03.json`
- `29e303b7b11c0cb9b8344b701df9b8f478b2bf13` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation191/FINDINGS-191.json`
- `1ddde433b8152a28e1f8053e75937e85b4dbbb1f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation191/HANDOFF-191.md`
- `2f567c824d784502cba571ae6d62d61ec38f81bb` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation191/QUEUE-191.json`
- `7b13186d3a32f4ec281697e6b9e2bd767ce54d57` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation191/RUNS-191.json`
- `b4f2b5c973c82194f8c9953cc06b4f92c2e41d10` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation191/S0-FENCE.json`
- `962998545b35244064a08cfab3b64600347604ca` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation200/ACK-200.json`
- `76f4476c26ed026d4db737dbd5e206a7138c2ebe` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation200/CHECKPOINT-200-01.json`
- `bf3c5e8f4e46e4d018ff795e7fbaff4367f13bd9` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation200/FINDINGS-200.json`
- `97d616d88f3b54868e19c1cdd5ecfd5cc0554c1b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation200/HANDOFF-200.md`
- `bae56cb80ac60db3699596140e40214543252481` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation200/QUEUE-200.json`
- `9146d5a4624d1ecf4b1303ee667fafcaea1824c8` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation200/RUNS-200.json`
- `4e9f213faec82a5fb5745991db330c32c583f694` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation200/S0-FENCE.json`

### #207

- `a56513528777b99d6def18e1868dd288c920e7bb` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/ACK.json`
- `8c7242e8c645a7a8c7dff87c2aa489d98cabdd49` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/CI-REQUEST.json`
- `fa233a19e8aa52eb3dff77bf0a780872646bef1f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/HANDOFF.json`
- `4dd4ce583ab30bc29f4f60de1b751d6deb484e87` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/INERT-PATCH.json`
- `02cb1e34eb99a86d64f85882ad4084ee6249069a` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/RECHECK.json`
- `849e2ce47b19c58735aa419201b6f04d5ff264c2` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/RELEASE.json`
- `b8bc929922f0e09f3d37ff6f547ead5a1b3e6302` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/REVIEW.json`
- `de29a3374ddd432f4396211ea39f172543d1c461` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/S0-FENCE.json`
- `6efe881fc6bfd8431d08ccaf2cc4c78001a12bcd` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/TRACE.json`
- `7af4f596f6eabce32d2c3a21947300278c345cd9` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/payloads/modules/sucafina/Sucafinav1/product/procurement/prepared-review.ts.inert.txt`
- `68a309ddc7c637ba1c473fb2edb4848250a51ab6` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/payloads/modules/sucafina/Sucafinav1/product/procurement/prepared.ts.inert.txt`
- `3a13c3401d7629904155664b3b5e08665c2713cc` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/payloads/modules/sucafina/Sucafinav1/product/procurement/scenario-preparation.ts.inert.txt`
- `dbdbde9d95ffcdf59c50ee64b880e631b37e433a` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/payloads/modules/sucafina/Sucafinav1/test/native-ui-contract/decisions.test.ts.inert.txt`
- `d96709db609b399ef801f487e443a381863d6298` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/payloads/modules/sucafina/Sucafinav1/test/product/c12-receipt-recovery/fixture.ts.inert.txt`
- `f0c056bd742647c66ae0afd57067cfa53eb003b7` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/payloads/modules/sucafina/Sucafinav1/test/product/procurement-approval-closure/scenario-composition.test.ts.inert.txt`
- `51288f53dcda77f721cb6395e7f4eeeebbcef0d5` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/payloads/modules/sucafina/Sucafinav1/test/product/procurement-decision-producer/financial-policy.test.ts.inert.txt`
- `191021892019874e9ec8dec594b019f5addf7f3f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/payloads/modules/sucafina/Sucafinav1/test/product/procurement-decision-producer/preparation.test.ts.inert.txt`
- `f9c99a8a886211d1aba60371a2d3b0aa287293b5` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/payloads/modules/sucafina/Sucafinav1/test/product/wp10/memory-integrity/fixture.ts.inert.txt`
- `52fc1a3fc52b39c0d18f0064bcc17417421ce3c7` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/payloads/packages/schema/src/sucafina/decisions.ts.inert.txt`

### #209

- `5a0aeb6edbb5940101ef23dd79439c0e516e9d5e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/ACK.json`
- `5880033abf97271015d7f1a6092b177f6bdca7bf` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/AUTHORITY-RELEASE.json`
- `fb2d34cadabbc2f60c10ad58a7f669ca9099b277` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/CI-REQUEST.json`
- `e36d07676bb2cb44c21a18e990faf5754ba6f408` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/HANDOFF.json`
- `6e3adab4a4d7a8a52706bb5bc5c8c1b084a7679f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/PATCH-SET.json`
- `38efebe3a48bed0a276343ced765f4e7bfd3b07d` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/RECHECK.json`
- `c70c099ea29e0651085fb439a37d82b445c9d982` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/S0-FENCE.json`
- `92fe9d0c7b9fe7da94c6ae5c0385e226fa1fe674` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/e2e/sucafina/native/journeys/u01-host231.spec.ts.inert.txt`
- `340fbae98d8245cf571af266a1c447b226fc98ac` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/e2e/sucafina/native/journeys/u01.spec.ts.227.inert.txt`
- `3243780b050ad1cbeb2848731010bd769d72ee4c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/chapter-route.tsx.inert.txt`
- `876f95feadd07d6628d13a6c34e454a5ce382ea4` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/chapters/sucafina/context/contracts.ts.227.inert.txt`
- `01e879a9bb60f9752af617c5e3528f56c4d89245` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/chapters/sucafina/context/contracts.ts.inert.txt`
- `2a993c4d30e63cb534326d5586fe2c871b340d1b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/chapters/sucafina/context/index.tsx.227.inert.txt`
- `d67d17782c4f02673cb6b6b82bc647dd39e55eef` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/chapters/sucafina/context/index.tsx.inert.txt`
- `7e66c610cd4bbb8e27e4c16a239b2142d5b208ba` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/chapters/sucafina/home/index.tsx.227.inert.txt`
- `80874de468b3891057008380a498d949e9d0a3ff` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/chapters/sucafina/host/today-resume-binding.tsx.inert.txt`
- `6e74148eb42efb18f15ecf25d098cbe1bf5f038d` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/chapters/sucafina/navigation-state/index.ts.227.inert.txt`
- `44c3ad22099b2a20047fe79dbc058cc7a37bbd63` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/chapters/sucafina/navigation-state/resume.ts.227.inert.txt`
- `6af26a8f07e90d1c4ee8e58d9e8d1fc46e9547d4` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/navigation.ts.inert.txt`
- `fdcaca8d91711f544c5c80200819ab4348fb7237` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/sidebar.tsx.inert.txt`
- `9fae974a321af6c863c8749600d42e5271bfa63f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/test-browser/sucafina-native/today-resume227.test.ts.227.inert.txt`

### #210

- `6f42992c172a4eb3a0b4b76969b9e1ba7de6bb0a` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure236/ACK.json`
- `c428ed7af67b7f610d23bcbd008ed9d6b934bd10` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure236/C-D-ENVELOPE.json`
- `45e697f2004abde14a71195903ed7b6b85fa4d14` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure236/C-D-TRACE.json`
- `bff17d47a5e72696623a114e7ee88612697c7c8c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure236/CI-DISPATCH-REQUESTS.json`
- `0eed807164e6f34ae22a3b7ab9aef14fa297ad1b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure236/FENCE.json`
- `2f376b1a5e96006359643da20f5db5796aac793c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure236/GUARDS-G7-G8.md`
- `6ef04711815b0dc7b12fe58d32b16184634e96ac` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure236/HANDOFF.json`
- `22c3c7f26ebf4b6e1ca617015478f2ddb9abdef1` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure236/LOG-RETENTION-210.json`

### #211

- `8e36c02518afa83b58b2c9290422d8654cd505e3` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure233/ACK.json`
- `51a49d79f7040a5a22c7f025426c1d5d11f7596c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure233/CI-REQUESTS.json`
- `26788d98114fa6c8d02ad6c1378928ed15d6d05f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure233/CONSUMER-MAP.json`
- `0ed05026c9b50388276e597057f7fde3431716de` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure233/CRITERIA.json`
- `9303d5ae43d635080a9fb426332ae0f7dbe2e5cd` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure233/HANDOFF.json`
- `70169eca131f766c8004b7dc6264ce02067664cd` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure233/INERT-PATCHES.json`
- `e6f23d16fca81469f06426f36fd6cfa895dcfc7f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure233/LEASE-RELEASE.json`
- `1ca5b78efa4be7aa938f640251e625ea51bb55b3` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure233/SOURCE-READSET.json`
- `b9b39d734ef519efb7d35cfc092fdb1c4b85bdc0` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure233/payloads/script/sf2h/proofs/am03/correlation.ts.inert.txt`
- `29c6806d5da75ffa019a21b11971833f436925f7` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure233/payloads/script/sf2h/proofs/am03/correlation.ts.preimage.txt`

### #212

- `4887268b2320ea4da09bd5af13cb170c74e65fa6` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/ACK.json`
- `5f59ee997bf534a1b30647159573ffab2e682927` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/CI-REQUESTS.json`
- `c504c89a3456ef1f70af3af05f3d6647e20a3e86` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/CRITERIA.json`
- `81c90483ab4d3eb6ea6dd41435fd5e30ea143ace` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/DEPENDENCIES.json`
- `17db051f064fc6789acafc3c35c0864e28eaee7c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/HANDOFF.json`
- `829ef528d224e32ce3e29942f0155e58a244e771` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/INERT-PATCH-MANIFEST.json`
- `7af4f596f6eabce32d2c3a21947300278c345cd9` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/post/modules/sucafina/Sucafinav1/product/procurement/prepared-review.ts.inert.txt`
- `68a309ddc7c637ba1c473fb2edb4848250a51ab6` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/post/modules/sucafina/Sucafinav1/product/procurement/prepared.ts.inert.txt`
- `3a13c3401d7629904155664b3b5e08665c2713cc` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/post/modules/sucafina/Sucafinav1/product/procurement/scenario-preparation.ts.inert.txt`
- `dbdbde9d95ffcdf59c50ee64b880e631b37e433a` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/post/modules/sucafina/Sucafinav1/test/native-ui-contract/decisions.test.ts.inert.txt`
- `d96709db609b399ef801f487e443a381863d6298` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/post/modules/sucafina/Sucafinav1/test/product/c12-receipt-recovery/fixture.ts.inert.txt`
- `f0c056bd742647c66ae0afd57067cfa53eb003b7` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/post/modules/sucafina/Sucafinav1/test/product/procurement-approval-closure/scenario-composition.test.ts.inert.txt`
- `51288f53dcda77f721cb6395e7f4eeeebbcef0d5` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/post/modules/sucafina/Sucafinav1/test/product/procurement-decision-producer/financial-policy.test.ts.inert.txt`
- `191021892019874e9ec8dec594b019f5addf7f3f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/post/modules/sucafina/Sucafinav1/test/product/procurement-decision-producer/preparation.test.ts.inert.txt`
- `f9c99a8a886211d1aba60371a2d3b0aa287293b5` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/post/modules/sucafina/Sucafinav1/test/product/wp10/memory-integrity/fixture.ts.inert.txt`
- `52fc1a3fc52b39c0d18f0064bcc17417421ce3c7` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/post/packages/schema/src/sucafina/decisions.ts.inert.txt`
- `b7d25206bb7ba11d20b293495f09e6cb70430a84` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/pre/modules/sucafina/Sucafinav1/product/procurement/prepared-review.ts.inert.txt`
- `517f50991fb7f057aff943c9e0b626ef6ddc91d6` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/pre/modules/sucafina/Sucafinav1/product/procurement/prepared.ts.inert.txt`
- `82b7d822ec5ca65ba9450cde74c5e8f39da84493` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/pre/modules/sucafina/Sucafinav1/product/procurement/scenario-preparation.ts.inert.txt`
- `d5d4d12874d7afa9cd32f0724d9967e9f3a2d481` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/pre/modules/sucafina/Sucafinav1/test/native-ui-contract/decisions.test.ts.inert.txt`
- `33650407123163ea881eca9d4940fde364b27c54` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/pre/modules/sucafina/Sucafinav1/test/product/c12-receipt-recovery/fixture.ts.inert.txt`
- `d71a7b8003071bcbc0f144f682cc34920cd00d0a` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/pre/modules/sucafina/Sucafinav1/test/product/procurement-approval-closure/scenario-composition.test.ts.inert.txt`
- `6e795a84dbab450a280f4c2043e166743ca5df78` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/pre/modules/sucafina/Sucafinav1/test/product/procurement-decision-producer/financial-policy.test.ts.inert.txt`
- `3c37f7868a62182658adf2b22d88e66869de8d73` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/pre/modules/sucafina/Sucafinav1/test/product/procurement-decision-producer/preparation.test.ts.inert.txt`
- `352efd3fa2aefefa7fbdf88e6ef2d0886a669737` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/pre/modules/sucafina/Sucafinav1/test/product/wp10/memory-integrity/fixture.ts.inert.txt`
- `6c1d974d807e84c244b601ae03a1402ecf27e405` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/inert/230/pre/packages/schema/src/sucafina/decisions.ts.inert.txt`
- `7c4d5f0dfcfde500da11413ab40004a259a91d37` `47c671c90addc9573626e3ebfd51f27fa3de31bd` `modules/sucafina/Sucafinav1/test/product/proof234/am04-c12-return.test.ts`

### #213

- `0ad8050c82d1c0363e09e3546bfb89f58e466acd` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/ACK.json`
- `2f4dcc791091919f664445d9247c9ad2de8f0e62` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/CI-DISPATCH-REQUESTS.json`
- `2a62c16cbef2815116b939d9544c374942c87399` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/FINDING-TRACE.json`
- `d82ea10deffd8c3aac2183863df27ccd7c9876b5` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/HANDOFF.json`
- `e07ccf7781cc211c715f3f468e8909c4b2048da6` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/RELEASE.json`
- `03981bfbaf154b16023de3665691bb17fe2a22e0` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/REUSED-INERT-PREPOST.json`
- `be3dbca512726f30f9f3c6cc125f1893550a919f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/REVIEW-INDEX.md`
- `4b920bbe5d6ba81e56395410335a45759a3930bb` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/REVIEW-R1-START.md`
- `d1fbadb8510641bc805ae3ebfd34e458c90500eb` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/REVIEW-R1.json`
- `8fa83eb7a531c222396752c3980bb8693f91a6fd` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/REVIEW-R2-START.md`
- `3cdc40846f4ea287cc18a69c6f22d54dc12be264` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/REVIEW-R2.json`
- `cec58723c5b87479045adb16bc48ee09f50fdfcc` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/REVIEW-R3-START.md`
- `32160342869b9ba8473288f19cdafdec90151df0` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/REVIEW-R3.json`
- `6cb484cbb77e8d4fdc66f4278fdbd1a71697df58` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/S0-FENCE.json`

### #214

- `7074c5756fcedb53c887cf768f384338ef2c2a15` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure239/ACK.json`
- `80e2a348777a5fb2831c29931b82cd4b708eee38` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure239/CI-REQUEST.json`
- `626b43cf7af6b5eb0b5fe9a766ee3c1521946a91` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure239/HANDOFF.json`
- `22eb3b6908c6a1acf008c296a097f2b723022b7a` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure239/PATCH-SET.json`
- `436f36e34a7e5d70cc10f7d8625fead1f80fb8fa` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure239/POLICY-DECISION.md`
- `9210e8c38a2bd506c413d8cb545aba08d149726e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure239/RECHECK.json`
- `b8b2e52850e4a0ba6b07f1eb254ab91023c1c8d0` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure239/RECONCILIATION.json`
- `8e4fe645ae4e9da47fb6fcd49809513540b54781` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure239/RELEASE.json`
- `51288f53dcda77f721cb6395e7f4eeeebbcef0d5` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure239/patches/REG-01.inert.txt`
- `191021892019874e9ec8dec594b019f5addf7f3f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure239/patches/REG-02.inert.txt`
- `f0c056bd742647c66ae0afd57067cfa53eb003b7` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure239/patches/REG-03.inert.txt`
- `3a13c3401d7629904155664b3b5e08665c2713cc` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure239/patches/SRC-01.inert.txt`
- `68a309ddc7c637ba1c473fb2edb4848250a51ab6` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure239/patches/SRC-02.inert.txt`
- `7af4f596f6eabce32d2c3a21947300278c345cd9` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure239/patches/SRC-03.inert.txt`

### #215

- `5a0aeb6edbb5940101ef23dd79439c0e516e9d5e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/ACK.json`
- `5880033abf97271015d7f1a6092b177f6bdca7bf` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/AUTHORITY-RELEASE.json`
- `fb2d34cadabbc2f60c10ad58a7f669ca9099b277` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/CI-REQUEST.json`
- `e36d07676bb2cb44c21a18e990faf5754ba6f408` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/HANDOFF.json`
- `6e3adab4a4d7a8a52706bb5bc5c8c1b084a7679f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/PATCH-SET.json`
- `38efebe3a48bed0a276343ced765f4e7bfd3b07d` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/RECHECK.json`
- `c70c099ea29e0651085fb439a37d82b445c9d982` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/S0-FENCE.json`
- `92fe9d0c7b9fe7da94c6ae5c0385e226fa1fe674` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/e2e/sucafina/native/journeys/u01-host231.spec.ts.inert.txt`
- `340fbae98d8245cf571af266a1c447b226fc98ac` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/e2e/sucafina/native/journeys/u01.spec.ts.227.inert.txt`
- `3243780b050ad1cbeb2848731010bd769d72ee4c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/chapter-route.tsx.inert.txt`
- `876f95feadd07d6628d13a6c34e454a5ce382ea4` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/chapters/sucafina/context/contracts.ts.227.inert.txt`
- `01e879a9bb60f9752af617c5e3528f56c4d89245` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/chapters/sucafina/context/contracts.ts.inert.txt`
- `2a993c4d30e63cb534326d5586fe2c871b340d1b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/chapters/sucafina/context/index.tsx.227.inert.txt`
- `d67d17782c4f02673cb6b6b82bc647dd39e55eef` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/chapters/sucafina/context/index.tsx.inert.txt`
- `7e66c610cd4bbb8e27e4c16a239b2142d5b208ba` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/chapters/sucafina/home/index.tsx.227.inert.txt`
- `80874de468b3891057008380a498d949e9d0a3ff` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/chapters/sucafina/host/today-resume-binding.tsx.inert.txt`
- `6e74148eb42efb18f15ecf25d098cbe1bf5f038d` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/chapters/sucafina/navigation-state/index.ts.227.inert.txt`
- `44c3ad22099b2a20047fe79dbc058cc7a37bbd63` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/chapters/sucafina/navigation-state/resume.ts.227.inert.txt`
- `6af26a8f07e90d1c4ee8e58d9e8d1fc46e9547d4` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/navigation.ts.inert.txt`
- `fdcaca8d91711f544c5c80200819ab4348fb7237` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/src/orchestra/sidebar.tsx.inert.txt`
- `9fae974a321af6c863c8749600d42e5271bfa63f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/patches/packages/app-shell/test-browser/sucafina-native/today-resume227.test.ts.227.inert.txt`
- `70a5a4784351ac0a948b90c80a4f4087010f8d41` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/ACK.json`
- `e52d7a92fcef35c21361e588528bd9d6311e1669` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/AUTHORITY-RELEASE.json`
- `e2b7141e14850f0b8ff92afdbed4fbcb56c1d227` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/CI-REQUEST.json`
- `07fec3625a330e99a740cba255666d0df9a50a39` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/CONFLICT-RESOLUTION.md`
- `1a0e5684194fc144d0cb989ab6ae862a3bcc56bd` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/HANDOFF.json`
- `825581e6f634aa55ea8ed2bab647bab9c05a3537` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/PATCH-SET.json`
- `b4582f057234ee73b5402d2dc7b17657209c8052` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/RECHECK.json`
- `187145b462d807acc7d5fc07da2f752b5728aed1` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/patches/casecreate.inert.txt`
- `3d000baa7db58283afcf85d0ba399449f0933c92` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/patches/caselist.inert.txt`
- `3243780b050ad1cbeb2848731010bd769d72ee4c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/patches/chapter-route231.inert.txt`
- `136b6d6ae4535c8f3f72833621764fc25db9c53c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/patches/context.inert.txt`
- `7671320cf8cb6476bdf9288b54fb322f4461983e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/patches/contracts.inert.txt`
- `30fa78562bccf66602c2f48c86fb7bc870d073fb` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/patches/copy.inert.txt`
- `18fbb53513def44496966960c0753cbfb4c7d565` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/patches/drafts.inert.txt`
- `6e74148eb42efb18f15ecf25d098cbe1bf5f038d` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/patches/navigation-state227.inert.txt`
- `6af26a8f07e90d1c4ee8e58d9e8d1fc46e9547d4` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/patches/navigation231.inert.txt`
- `1811680cec4776eca162c080c8ade816abf19c3e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/patches/owner.inert.txt`
- `85de9279407a43b0523f925fa209c022e8364969` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/patches/sidebar.inert.txt`
- `80874de468b3891057008380a498d949e9d0a3ff` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/patches/today-resume-binding228.inert.txt`
- `825898ea47323d90d0f61f2d6e53b2c0869220cb` `5cfab26e9f171097994b3ec72c53c587b87268a5` `packages/app-shell/test-browser/sucafina-native/shell-guard237.test.ts`

### #216

- `af41b95b8891fb1503ebfde83c56323d7646f9f7` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/ACK.json`
- `d799e1de7be9fa9a9c7e50a13b6ce3d6c511f383` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/AUTHORITY-RELEASE.json`
- `5914b20cd112976f48e71c70fda9efc212761c05` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/CI-REQUEST.json`
- `52a9feaaab61af14faba987e04c83ac1363ffe25` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/HANDOFF.json`
- `292e88300447473d976032eac4544cfd69059d0c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/PATCH-SET-PART1.json`
- `da93c0b181bb3307c7f5fa81ea4d6dd31f950010` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/PATCH-SET-PART2.json`
- `d5cac860f513a1eaefa03f60676114a5980cee98` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/PATCH-SET.json`
- `47ec75cd17ec7bece8e420578535908e80e1b242` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/RECHECK.json`
- `d6e2a8af26d3c8630337576b3c90b81f23b5246e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/patches/apps/desktop/src/main/sucafina/connections.ts.inert.txt`
- `152652da3b64b60a8609be8b4ad27961a7f307f5` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/patches/apps/desktop/src/main/sucafina/connections.ts.preimage.txt`
- `1d0a1d167fa8187c5c4dc297f247e7f076d137d0` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/patches/apps/desktop/src/main/sucafina/index.ts.inert.txt`
- `ca0466e88ede4ad76d749186189dd85245dabae3` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/patches/apps/desktop/src/main/sucafina/index.ts.preimage.txt`
- `ba9c2bcb3f278d88bea7544dbf1c9ce37988c76c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/patches/apps/desktop/src/preload/sucafina.ts.inert.txt`
- `cd8bc2500bc22b9ab2c1afb33dd3b36d6f9ac163` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/patches/apps/desktop/src/preload/sucafina.ts.preimage.txt`
- `331c6a220f7255850d0074e564c759c882ad6c81` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/patches/apps/desktop/src/renderer/index.tsx.inert.txt`
- `1e19ec2a8864fd4b78e5e16d8d89372caffbceca` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/patches/apps/desktop/src/renderer/index.tsx.preimage.txt`
- `ac5558c30909610081f1748a174f84f1362f1e0c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/patches/apps/desktop/src/renderer/sucafina.ts.inert.txt`
- `4d14e5888a0f9e91ec469e935e498fc9553ead90` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/patches/apps/desktop/src/renderer/sucafina.ts.preimage.txt`
- `ed2faa58c39f824a8741080e44340e1390803d9d` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/patches/packages/app-shell/src/context/platform.tsx.inert.txt`
- `6dd22aad08f5f82bf6dcf5ce5d32d2c7c2db8c47` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/patches/packages/app-shell/src/context/platform.tsx.preimage.txt`
- `ab66d187a26fff499aed7afba905166e48825472` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/patches/packages/app-shell/src/orchestra/chapters/sucafina/host/desktop-origin-bridge238.ts.inert.txt`
- `dcb761ab6ba3fd471ee1969a5466f771e625079e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/patches/packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx.inert.txt`
- `fd5e173de15a42431d5053d1fd132b593564752b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/patches/packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx.preimage231.txt`
- `51cdb3b4b277eb5becfb8d4cc03afc9b8619281b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/patches/packages/client/src/sucafina/transport.ts.inert.txt`
- `2d119538b3aeb7a746efb2d93f5650cb2711c7d8` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/patches/packages/client/src/sucafina/transport.ts.preimage.txt`
- `868981b4609a1b7f8c98c631423510b931944267` `c3deab9d3dd5f7406a25e91b31559320b70edefe` `modules/sucafina/Sucafinav1/test/product/closure238/origin-bridge.negative.test.ts`

### #217

- `23be9065f4076663ad0f3fb9c8d1025cc252d5af` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/bridge-preflight/HANDOFF.md`
- `c0407493d37e50edde483f3a776cbbebb4a7b189` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/bridge-preflight/PATCH-SET.json`
- `be5b2e209d0aba14cdb2e0ac2e546454938a9d26` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/bridge-preflight/patches/01.inert.txt`
- `1487bd94d9355aad01528a4b3cba51429c6cab7f` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/bridge-preflight/patches/02.inert.txt`
- `198e8f20d1ddef02e392d50cb0bfec1af481e09e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/bridge-preflight/patches/03.inert.txt`
- `5f6dde8e68db3e3b0feaa4e56ff5ea206198d838` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/receipts/bridge-preflight/patches/04.inert.txt`

### #218

- `39ffffba4644c80f05cfc1fb65066b05b8160c78` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/context-admission/README.md`
- `ba401d02a549c7471de87cf64d26348ac5b194a2` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/context-admission/post/apps/cli/src/sucafina-product/host-context.ts.txt`
- `0fb9359e0ad4b5090bc5fa1417bbe354b951fc4e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/context-admission/post/apps/cli/src/sucafina-product/native-ui/context.ts.txt`
- `d170958f4d399f4feeff272da0b20ee35690b493` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/context-admission/post/apps/cli/src/sucafina-product/native-ui/live-context.ts.txt`
- `0ffce6bfc868743372b300f9412cd874f0bc08d5` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/context-admission/post/apps/cli/src/sucafina-product/native-ui/live-operational.ts.txt`
- `8b1b1921e94c264ebbb38ad8e7388bd7924fc2d2` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/context-admission/post/modules/sucafina/Sucafinav1/test/native-ui-contract/live-operational.test.ts.txt`
- `ee31002db0e6a8d9ae8a22a320fb297e0c038976` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/context-admission/post/modules/sucafina/Sucafinav1/test/native-ui-contract/request-context.test.ts.txt`

### #219

- `6b80e1b503771b59f9e953e73250a7f82d17904b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/planner-operational/README.md`
- `83c12a777518840ebbfc0430944c0573fe96ff6e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/planner-operational/post/apps/cli/src/sucafina-product/host-context.ts.txt`
- `5fbd2b4ad0c94f0176baac01ab0900096f90e1a1` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/planner-operational/post/apps/cli/src/sucafina-product/native-ui/planner.ts.txt`
- `e63638a2874489a25b2567fb675af3bfcaaa0a33` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/planner-operational/post/apps/cli/src/sucafina-product/native-ui/work.ts.txt`
- `4e7b233e5b10747df6575bc185c28b5299e573d2` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/planner-operational/post/modules/sucafina/Sucafinav1/local/entry.ts.txt`
- `004ebd90b4d39f0b392adc921059b519f2739a65` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/planner-operational/post/modules/sucafina/Sucafinav1/product/contracts/host-context.ts.txt`
- `e1df856cff039d3e19182dd7e7088e82f4860c2e` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/planner-operational/post/modules/sucafina/Sucafinav1/test/native-ui-contract/home-operational.test.ts.txt`
- `869b8f14032846dbe5ce29ba23b3b92b84f9773c` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/planner-operational/post/modules/sucafina/Sucafinav1/test/native-ui-contract/planner-operational.test.ts.txt`

### #220

- `0132fc45de9429acd7caf59f4b122be909f6e710` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/cases-operational/README.md`
- `1caa8ffda1ceb0df71bc64fd6894be423daef938` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/cases-operational/post/apps/cli/src/sucafina-product/native-ui/decisions.ts.txt`
- `3e5e920632ccd22ca23bce690a474a66f0602aa3` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/cases-operational/post/modules/sucafina/Sucafinav1/local/entry.ts.txt`
- `2f191af0d231131edc795fac250af2a9a1f2421b` `MISSING` `modules/sucafina/Sucafinav1/docs/sf2h/control/cases-operational/post/modules/sucafina/Sucafinav1/test/native-ui-contract/cases-operational.test.ts.txt`

### #221

- `5fc4fc58326856d42129a754e3d15b378a3176a2` `a5cdae9c36b89bcfccf5605c5849662e1c5f827b` `apps/cli/src/sucafina-product/memory-http.ts`
- `6f5ce9803ca4d5ae3c4eb10a0990a8e5a7782bed` `0c11d6ede57c9d40bf6b1a1a5480d1efa3e7e48d` `apps/cli/src/sucafina-product/native-host.ts`
- `6b9488f403a338b183efdcf8722d095411445dea` `8b0cffbd6c542a1427d0d1a12d328158da8a7f94` `bun.lock`
- `8a30741a744e5b2e464d7130d34129ab91fb8dc7` `bb491f8fe5f6617d23d8e80b9982d488a238edd2` `modules/sucafina/package.json`
- `90e305b99c44d3956c94b8b4dd9473cae1c80a90` `fc18a75e7f975cf13b1c5d9129a2506127b160ab` `packages/app-shell/src/orchestra/chapters/sucafina/decisions/cases/model.ts`
- `c56b0e2adb6d0f9122b406427825fea378a6ca45` `cb7d02dfac7b76f2f62e4f07d3f92f3e7609f20e` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/approvals/pr/index.tsx`
- `d5fff76a65996a38fecf394a6b75f42d5ac8ec41` `e5507f5b97a57d5c8f8e39d15620781257b426a8` `packages/schema/src/sucafina/files/structures.ts`

### #222

- `82ad7452d2b3c78d33c21ccab204947bba9e5a97` `5a116b204af741ffe14c387fa2beb47427e7cc3e` `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/surface.tsx`
- `5fec446047c911e7553752a640c9bf1e4468c4b3` `df1789f7cf9801b33c0bb1ac8be3d9d43e133b7c` `packages/app-shell/src/orchestra/chapters/sucafina/host/files-route.tsx`
- `ac002db85cbec19078ed6a052039e00022a6579d` `fd5e173de15a42431d5053d1fd132b593564752b` `packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx`
- `e90ffec5b6d48ec9a8b0479522eaeea1e5048356` `34acfd320d62aaa3c1ab4233e9275195e5d20c45` `packages/app-shell/src/orchestra/chapters/sucafina/host/portfolio-route.tsx`
- `5827b1c3aa860d62be6a6d04aacf1d31b0c778bf` `680707e1f069b072642333f236eb3ddf24079ca8` `packages/app-shell/src/orchestra/sidebar.tsx`

### #223

- `17ad20a8f8cabe978a2aebe915e3d440eab7b81a` `5c2291a0da55f02ecc91a929ad019b3d78cc19e2` `apps/cli/src/sucafina-product/native-ui/files-routing.ts`
- `b8f1e0820f57601291817a91f87ac800972f99fe` `6e202424537f69d2ed4df5f8dd0c2a3a5fa629c9` `apps/cli/src/sucafina-product/native-ui/files.ts`
- `005213f392cfc36cc6777f92fe8750740d1db7f6` `573f1af22df6bba4408d4727e8a8dba9ad5db059` `apps/cli/src/sucafina-product/native-ui/live-context.ts`
- `b493fa475c51f041cdb717208a923848c0c205b0` `4d9ab87bc931052e606b7e68c27773a6c29a63e0` `modules/sucafina/Sucafinav1/test/native-ui-contract/files.test.ts`
- `08378f2a47bb3bc080f84331edd7c57b244dc646` `bce587aa469871d2a85d4008c970838c17c3c123` `packages/app-shell/src/orchestra/chapters/sucafina/collaboration-pages/confirmations/index.tsx`
- `926d30716c7b3a4d1f6c593440d5a6868c9a0e2d` `affbb756668be91ab390ac0644f8cbfbe3fd3ccb` `packages/app-shell/src/orchestra/chapters/sucafina/collaboration-pages/relations/index.tsx`
- `6e7dfcd656e7e626582c00b618a8431070724d34` `5a25d8c29a077d91d3c0675f2bd9d14652563572` `packages/app-shell/src/orchestra/chapters/sucafina/memory/index.tsx`
- `19826756e0204d1df1432b9c71a8567f4f16179c` `443a8e2190ed5fa3bbb7a09e27f6c79af012754c` `packages/app-shell/src/orchestra/chapters/sucafina/people/talent/index.tsx`
- `a68f3176c43b8dd8b8a9a2b9766fa952928da3e0` `92306fdd4c17620c929b184e9c5a11662b914d4b` `packages/app-shell/test-browser/sucafina-native/transport-integration.test.ts`
- `2c9f43072a70e73c10fea0f5beec2082df117aa5` `aff16695246561bd2cfe154c1ac892084ce119a4` `packages/client/src/sucafina/bindings.ts`
- `2a0b7644fa409f5d15db1d9756c0debcb76fe6c7` `dcdbddc3a9e8280cf16b48ba1df2797350b19097` `packages/client/src/sucafina/files.ts`
- `8f782fd6db71653a78def5e0556fda10ef19f4a3` `821afc16662512d0888f5d1609eeacdd34a9359f` `packages/client/src/sucafina/files/codecs.ts`
- `6db1123a5bd2d3fb59064d3a268233142f518467` `a6172389d87a55f07da18ba6d0a99173b37c6989` `packages/client/src/sucafina/transport.ts`
- `deca44fe8ff0f760096b1c27cf343b20ed96f64f` `5a0cda0b1e0090b3428f2e4f8e9b49e9855625c5` `packages/client/src/sucafina/transport/files.ts`
- `2b631b941628cc0e0ec85cc513b1dd2aea84e719` `554e92882bedf76f52d157ba610ab8bc99ddbb3d` `packages/client/test/sucafina/files-transport226/source-codecs.test.ts`
- `91470b460d18f7ec5a2486fb0ca23daf136ce914` `0bf778e66bf66c3f755b0232e0a238cf48528dac` `packages/schema/src/sucafina/collaboration/contracts.ts`
- `79a0c3960867d71f9402f48dd9350d39be7abb76` `f42a06e93b538fab0b0df67483240e7fb80e3926` `packages/schema/src/sucafina/common.ts`
- `c180f4ad18e8ed771f294bd4fe7a0838fbcfeb87` `1ce6d771734f172443e458e426d18fb3edfdce45` `packages/schema/src/sucafina/files.ts`
- `f9721f83c4554be7c96199ce0e85195ee2010c2a` `b01c45106dae24481c2fadb334430f95b57860fd` `packages/schema/src/sucafina/operation-registry.ts`

### #224

- `73dedcbba362beab5a831705b97dfdcffe9b72c0` `13b7db59d3f305bc2ecf83acdd343099ffb1c5e0` `apps/cli/src/sucafina-product/host-context.ts`
- `a666116026024c3c636e860d6226706ac6c67a00` `e9e374960600212bd8d6e8e0a37f2ff45f63c21d` `modules/sucafina/Sucafinav1/local/entry.ts`
- `173d372d0b1b518f4932c8ae541d811492f58bb9` `d0def63ec56e2697087722e948b484d31cd75be5` `modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts`
- `8e0d45b2d29815fe87c0351bc24275cbc53e49e9` `de99f191004a14e85756951ab5942d98db710d89` `modules/sucafina/Sucafinav1/runtime/planner.ts`
- `fd7e9dc0e3f3791fe4e09979e4e5e3223992c8d5` `0b45547ca50e672dc84d37223a662efb7222e241` `modules/sucafina/Sucafinav1/runtime/procurement.ts`
- `1f3dc49ebc0a26a056aa7c0674fe42dea7fcf355` `eb3b12a050e2744ac08a41bda10ca53631140bcc` `modules/sucafina/Sucafinav1/test/native-ui-contract/domain-health.test.ts`
- `4766ef2a49a1a7f3c314188281091cee636cf1f0` `e71bf01c5c564ab1bd14369d2d724329d34d382d` `modules/sucafina/Sucafinav1/test/native-ui-contract/operations-mounted.test.ts`
- `f8d0123e88ce508b99cd7d7d5ff01bcc05003398` `0a3db2ca7a552aaca009a13e8cd4a8d32dc4fb6e` `modules/sucafina/Sucafinav1/test/native-ui-contract/planner-operational.test.ts`
- `9a8bdb6c70444a3aa15676800a2c62fec31fff88` `e09dc5b1dfc16dfc6852a4e80b8b23476554e40a` `modules/sucafina/Sucafinav1/test/native-ui-contract/recall-health.test.ts`

### #227

- `797af0d993bad9932a9f17e82fac4223c4399d1c` `764726bc6912f060e1d1fe34a7745a0659e804c5` `apps/cli/src/sucafina-product/native-ui/people.ts`
- `95dc845f9087644567b939f564ffd32a014d2ab3` `16661879c65c608e63451743c13caabe97b63feb` `modules/sucafina/Sucafinav1/test/native-ui-contract/people.test.ts`
- `9a837631af52cc0f364fc43b66d78c96c9ab3b05` `7674c079e9b614fa84085d3fa11ae75b2564183b` `packages/app-shell/src/orchestra/chapters/sucafina/context/contracts.ts`
- `cc9affd17b4d2e311b5e473544407a80cbd89707` `54ec2cb0dc09a9fdf5d1655485004312fb71bb85` `packages/app-shell/src/orchestra/chapters/sucafina/context/drafts.ts`
- `c99916d55795109367afc48e924ef6f9cc08e7ad` `8638f3bb5b37ee26fa8c8981793380f0c72c2fca` `packages/app-shell/src/orchestra/chapters/sucafina/context/index.tsx`
- `17276a35c4b45481074ca10baee66d4031922df8` `1b0448160a6d71fbb2176120df8d2181b6192a85` `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/executive/edit.tsx`
- `23cc9db2b5614e6d5f39abf2efd5cc180ba2d9db` `a0c1346d977beef288938ca4be38c9d2218256af` `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/executive/index.tsx`
- `1a91b1c3a6eee5349a4d7f2788183eb5d5c3c6ce` `bf562ad75f7a72b90c3a668fe4d9385440322106` `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/hot-topics/index.tsx`
- `cb68b8e4455326be4bb7e04d9435a6c0d16afe8b` `4214bb81d5ece7031c645808e1e4e3b1c231ca15` `packages/app-shell/src/orchestra/chapters/sucafina/host/draft-revalidation-availability.ts`
- `8ba0f3bac56203e13846a43695ad664a824358bd` `586e1b39fdfea4e6b254979bd9764165fe471211` `packages/app-shell/src/orchestra/chapters/sucafina/host/draft-revalidation-requests.ts`
- `db8b01a704bee64cf04f164b0426d2421a0c0c0c` `eafcaf0995bca7edff0297c382f32f78daa76787` `packages/app-shell/src/orchestra/chapters/sucafina/host/draft-revalidation-sourcing.ts`
- `f2beed7afb5c7af8a673baac2bdd6c4f7d8d05e5` `90c82e303ef11ae1e71554d3e67883e147b11f09` `packages/app-shell/src/orchestra/chapters/sucafina/host/draft-revalidation.ts`
- `95ac32814abedcdc5f01b49b225e13bc949ba4bf` `e4cd8eb36184d210879fd1b535c0596b9649714f` `packages/app-shell/src/orchestra/chapters/sucafina/operations/performance/index.tsx`
- `7e2219f5a82026886b25021ecd739de8e65ea019` `d282116d29ab9ef28cbe83e52ce5dcd034fb788f` `packages/app-shell/src/orchestra/chapters/sucafina/operations/risks/collection.tsx`
- `b8e1bc4256a7865c5c192ac1d5b2730a52e4fad4` `3eae37c01e2acd0ee0bf39a324f87c7b5b7b6862` `packages/app-shell/src/orchestra/chapters/sucafina/operations/security/index.tsx`
- `fd854b0d9f78a886538884eefca19d4393369511` `ecae60380c6920290e9e3ac8a99329adb13ff1e0` `packages/app-shell/src/orchestra/chapters/sucafina/operations/service/index.tsx`
- `25da86243d581c7468278da97ad9eb8cc1a2ad87` `e809ca3f7fbebe8be9c413c8bdd4c258619cbb8a` `packages/app-shell/src/orchestra/chapters/sucafina/people/structure/editor.tsx`
- `6b66c4ac5634c1db31c92b8cbdcb2489d1fc1294` `b67ed1ced5497218b1c2c0d0011cafafed46eb72` `packages/app-shell/src/orchestra/chapters/sucafina/people/structure/index.tsx`
- `77f9fda9e48f5ac9cdfc93f6d5351807fcba94e3` `443a8e2190ed5fa3bbb7a09e27f6c79af012754c` `packages/app-shell/src/orchestra/chapters/sucafina/people/talent/index.tsx`
- `13b822a416b55be9797a5aa40363c859f96e1c5f` `06b02b7408b35b9e13442621ab45b35c23161d7f` `packages/app-shell/src/orchestra/chapters/sucafina/planner/allocations/index.tsx`
- `c2944e9a237189a057007b72f4b788c2b37049a1` `ca70a7bbd8f22baec8412dd263becbfc3e9c6dfd` `packages/app-shell/src/orchestra/chapters/sucafina/planner/versions/index.tsx`
- `7fe19032fd77fa1a8635b31963d733957550b83f` `3ddf9f47d01caf69db2eff9cdf890b5b08385172` `packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/index.tsx`
- `2c7f66024200c1a27b1960c6f3bd969e0eee0fca` `a98ae91df7f3cb8aeefbf8d2a11534facbfd4c85` `packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/model.ts`
- `0a487daa1f977bf5bb4830548b927fdb1270e7bf` `53a40de7452d8a67c72a6651acb8389a550fb9c7` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx`
- `fd0902e25a8628445e6e10b18f11c2fb81e4b702` `939a33b6ed4710f07933626e75d6a82dbdede296` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/index.tsx`
- `c554e88f26a1a480deccfc4cf9ed77e9f4e0ebce` `b357c4496a6a9e30572706a2b15fe698c573874a` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/suppliers/index.tsx`
- `01918b4e884e52272759427ade51a97f7f454c86` `e058f78c1bbcaec5038bd1f1e272b386b2a64166` `packages/app-shell/test-browser/sucafina-native/draft-quarantine.test.ts`
- `9a7d0f2af4ada92b0d6015357e7d4dd547fc6e99` `a390adf08b7ba31c6e55d61f633cce820721aa03` `packages/app-shell/test/sucafina-native/draft-readiness.test.ts`
- `62b9e7614a8b8ac383df50a6593f3353f165f45d` `ae9121b4cdb701950091201a9cbe1418870aea7c` `packages/app-shell/test/sucafina-native/draft-revalidation.test.ts`
- `0a2e6b4acec4c50f780119a76e22313694576ad5` `a2b12fb348be2105deb693f136ba2684e5fbb7a9` `packages/app-shell/test/sucafina-native/procurement-draft-conflict.test.ts`

### #228

- `22eaa50ea76b8a2aa88f12d6267bfe57f3c144d7` `5c2291a0da55f02ecc91a929ad019b3d78cc19e2` `apps/cli/src/sucafina-product/native-ui/files-routing.ts`
- `da0cf60ebb8be0ae3b6c48f3d704ac4014c30fcf` `6e202424537f69d2ed4df5f8dd0c2a3a5fa629c9` `apps/cli/src/sucafina-product/native-ui/files.ts`
- `129a434a3d1898eeb6b2c58ed978cfec72e80572` `573f1af22df6bba4408d4727e8a8dba9ad5db059` `apps/cli/src/sucafina-product/native-ui/live-context.ts`
- `1cf4d6e8e4f40597d2c0b986653c2ff4f92b1475` `4d9ab87bc931052e606b7e68c27773a6c29a63e0` `modules/sucafina/Sucafinav1/test/native-ui-contract/files.test.ts`
- `2e1f2170a36283576a69b81ce85f209b0a15f026` `96282446a1bbefcfcddafd9ff48393c99ccfa852` `modules/sucafina/Sucafinav1/test/native-ui-contract/reviews.test.ts`
- `63922190878c009f3952825b4d7fdb2c56206910` `4607b0338b5fc293b8a5b5db99125228c976357e` `packages/app-shell/src/orchestra/chapters/sucafina/reviews/reports/recovery.ts`
- `7f46ad2008ce7e40b902d3d4aea09f3b235dac6b` `92306fdd4c17620c929b184e9c5a11662b914d4b` `packages/app-shell/test-browser/sucafina-native/transport-integration.test.ts`
- `7431547f389396bcd1750809ac3a239a9da1f52d` `aff16695246561bd2cfe154c1ac892084ce119a4` `packages/client/src/sucafina/bindings.ts`
- `8335e61e3ff59da3fb142e91107375dfd98e2178` `dcdbddc3a9e8280cf16b48ba1df2797350b19097` `packages/client/src/sucafina/files.ts`
- `79984cd1458786a76203d95db5b472d590740a05` `821afc16662512d0888f5d1609eeacdd34a9359f` `packages/client/src/sucafina/files/codecs.ts`
- `fa97d89fb5e99273e98c49fdd771d9781151f4d8` `a6172389d87a55f07da18ba6d0a99173b37c6989` `packages/client/src/sucafina/transport.ts`
- `4fd1296caf2f227f132142e2e2678966e585e89c` `5a0cda0b1e0090b3428f2e4f8e9b49e9855625c5` `packages/client/src/sucafina/transport/files.ts`
- `a0df778a0497551aeb67a2db3385f00df335a6d4` `554e92882bedf76f52d157ba610ab8bc99ddbb3d` `packages/client/test/sucafina/files-transport226/source-codecs.test.ts`
- `d44b34b015769d3813fc0e4162c3bc9e4a556adf` `f42a06e93b538fab0b0df67483240e7fb80e3926` `packages/schema/src/sucafina/common.ts`
- `a7e5bb4166437b7e2ca7022beef2236a18221e36` `1ce6d771734f172443e458e426d18fb3edfdce45` `packages/schema/src/sucafina/files.ts`
- `1ab545c2f512050d44f251bee38a831c345d9c01` `b01c45106dae24481c2fadb334430f95b57860fd` `packages/schema/src/sucafina/operation-registry.ts`

### #229

- `c0f11d5ee6aeda3b5ac708df5c8d4436e602f830` `573f1af22df6bba4408d4727e8a8dba9ad5db059` `apps/cli/src/sucafina-product/native-ui/live-context.ts`

### #230

- `797af0d993bad9932a9f17e82fac4223c4399d1c` `764726bc6912f060e1d1fe34a7745a0659e804c5` `apps/cli/src/sucafina-product/native-ui/people.ts`
- `95dc845f9087644567b939f564ffd32a014d2ab3` `16661879c65c608e63451743c13caabe97b63feb` `modules/sucafina/Sucafinav1/test/native-ui-contract/people.test.ts`
- `22965f8c0d1713435b085c62781e378e756c0147` `7674c079e9b614fa84085d3fa11ae75b2564183b` `packages/app-shell/src/orchestra/chapters/sucafina/context/contracts.ts`
- `c99916d55795109367afc48e924ef6f9cc08e7ad` `8638f3bb5b37ee26fa8c8981793380f0c72c2fca` `packages/app-shell/src/orchestra/chapters/sucafina/context/index.tsx`
- `1a91b1c3a6eee5349a4d7f2788183eb5d5c3c6ce` `bf562ad75f7a72b90c3a668fe4d9385440322106` `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/hot-topics/index.tsx`
- `f420cf5c5ec9493932e22881f38c6cb867e7223b` `90c82e303ef11ae1e71554d3e67883e147b11f09` `packages/app-shell/src/orchestra/chapters/sucafina/host/draft-revalidation.ts`
- `95ac32814abedcdc5f01b49b225e13bc949ba4bf` `e4cd8eb36184d210879fd1b535c0596b9649714f` `packages/app-shell/src/orchestra/chapters/sucafina/operations/performance/index.tsx`
- `7e2219f5a82026886b25021ecd739de8e65ea019` `d282116d29ab9ef28cbe83e52ce5dcd034fb788f` `packages/app-shell/src/orchestra/chapters/sucafina/operations/risks/collection.tsx`
- `b8e1bc4256a7865c5c192ac1d5b2730a52e4fad4` `3eae37c01e2acd0ee0bf39a324f87c7b5b7b6862` `packages/app-shell/src/orchestra/chapters/sucafina/operations/security/index.tsx`
- `fd854b0d9f78a886538884eefca19d4393369511` `ecae60380c6920290e9e3ac8a99329adb13ff1e0` `packages/app-shell/src/orchestra/chapters/sucafina/operations/service/index.tsx`
- `25da86243d581c7468278da97ad9eb8cc1a2ad87` `e809ca3f7fbebe8be9c413c8bdd4c258619cbb8a` `packages/app-shell/src/orchestra/chapters/sucafina/people/structure/editor.tsx`
- `6b66c4ac5634c1db31c92b8cbdcb2489d1fc1294` `b67ed1ced5497218b1c2c0d0011cafafed46eb72` `packages/app-shell/src/orchestra/chapters/sucafina/people/structure/index.tsx`
- `77f9fda9e48f5ac9cdfc93f6d5351807fcba94e3` `443a8e2190ed5fa3bbb7a09e27f6c79af012754c` `packages/app-shell/src/orchestra/chapters/sucafina/people/talent/index.tsx`
- `13b822a416b55be9797a5aa40363c859f96e1c5f` `06b02b7408b35b9e13442621ab45b35c23161d7f` `packages/app-shell/src/orchestra/chapters/sucafina/planner/allocations/index.tsx`
- `c2944e9a237189a057007b72f4b788c2b37049a1` `ca70a7bbd8f22baec8412dd263becbfc3e9c6dfd` `packages/app-shell/src/orchestra/chapters/sucafina/planner/versions/index.tsx`
- `7fe19032fd77fa1a8635b31963d733957550b83f` `3ddf9f47d01caf69db2eff9cdf890b5b08385172` `packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/index.tsx`
- `2c7f66024200c1a27b1960c6f3bd969e0eee0fca` `a98ae91df7f3cb8aeefbf8d2a11534facbfd4c85` `packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/model.ts`
- `b692c81180c84361f2ae1e89ff76e2bc2514606b` `53a40de7452d8a67c72a6651acb8389a550fb9c7` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx`
- `a8f50662c54af21705573f5cb3a417baa754fb69` `939a33b6ed4710f07933626e75d6a82dbdede296` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/index.tsx`
- `c554e88f26a1a480deccfc4cf9ed77e9f4e0ebce` `b357c4496a6a9e30572706a2b15fe698c573874a` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/suppliers/index.tsx`
- `11f321f24fd8623e297a155547d76d925cec081b` `e058f78c1bbcaec5038bd1f1e272b386b2a64166` `packages/app-shell/test-browser/sucafina-native/draft-quarantine.test.ts`
- `7e677c1d3f8b94176027f7225ddccf55888b8d9e` `ae5bcf613190468300a6706e1b1b56ec54fd08fa` `packages/app-shell/test-browser/sucafina-native/procurement-draft-leaves.test.ts`

### #231

- `2bfc16a91b6974b76dbbc6bd1f2e5d12d50ccb0c` `53a40de7452d8a67c72a6651acb8389a550fb9c7` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx`

### #234

- `797af0d993bad9932a9f17e82fac4223c4399d1c` `764726bc6912f060e1d1fe34a7745a0659e804c5` `apps/cli/src/sucafina-product/native-ui/people.ts`
- `95dc845f9087644567b939f564ffd32a014d2ab3` `16661879c65c608e63451743c13caabe97b63feb` `modules/sucafina/Sucafinav1/test/native-ui-contract/people.test.ts`
- `22965f8c0d1713435b085c62781e378e756c0147` `7674c079e9b614fa84085d3fa11ae75b2564183b` `packages/app-shell/src/orchestra/chapters/sucafina/context/contracts.ts`
- `c99916d55795109367afc48e924ef6f9cc08e7ad` `8638f3bb5b37ee26fa8c8981793380f0c72c2fca` `packages/app-shell/src/orchestra/chapters/sucafina/context/index.tsx`
- `1a91b1c3a6eee5349a4d7f2788183eb5d5c3c6ce` `bf562ad75f7a72b90c3a668fe4d9385440322106` `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/hot-topics/index.tsx`
- `f420cf5c5ec9493932e22881f38c6cb867e7223b` `90c82e303ef11ae1e71554d3e67883e147b11f09` `packages/app-shell/src/orchestra/chapters/sucafina/host/draft-revalidation.ts`
- `95ac32814abedcdc5f01b49b225e13bc949ba4bf` `e4cd8eb36184d210879fd1b535c0596b9649714f` `packages/app-shell/src/orchestra/chapters/sucafina/operations/performance/index.tsx`
- `7e2219f5a82026886b25021ecd739de8e65ea019` `d282116d29ab9ef28cbe83e52ce5dcd034fb788f` `packages/app-shell/src/orchestra/chapters/sucafina/operations/risks/collection.tsx`
- `b8e1bc4256a7865c5c192ac1d5b2730a52e4fad4` `3eae37c01e2acd0ee0bf39a324f87c7b5b7b6862` `packages/app-shell/src/orchestra/chapters/sucafina/operations/security/index.tsx`
- `fd854b0d9f78a886538884eefca19d4393369511` `ecae60380c6920290e9e3ac8a99329adb13ff1e0` `packages/app-shell/src/orchestra/chapters/sucafina/operations/service/index.tsx`
- `25da86243d581c7468278da97ad9eb8cc1a2ad87` `e809ca3f7fbebe8be9c413c8bdd4c258619cbb8a` `packages/app-shell/src/orchestra/chapters/sucafina/people/structure/editor.tsx`
- `6b66c4ac5634c1db31c92b8cbdcb2489d1fc1294` `b67ed1ced5497218b1c2c0d0011cafafed46eb72` `packages/app-shell/src/orchestra/chapters/sucafina/people/structure/index.tsx`
- `77f9fda9e48f5ac9cdfc93f6d5351807fcba94e3` `443a8e2190ed5fa3bbb7a09e27f6c79af012754c` `packages/app-shell/src/orchestra/chapters/sucafina/people/talent/index.tsx`
- `13b822a416b55be9797a5aa40363c859f96e1c5f` `06b02b7408b35b9e13442621ab45b35c23161d7f` `packages/app-shell/src/orchestra/chapters/sucafina/planner/allocations/index.tsx`
- `c2944e9a237189a057007b72f4b788c2b37049a1` `ca70a7bbd8f22baec8412dd263becbfc3e9c6dfd` `packages/app-shell/src/orchestra/chapters/sucafina/planner/versions/index.tsx`
- `7fe19032fd77fa1a8635b31963d733957550b83f` `3ddf9f47d01caf69db2eff9cdf890b5b08385172` `packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/index.tsx`
- `2c7f66024200c1a27b1960c6f3bd969e0eee0fca` `a98ae91df7f3cb8aeefbf8d2a11534facbfd4c85` `packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/model.ts`
- `83c9079e0a33bbc5185b4c43e9de1a5c1d91b2e9` `53a40de7452d8a67c72a6651acb8389a550fb9c7` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx`
- `b095f02fcb6c4859dcac68fc56a68141a8353c37` `939a33b6ed4710f07933626e75d6a82dbdede296` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/index.tsx`
- `c554e88f26a1a480deccfc4cf9ed77e9f4e0ebce` `b357c4496a6a9e30572706a2b15fe698c573874a` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/suppliers/index.tsx`
- `11f321f24fd8623e297a155547d76d925cec081b` `e058f78c1bbcaec5038bd1f1e272b386b2a64166` `packages/app-shell/test-browser/sucafina-native/draft-quarantine.test.ts`
- `7e677c1d3f8b94176027f7225ddccf55888b8d9e` `ae5bcf613190468300a6706e1b1b56ec54fd08fa` `packages/app-shell/test-browser/sucafina-native/procurement-draft-leaves.test.ts`

### #235

- `797af0d993bad9932a9f17e82fac4223c4399d1c` `764726bc6912f060e1d1fe34a7745a0659e804c5` `apps/cli/src/sucafina-product/native-ui/people.ts`
- `95dc845f9087644567b939f564ffd32a014d2ab3` `16661879c65c608e63451743c13caabe97b63feb` `modules/sucafina/Sucafinav1/test/native-ui-contract/people.test.ts`
- `9a837631af52cc0f364fc43b66d78c96c9ab3b05` `7674c079e9b614fa84085d3fa11ae75b2564183b` `packages/app-shell/src/orchestra/chapters/sucafina/context/contracts.ts`
- `cc9affd17b4d2e311b5e473544407a80cbd89707` `54ec2cb0dc09a9fdf5d1655485004312fb71bb85` `packages/app-shell/src/orchestra/chapters/sucafina/context/drafts.ts`
- `c99916d55795109367afc48e924ef6f9cc08e7ad` `8638f3bb5b37ee26fa8c8981793380f0c72c2fca` `packages/app-shell/src/orchestra/chapters/sucafina/context/index.tsx`
- `17276a35c4b45481074ca10baee66d4031922df8` `1b0448160a6d71fbb2176120df8d2181b6192a85` `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/executive/edit.tsx`
- `23cc9db2b5614e6d5f39abf2efd5cc180ba2d9db` `a0c1346d977beef288938ca4be38c9d2218256af` `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/executive/index.tsx`
- `1a91b1c3a6eee5349a4d7f2788183eb5d5c3c6ce` `bf562ad75f7a72b90c3a668fe4d9385440322106` `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/hot-topics/index.tsx`
- `cb68b8e4455326be4bb7e04d9435a6c0d16afe8b` `4214bb81d5ece7031c645808e1e4e3b1c231ca15` `packages/app-shell/src/orchestra/chapters/sucafina/host/draft-revalidation-availability.ts`
- `8ba0f3bac56203e13846a43695ad664a824358bd` `586e1b39fdfea4e6b254979bd9764165fe471211` `packages/app-shell/src/orchestra/chapters/sucafina/host/draft-revalidation-requests.ts`
- `db8b01a704bee64cf04f164b0426d2421a0c0c0c` `eafcaf0995bca7edff0297c382f32f78daa76787` `packages/app-shell/src/orchestra/chapters/sucafina/host/draft-revalidation-sourcing.ts`
- `8ab9b7e0fb91d57e7d5c52a2d88649564999f09e` `90c82e303ef11ae1e71554d3e67883e147b11f09` `packages/app-shell/src/orchestra/chapters/sucafina/host/draft-revalidation.ts`
- `95ac32814abedcdc5f01b49b225e13bc949ba4bf` `e4cd8eb36184d210879fd1b535c0596b9649714f` `packages/app-shell/src/orchestra/chapters/sucafina/operations/performance/index.tsx`
- `7e2219f5a82026886b25021ecd739de8e65ea019` `d282116d29ab9ef28cbe83e52ce5dcd034fb788f` `packages/app-shell/src/orchestra/chapters/sucafina/operations/risks/collection.tsx`
- `b8e1bc4256a7865c5c192ac1d5b2730a52e4fad4` `3eae37c01e2acd0ee0bf39a324f87c7b5b7b6862` `packages/app-shell/src/orchestra/chapters/sucafina/operations/security/index.tsx`
- `fd854b0d9f78a886538884eefca19d4393369511` `ecae60380c6920290e9e3ac8a99329adb13ff1e0` `packages/app-shell/src/orchestra/chapters/sucafina/operations/service/index.tsx`
- `25da86243d581c7468278da97ad9eb8cc1a2ad87` `e809ca3f7fbebe8be9c413c8bdd4c258619cbb8a` `packages/app-shell/src/orchestra/chapters/sucafina/people/structure/editor.tsx`
- `6b66c4ac5634c1db31c92b8cbdcb2489d1fc1294` `b67ed1ced5497218b1c2c0d0011cafafed46eb72` `packages/app-shell/src/orchestra/chapters/sucafina/people/structure/index.tsx`
- `77f9fda9e48f5ac9cdfc93f6d5351807fcba94e3` `443a8e2190ed5fa3bbb7a09e27f6c79af012754c` `packages/app-shell/src/orchestra/chapters/sucafina/people/talent/index.tsx`
- `13b822a416b55be9797a5aa40363c859f96e1c5f` `06b02b7408b35b9e13442621ab45b35c23161d7f` `packages/app-shell/src/orchestra/chapters/sucafina/planner/allocations/index.tsx`
- `c2944e9a237189a057007b72f4b788c2b37049a1` `ca70a7bbd8f22baec8412dd263becbfc3e9c6dfd` `packages/app-shell/src/orchestra/chapters/sucafina/planner/versions/index.tsx`
- `7fe19032fd77fa1a8635b31963d733957550b83f` `3ddf9f47d01caf69db2eff9cdf890b5b08385172` `packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/index.tsx`
- `2c7f66024200c1a27b1960c6f3bd969e0eee0fca` `a98ae91df7f3cb8aeefbf8d2a11534facbfd4c85` `packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/model.ts`
- `0a487daa1f977bf5bb4830548b927fdb1270e7bf` `53a40de7452d8a67c72a6651acb8389a550fb9c7` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx`
- `fd0902e25a8628445e6e10b18f11c2fb81e4b702` `939a33b6ed4710f07933626e75d6a82dbdede296` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/index.tsx`
- `c554e88f26a1a480deccfc4cf9ed77e9f4e0ebce` `b357c4496a6a9e30572706a2b15fe698c573874a` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/suppliers/index.tsx`
- `01918b4e884e52272759427ade51a97f7f454c86` `e058f78c1bbcaec5038bd1f1e272b386b2a64166` `packages/app-shell/test-browser/sucafina-native/draft-quarantine.test.ts`
- `9a7d0f2af4ada92b0d6015357e7d4dd547fc6e99` `a390adf08b7ba31c6e55d61f633cce820721aa03` `packages/app-shell/test/sucafina-native/draft-readiness.test.ts`
- `62b9e7614a8b8ac383df50a6593f3353f165f45d` `ae9121b4cdb701950091201a9cbe1418870aea7c` `packages/app-shell/test/sucafina-native/draft-revalidation.test.ts`
- `0a2e6b4acec4c50f780119a76e22313694576ad5` `a2b12fb348be2105deb693f136ba2684e5fbb7a9` `packages/app-shell/test/sucafina-native/procurement-draft-conflict.test.ts`

### #239

- `215e728500522cb80d471ebbb19515d8e583e534` `505e5c3bf9c649a41665c1313586b986a6cbfb17` `CHANGELOG.md`
- `17e7e5515c13eb1ae77c35f57d08b1cadfc2f056` `7f5ff192708870d92e0b869be81c394ed7b15cb9` `docs/guides/sucafina-workbench.md`

### #242

- `41e16686551fc000c1226be7d0902311ad7728bd` `8f05ac6f081d0b6e89de5f2047718dc93d626973` `.github/workflows/sf-ci.yml`
- `7f9e8c07ae1233e2f6125a9b20246acad6811d63` `5c2fd204149dc65160abcae9b2c815fbbe594d0d` `packages/app-shell/test-browser/sucafina-native/transport-contract.test.ts`
- `7523fdd19038e5542b7e5612db8cac77f06a33de` `1ccf87ef27dcf7b374b9c970494f8fc18cf3695e` `script/sf-ci/gate.mjs`
- `94432c1660474806a09d0b469a80b7a2a7711336` `320db6a06bb5db8ee7ff1ce3a96eeedcc213b48d` `script/sf-ci/gate.test.mjs`
- `e3a44fcbaa56e91286be81ff86dd1d4c3e78dc09` `63f18aeb7b0df778b17b7fa3ed726f903cbc0622` `sf/ci/suites.json`

### #244

- `7696adbcb61dd5653f84b369fefef04d01f7f83c` `9d8a45cd2fe28b64fa21b2f89d91e37bd5f97f33` `modules/sucafina/Sucafinav1/test/native-ui-contract/memory.test.ts`
- `320276ae6b574a43159fdb85b5853ca746bd5c98` `7604d7adb643698970eefd96340e2757a34c9970` `modules/sucafina/Sucafinav1/test/native-ui-contract/operations.test.ts`
- `dacb063fd17e35dc75f70eac5969d807bb1739cc` `96282446a1bbefcfcddafd9ff48393c99ccfa852` `modules/sucafina/Sucafinav1/test/native-ui-contract/reviews.test.ts`
- `35e2f0c87794a13038f41b0e955ebf4cfafc475d` `bcdf73cc65782bfa6d8fcbeb52d3f546aee2a3c2` `packages/app-shell/e2e/sucafina/native/journeys/u39.spec.ts`
- `919472dfdb47edbf885eac829b30b8ed9254b9c4` `94bec3aa596ee0155f47f916a657a546a557c695` `packages/app-shell/e2e/sucafina/native/journeys/u40.spec.ts`

### #245

- `887f6c3b8f997bdecab1ca1abf66a6003a9f1eb4` `MISSING` `sf/azure/identity/AZ-02-W0-W1-handoff.md`
- `2dfa47acc85ca937874b422e997ce709f125fe0a` `MISSING` `sf/azure/identity/AZ-02-environment-and-evidence-runbook.md`
- `2ffede199faa15afc56dcd0aa36297f335cdc4dc` `MISSING` `sf/azure/identity/az02-proof.cjs`
- `6981dee09f20ba5da7368a7f17a2d4142b95d138` `MISSING` `sf/azure/identity/az02-proof.config.example.json`

### #246

- `41e16686551fc000c1226be7d0902311ad7728bd` `8f05ac6f081d0b6e89de5f2047718dc93d626973` `.github/workflows/sf-ci.yml`
- `25a4dbefcfd7a5fe50ab3e939c072f88743e0669` `def57f27a01943e623aae6d8dca733dffd6a4f66` `modules/sucafina/Sucafinav1/test/io-browser.test.ts`
- `c837f6eca10f054f974abba6ad54d8aaaeeb65b3` `e2695004b81956efd3e82cb9bc8245c217ed7a58` `modules/sucafina/Sucafinav1/test/operator-browser.test.ts`
- `ff4c839c55592bce04138e9c443d57f5d6775787` `e2c4335e02974bef2092cb6a2440742e55b5c870` `modules/sucafina/Sucafinav1/test/presentation.test.ts`
- `da62d9d550b2cc09621690219860e36d8a1c6f03` `d809fa195f3932c90b4ff64df0fab258f49fba5a` `modules/sucafina/Sucafinav1/test/visual-layout.test.ts`
- `7f9e8c07ae1233e2f6125a9b20246acad6811d63` `5c2fd204149dc65160abcae9b2c815fbbe594d0d` `packages/app-shell/test-browser/sucafina-native/transport-contract.test.ts`
- `7523fdd19038e5542b7e5612db8cac77f06a33de` `1ccf87ef27dcf7b374b9c970494f8fc18cf3695e` `script/sf-ci/gate.mjs`
- `94432c1660474806a09d0b469a80b7a2a7711336` `320db6a06bb5db8ee7ff1ce3a96eeedcc213b48d` `script/sf-ci/gate.test.mjs`
- `2682c64c58ad5d18bf9c955d2a1af12ba28568c1` `c8b91806ee7930d846b8c40d51cedeb0090ce0ad` `sf/ci/GPT-PLAN-10.md`
- `e3a44fcbaa56e91286be81ff86dd1d4c3e78dc09` `63f18aeb7b0df778b17b7fa3ed726f903cbc0622` `sf/ci/suites.json`

### #247

- `41e16686551fc000c1226be7d0902311ad7728bd` `8f05ac6f081d0b6e89de5f2047718dc93d626973` `.github/workflows/sf-ci.yml`
- `7f9e8c07ae1233e2f6125a9b20246acad6811d63` `5c2fd204149dc65160abcae9b2c815fbbe594d0d` `packages/app-shell/test-browser/sucafina-native/transport-contract.test.ts`
- `7523fdd19038e5542b7e5612db8cac77f06a33de` `1ccf87ef27dcf7b374b9c970494f8fc18cf3695e` `script/sf-ci/gate.mjs`
- `94432c1660474806a09d0b469a80b7a2a7711336` `320db6a06bb5db8ee7ff1ce3a96eeedcc213b48d` `script/sf-ci/gate.test.mjs`
- `2682c64c58ad5d18bf9c955d2a1af12ba28568c1` `c8b91806ee7930d846b8c40d51cedeb0090ce0ad` `sf/ci/GPT-PLAN-10.md`
- `69d6a73e48bc83beb8b8a1335b6d5038abebcc26` `b20d6fb1e404710d0d583fcd4628256226febc65` `sf/ci/PENDING-WORK.md`
- `4ff2b72e07ecf89a0d2ba0079e0e6d2a83327f77` `b4c2b48cae26d0b12dd112bc80af256d936747b1` `sf/ci/README.md`
- `1a43b7f96b95db9cfa9346e3bc72660cebcc85ba` `MISSING` `sf/ci/RELEASE-ATTESTATION.md`
- `e3a44fcbaa56e91286be81ff86dd1d4c3e78dc09` `63f18aeb7b0df778b17b7fa3ed726f903cbc0622` `sf/ci/suites.json`
- `7211fecae70278b5b4607421d6a76d60609f80da` `MISSING` `validation/final-bundle/ci-round-10-13-digest.md`
- `950cccde33fb118b31c864806e2028d877e6086e` `MISSING` `validation/final-bundle/evidence-template.md`
- `6dc395c8b0b5cd338e6b88fe5b5dea0431b5f7e3` `MISSING` `validation/final-bundle/installed-proof-checklist.md`

### #248

- `41e16686551fc000c1226be7d0902311ad7728bd` `8f05ac6f081d0b6e89de5f2047718dc93d626973` `.github/workflows/sf-ci.yml`
- `7f9e8c07ae1233e2f6125a9b20246acad6811d63` `5c2fd204149dc65160abcae9b2c815fbbe594d0d` `packages/app-shell/test-browser/sucafina-native/transport-contract.test.ts`
- `7523fdd19038e5542b7e5612db8cac77f06a33de` `1ccf87ef27dcf7b374b9c970494f8fc18cf3695e` `script/sf-ci/gate.mjs`
- `94432c1660474806a09d0b469a80b7a2a7711336` `320db6a06bb5db8ee7ff1ce3a96eeedcc213b48d` `script/sf-ci/gate.test.mjs`
- `5011c6a793196ef3f0e4f8656a879c8a90fb3022` `MISSING` `sf/azure/recovery/recovery.py`
- `08f649956fa95410c1110edc871419b306d5f67f` `MISSING` `sf/azure/runbooks/A7-FLAMENGO-MICROSOFT-INGRESS.md`
- `b7a012076034e2bbb57713a6f245a50a25712545` `MISSING` `sf/azure/runbooks/A7-OWNER-EXECUTION-PACKAGE.md`
- `4e1549945ddccb2dc455c60c6ba1c77aec3c20ef` `MISSING` `sf/azure/runbooks/A7-REAL-FACTORY-MI-DEPLOY.md`
- `e180d5ca5d470ff2cd2e894b0ea39c34e775b5bf` `MISSING` `sf/azure/runbooks/A7-W0-W1-HANDOFF.md`
- `a6375634e6f0bba12b565a078106522181658736` `MISSING` `sf/azure/runbooks/AZ-01-VM-HTTPS-ACTIVATION.md`
- `dd534bb3a0ee37ca426d8b9381c7428007506689` `MISSING` `sf/azure/runbooks/AZ-03-LINUX-DATA-RECOVERY.md`
- `936ab322b0fdb2a70b22c497a9d34c770aa5e6d7` `MISSING` `sf/azure/runtime/Caddyfile.template`
- `339059b8e18217ec8e67b581dd27f14d9f77e0b2` `MISSING` `sf/azure/runtime/bundle.py`
- `02a6eeed779ace6efc764b368561be0cfeffc78a` `MISSING` `sf/azure/runtime/flamengo-microsoft.example.json`
- `0a00ce403041fddb8e48b534f38f3fb4011f9307` `MISSING` `sf/azure/runtime/identity_health.py`
- `e582e936de996ff191eba48bdeb12272cd69fbaa` `MISSING` `sf/azure/runtime/materialize-entra-secret.sh`
- `d0152eb58f906517bef3c8f88d824b3a9e72dd42` `MISSING` `sf/azure/runtime/orchestra-sf.service`
- `afb8c0e7e3f0473405154495a9204a2ee15a65b6` `MISSING` `sf/azure/runtime/package.py`
- `d89032f1767d0ef581128e1e3375a31252bd7374` `MISSING` `sf/azure/runtime/runtime.env.example`
- `abd6ed44d5c628cd40075a00ef7ec162f2a9e961` `MISSING` `sf/azure/runtime/runtime.env.flamengo.example`
- `46f34c0129658c1ce706acddf293bd72981026c4` `MISSING` `sf/azure/runtime/smoke-transaction.sh`
- `4d177b6900869696e22321424b3457898691975d` `MISSING` `sf/azure/runtime/test_contracts.py`
- `d98132bfc3ef61fa486cea7856d51c5391e6e918` `MISSING` `sf/azure/runtime/test_flamengo_demo_contract.py`
- `95248006985e4cfe90e43d9c775a6ecfea35384b` `MISSING` `sf/azure/vm/caddy-switch.py`
- `6db6740f2e888dfb4e4f525567d7028d39320ad6` `MISSING` `sf/azure/vm/deploy.py`
- `ec25b00c619542c03a2a471ff76d7ede7bf40aa9` `MISSING` `sf/azure/vm/install-factory-distribution.py`
- `8fcfa88187661497f41215aa39564d4afe9be174` `MISSING` `sf/azure/vm/probe-serving.py`
- `2682c64c58ad5d18bf9c955d2a1af12ba28568c1` `c8b91806ee7930d846b8c40d51cedeb0090ce0ad` `sf/ci/GPT-PLAN-10.md`
- `e3a44fcbaa56e91286be81ff86dd1d4c3e78dc09` `63f18aeb7b0df778b17b7fa3ed726f903cbc0622` `sf/ci/suites.json`

### #249

- `41e16686551fc000c1226be7d0902311ad7728bd` `8f05ac6f081d0b6e89de5f2047718dc93d626973` `.github/workflows/sf-ci.yml`
- `7f9e8c07ae1233e2f6125a9b20246acad6811d63` `5c2fd204149dc65160abcae9b2c815fbbe594d0d` `packages/app-shell/test-browser/sucafina-native/transport-contract.test.ts`
- `7523fdd19038e5542b7e5612db8cac77f06a33de` `1ccf87ef27dcf7b374b9c970494f8fc18cf3695e` `script/sf-ci/gate.mjs`
- `94432c1660474806a09d0b469a80b7a2a7711336` `320db6a06bb5db8ee7ff1ce3a96eeedcc213b48d` `script/sf-ci/gate.test.mjs`
- `a9e671254262fafa3d287c29024248ebbe1ad0c7` `MISSING` `script/sf-release-proofs/catalog.json`
- `d29e2b4fbbc1a46cccdebb799e4c469aeee7ca1d` `MISSING` `script/sf-release-proofs/go-no-go.mjs`
- `04a9daef77676de6600737ec6c07b999672e69e4` `MISSING` `script/sf-release-proofs/installed-manifest.mjs`
- `0b245d7a36bbd0a30abf119f32342029338fc090` `MISSING` `script/sf-release-proofs/release-contracts.mjs`
- `1a55f2dc619526c781a7cd6785e3d4a0fd172c15` `MISSING` `script/sf-release-proofs/release-contracts.test.mjs`
- `494390fb6a63e2a3e8626aadf42fd86734492d2a` `MISSING` `script/sf-release-proofs/run.mjs`
- `0736319e3e62c946e62b5c6050cbde89ecfda100` `MISSING` `script/sf-release-proofs/verify-distribution.mjs`
- `229a3170f1258128f96c37704ed3db0c87aa8173` `MISSING` `script/sf-release-proofs/verify-junit.py`
- `2682c64c58ad5d18bf9c955d2a1af12ba28568c1` `c8b91806ee7930d846b8c40d51cedeb0090ce0ad` `sf/ci/GPT-PLAN-10.md`
- `e3a44fcbaa56e91286be81ff86dd1d4c3e78dc09` `63f18aeb7b0df778b17b7fa3ed726f903cbc0622` `sf/ci/suites.json`
- `ad2875e4b9dec87385f167a236929533153edbd6` `MISSING` `sf/proofs/F04-AM-C-GATE-CHECKLIST.md`
- `f755fd47f279c72759e0eb3ecb82a549d6c6f561` `MISSING` `sf/proofs/F04-AM-EXECUTABLE-PACKAGE.md`
- `dbe4be8cb1e8de8481db7cfe455dba9df0c870f7` `MISSING` `sf/proofs/F04-AM-W1-CERTIFICATES.md`
- `35da08a5587d544f77c60d15b5e643c4fbd722de` `MISSING` `sf/proofs/F04-AM-W1-MATRIX.md`
- `f41fd14951475c1f96008dc9e20469106ba9d5cf` `MISSING` `sf/proofs/F04-AM-W1-RUNBOOK.md`
- `174d50c567ef77fc8ce1e5f12892f7962b5c8053` `MISSING` `sf/proofs/go-no-go-bundle.template.json`

### #250

- `41e16686551fc000c1226be7d0902311ad7728bd` `8f05ac6f081d0b6e89de5f2047718dc93d626973` `.github/workflows/sf-ci.yml`
- `7f9e8c07ae1233e2f6125a9b20246acad6811d63` `5c2fd204149dc65160abcae9b2c815fbbe594d0d` `packages/app-shell/test-browser/sucafina-native/transport-contract.test.ts`
- `7523fdd19038e5542b7e5612db8cac77f06a33de` `1ccf87ef27dcf7b374b9c970494f8fc18cf3695e` `script/sf-ci/gate.mjs`
- `94432c1660474806a09d0b469a80b7a2a7711336` `320db6a06bb5db8ee7ff1ce3a96eeedcc213b48d` `script/sf-ci/gate.test.mjs`
- `2682c64c58ad5d18bf9c955d2a1af12ba28568c1` `c8b91806ee7930d846b8c40d51cedeb0090ce0ad` `sf/ci/GPT-PLAN-10.md`
- `4b1a8f4371067b0623190e08b5d1206c1b43a715` `MISSING` `sf/ci/coordination/dependency-ledger.md`
- `937f1aa19ff3222972546bd4538efd8a51607e95` `MISSING` `sf/ci/coordination/merge-ledger.md`
- `e4c28040a7199945e8771c047fb02b9e56b58469` `MISSING` `sf/ci/reviews/ci-red-triage.md`
- `f723de6d9006a333882efb7df95767754b382d07` `MISSING` `sf/ci/reviews/final-cold-review.md`
- `282ded9df8caf090cae385d03cc849ac6a1d2fd0` `MISSING` `sf/ci/reviews/performance.md`
- `e3a44fcbaa56e91286be81ff86dd1d4c3e78dc09` `63f18aeb7b0df778b17b7fa3ed726f903cbc0622` `sf/ci/suites.json`

### #251

- `e7abd4d5cbc499ce650ca60d7202a7e26720f187` `8f05ac6f081d0b6e89de5f2047718dc93d626973` `.github/workflows/sf-ci.yml`
- `7f9e8c07ae1233e2f6125a9b20246acad6811d63` `5c2fd204149dc65160abcae9b2c815fbbe594d0d` `packages/app-shell/test-browser/sucafina-native/transport-contract.test.ts`
- `a8f6e0dc4d44a90385899daa49a13820ebc49da8` `1ccf87ef27dcf7b374b9c970494f8fc18cf3695e` `script/sf-ci/gate.mjs`
- `05a2b5aa1c87fb95357b9d2375128e6b28c16dab` `320db6a06bb5db8ee7ff1ce3a96eeedcc213b48d` `script/sf-ci/gate.test.mjs`
- `1e62d0b1a2bad28adf946e5e4b3cdd3f8ec72e0c` `b4fbb1cfc0d7c6472bcaeae499532e5bf834f9d1` `script/sf-ci/workflow-contract.mjs`
- `2682c64c58ad5d18bf9c955d2a1af12ba28568c1` `c8b91806ee7930d846b8c40d51cedeb0090ce0ad` `sf/ci/GPT-PLAN-10.md`
- `2803b318cf71ba264a00f7f57657003f8c265f5d` `MISSING` `sf/ci/coverage/e2e-inclusion.md`
- `ccac349d4dd128dc6c0a4a39599ab5a3ab9bd895` `MISSING` `sf/ci/coverage/guard-base-comparison.md`
- `c6fab9aa247ad6007ddb7595b0c5155b602b574a` `MISSING` `sf/ci/coverage/recipe-equivalence.md`
- `98dbdee60e70e318052819e165b3b5dee66d89b8` `63f18aeb7b0df778b17b7fa3ed726f903cbc0622` `sf/ci/suites.json`

### #252

- `41e16686551fc000c1226be7d0902311ad7728bd` `8f05ac6f081d0b6e89de5f2047718dc93d626973` `.github/workflows/sf-ci.yml`
- `aa864c35dcfc8ab8bb2fee5138a208c9fe9af95b` `a7474e92dae7623da0e4af89b2abbf2b31fbaf0e` `packages/app-shell/e2e/sucafina/decisions-support/planner-sources.ts`
- `341726a0729fd3a237aa98342cee7a1b67a00f08` `3d8327c576b21f8813769960eb8a93fb757cea93` `packages/app-shell/e2e/sucafina/decisions-support/procurement-source.ts`
- `e0d87ecd3c1726e9ccf6bcaa4e00a38ab1df7b47` `a76262ff265b1f13ecfba7c6ab0784e6d94b4428` `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts`
- `861942290745adb3d5802cf2ad11214234c0ceb3` `7ccc1d4f185d96566156b8d89f7f16a979f6d2f6` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/copy.ts`
- `1f55cdcddf2523b93b5c4fd8fdf07f3aa0ca6f6e` `0d9d9838f895fc8c9b140a3afa51f517a034ddd4` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/forms.tsx`
- `5e6fe1e56c52785e8cc8dce66fdf7fadaf7763cc` `53a40de7452d8a67c72a6651acb8389a550fb9c7` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx`
- `f844b5a9a0494f0aee50894af5dc97a977f94337` `6f74ebd77f51f8c15f0222c07fd12e6db3eb19bb` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/title.tsx`
- `a5adae963afd37c64fada4e1dabaa81b4c1c1d5c` `939a33b6ed4710f07933626e75d6a82dbdede296` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/index.tsx`
- `28cc427573b64a92b8f138fdeb6cf94ebe5b94c3` `e058f78c1bbcaec5038bd1f1e272b386b2a64166` `packages/app-shell/test-browser/sucafina-native/draft-quarantine.test.ts`
- `b229c913a309e6de7010801ca3dee09d2cffcfa9` `ae5bcf613190468300a6706e1b1b56ec54fd08fa` `packages/app-shell/test-browser/sucafina-native/procurement-draft-leaves.test.ts`
- `15c2747b0826d68284414df8fa9e726eeaee602f` `84b8677a535b9d73f2ba95e5e6bcbbea3c86d19c` `packages/app-shell/test-browser/sucafina-native/request-title-races.test.ts`
- `806f30b0fab5d94d84ef304946dfad6132013a8b` `adddde3d22182d8ec74e5f46e00ab6ff28b4fd5a` `packages/app-shell/test-browser/sucafina-native/request-title.test.ts`
- `aee10b3ed97099818116a2459dad1c00b5764f51` `5c2fd204149dc65160abcae9b2c815fbbe594d0d` `packages/app-shell/test-browser/sucafina-native/transport-contract.test.ts`
- `7523fdd19038e5542b7e5612db8cac77f06a33de` `1ccf87ef27dcf7b374b9c970494f8fc18cf3695e` `script/sf-ci/gate.mjs`
- `94432c1660474806a09d0b469a80b7a2a7711336` `320db6a06bb5db8ee7ff1ce3a96eeedcc213b48d` `script/sf-ci/gate.test.mjs`
- `2682c64c58ad5d18bf9c955d2a1af12ba28568c1` `c8b91806ee7930d846b8c40d51cedeb0090ce0ad` `sf/ci/GPT-PLAN-10.md`
- `e3a44fcbaa56e91286be81ff86dd1d4c3e78dc09` `63f18aeb7b0df778b17b7fa3ed726f903cbc0622` `sf/ci/suites.json`

### #253

- `41e16686551fc000c1226be7d0902311ad7728bd` `8f05ac6f081d0b6e89de5f2047718dc93d626973` `.github/workflows/sf-ci.yml`
- `7f9e8c07ae1233e2f6125a9b20246acad6811d63` `5c2fd204149dc65160abcae9b2c815fbbe594d0d` `packages/app-shell/test-browser/sucafina-native/transport-contract.test.ts`
- `a8f6e0dc4d44a90385899daa49a13820ebc49da8` `1ccf87ef27dcf7b374b9c970494f8fc18cf3695e` `script/sf-ci/gate.mjs`
- `05a2b5aa1c87fb95357b9d2375128e6b28c16dab` `320db6a06bb5db8ee7ff1ce3a96eeedcc213b48d` `script/sf-ci/gate.test.mjs`
- `1e62d0b1a2bad28adf946e5e4b3cdd3f8ec72e0c` `b4fbb1cfc0d7c6472bcaeae499532e5bf834f9d1` `script/sf-ci/workflow-contract.mjs`
- `2682c64c58ad5d18bf9c955d2a1af12ba28568c1` `c8b91806ee7930d846b8c40d51cedeb0090ce0ad` `sf/ci/GPT-PLAN-10.md`
- `98dbdee60e70e318052819e165b3b5dee66d89b8` `63f18aeb7b0df778b17b7fa3ed726f903cbc0622` `sf/ci/suites.json`

### #254

- `2ef87401305a4f60f974e8fb398befbccecd086c` `ca9edcafc0e654c57b3cbfca224878c38f0359a2` `apps/cli/script/distribution-payload.ts`
- `2c72db84605c33bd19d04ea5eb023d271f2578f1` `550a84c826aebd935d3d4c6ab6a5e2b64c523728` `apps/cli/test/distribution-web-native.test.ts`
- `74ce1253e30c52d15369360114f8cab4e3b77936` `8ceef2a78929e16af952d95c15d79d9b159d895d` `apps/cli/test/distribution-web.test.ts`

### #257

- `cfc62ae5e3a4e3d6399cef6a8e96b2329a30d602` `ca9edcafc0e654c57b3cbfca224878c38f0359a2` `apps/cli/script/distribution-payload.ts`
- `bea605e04f81a7540b51f5d2cc432fd7936f3eb1` `5de5bb26c7196fb1ed1f4d5ff4d3e030f4e90888` `apps/cli/script/factory-receipt-check.ts`
- `4215130de3de6134f76cd91a3a52bd241e04ab30` `9a9c6df0d5b450224baceefe443d84ca3d494a59` `apps/cli/src/sucafina-product/installation.ts`
- `2c72db84605c33bd19d04ea5eb023d271f2578f1` `550a84c826aebd935d3d4c6ab6a5e2b64c523728` `apps/cli/test/distribution-web-native.test.ts`
- `74ce1253e30c52d15369360114f8cab4e3b77936` `8ceef2a78929e16af952d95c15d79d9b159d895d` `apps/cli/test/distribution-web.test.ts`
- `b49b3ea3bdb22b76acf22f25354594d181c6a613` `266ed73a79babb3726351d815752c033fedfcbe9` `apps/cli/test/factory-distribution-linux.test.ts`
- `44d384bc497a550244de2fa1207c9950c6d97a47` `e9e374960600212bd8d6e8e0a37f2ff45f63c21d` `modules/sucafina/Sucafinav1/local/entry.ts`

### #258

- `240abd1a4b3c809f47463b3866816f4f31166207` `041b1df8288db6414488fb2afe57ca0837e70bf2` `.github/workflows/sf-factory-package.yml`
- `cfc62ae5e3a4e3d6399cef6a8e96b2329a30d602` `ca9edcafc0e654c57b3cbfca224878c38f0359a2` `apps/cli/script/distribution-payload.ts`
- `2c708545501b16f629ac8725af97c03c06a378cc` `cb9e92632a1f8b8462ec795c711dea138e91aa18` `apps/cli/script/test.ts`
- `4215130de3de6134f76cd91a3a52bd241e04ab30` `9a9c6df0d5b450224baceefe443d84ca3d494a59` `apps/cli/src/sucafina-product/installation.ts`
- `2c72db84605c33bd19d04ea5eb023d271f2578f1` `550a84c826aebd935d3d4c6ab6a5e2b64c523728` `apps/cli/test/distribution-web-native.test.ts`
- `74ce1253e30c52d15369360114f8cab4e3b77936` `8ceef2a78929e16af952d95c15d79d9b159d895d` `apps/cli/test/distribution-web.test.ts`
- `b09085b3f1fde46968d6e2f5d0ba0e5e7ef3d5a1` `266ed73a79babb3726351d815752c033fedfcbe9` `apps/cli/test/factory-distribution-linux.test.ts`
- `44d384bc497a550244de2fa1207c9950c6d97a47` `e9e374960600212bd8d6e8e0a37f2ff45f63c21d` `modules/sucafina/Sucafinav1/local/entry.ts`
- `9b2a46e540690616109d4af38168123f5a021e3a` `a699c06a4cd16097aac99f21d469b6ad3b35e010` `sf/azure/runtime/FACTORY-CLOSURE.md`

### #259

- `ebb639e8728a55769a1c58315d5c7a37ab5c3c52` `19088961b21d227d9bdd3d41ebc14f7092d87acb` `packages/app-shell/src/orchestra/chapters/sucafina/planner/overview/index.tsx`

### #260

- `69df5302b661e9afd270184c5744c2b3027ab6bf` `8f05ac6f081d0b6e89de5f2047718dc93d626973` `.github/workflows/sf-ci.yml`
- `d1efe5479a56e6188a1a4ba6af2b26baecdddc2a` `041b1df8288db6414488fb2afe57ca0837e70bf2` `.github/workflows/sf-factory-package.yml`
- `cfc62ae5e3a4e3d6399cef6a8e96b2329a30d602` `ca9edcafc0e654c57b3cbfca224878c38f0359a2` `apps/cli/script/distribution-payload.ts`
- `4215130de3de6134f76cd91a3a52bd241e04ab30` `9a9c6df0d5b450224baceefe443d84ca3d494a59` `apps/cli/src/sucafina-product/installation.ts`
- `2c72db84605c33bd19d04ea5eb023d271f2578f1` `550a84c826aebd935d3d4c6ab6a5e2b64c523728` `apps/cli/test/distribution-web-native.test.ts`
- `74ce1253e30c52d15369360114f8cab4e3b77936` `8ceef2a78929e16af952d95c15d79d9b159d895d` `apps/cli/test/distribution-web.test.ts`
- `ff20aaa1669711c32b9c41784ce65765100617b4` `266ed73a79babb3726351d815752c033fedfcbe9` `apps/cli/test/factory-distribution-linux.test.ts`
- `44d384bc497a550244de2fa1207c9950c6d97a47` `e9e374960600212bd8d6e8e0a37f2ff45f63c21d` `modules/sucafina/Sucafinav1/local/entry.ts`
- `25a4dbefcfd7a5fe50ab3e939c072f88743e0669` `def57f27a01943e623aae6d8dca733dffd6a4f66` `modules/sucafina/Sucafinav1/test/io-browser.test.ts`
- `7696adbcb61dd5653f84b369fefef04d01f7f83c` `9d8a45cd2fe28b64fa21b2f89d91e37bd5f97f33` `modules/sucafina/Sucafinav1/test/native-ui-contract/memory.test.ts`
- `320276ae6b574a43159fdb85b5853ca746bd5c98` `7604d7adb643698970eefd96340e2757a34c9970` `modules/sucafina/Sucafinav1/test/native-ui-contract/operations.test.ts`
- `dacb063fd17e35dc75f70eac5969d807bb1739cc` `96282446a1bbefcfcddafd9ff48393c99ccfa852` `modules/sucafina/Sucafinav1/test/native-ui-contract/reviews.test.ts`
- `c837f6eca10f054f974abba6ad54d8aaaeeb65b3` `e2695004b81956efd3e82cb9bc8245c217ed7a58` `modules/sucafina/Sucafinav1/test/operator-browser.test.ts`
- `ff4c839c55592bce04138e9c443d57f5d6775787` `e2c4335e02974bef2092cb6a2440742e55b5c870` `modules/sucafina/Sucafinav1/test/presentation.test.ts`
- `da62d9d550b2cc09621690219860e36d8a1c6f03` `d809fa195f3932c90b4ff64df0fab258f49fba5a` `modules/sucafina/Sucafinav1/test/visual-layout.test.ts`
- `aa864c35dcfc8ab8bb2fee5138a208c9fe9af95b` `a7474e92dae7623da0e4af89b2abbf2b31fbaf0e` `packages/app-shell/e2e/sucafina/decisions-support/planner-sources.ts`
- `341726a0729fd3a237aa98342cee7a1b67a00f08` `3d8327c576b21f8813769960eb8a93fb757cea93` `packages/app-shell/e2e/sucafina/decisions-support/procurement-source.ts`
- `35e2f0c87794a13038f41b0e955ebf4cfafc475d` `bcdf73cc65782bfa6d8fcbeb52d3f546aee2a3c2` `packages/app-shell/e2e/sucafina/native/journeys/u39.spec.ts`
- `919472dfdb47edbf885eac829b30b8ed9254b9c4` `94bec3aa596ee0155f47f916a657a546a557c695` `packages/app-shell/e2e/sucafina/native/journeys/u40.spec.ts`
- `e0d87ecd3c1726e9ccf6bcaa4e00a38ab1df7b47` `a76262ff265b1f13ecfba7c6ab0784e6d94b4428` `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts`
- `861942290745adb3d5802cf2ad11214234c0ceb3` `7ccc1d4f185d96566156b8d89f7f16a979f6d2f6` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/copy.ts`
- `1f55cdcddf2523b93b5c4fd8fdf07f3aa0ca6f6e` `0d9d9838f895fc8c9b140a3afa51f517a034ddd4` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/forms.tsx`
- `5e6fe1e56c52785e8cc8dce66fdf7fadaf7763cc` `53a40de7452d8a67c72a6651acb8389a550fb9c7` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx`
- `b8fc2a9f75e59943edf8536bab1bd6df0bb7f7f5` `6f74ebd77f51f8c15f0222c07fd12e6db3eb19bb` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/title.tsx`
- `a5adae963afd37c64fada4e1dabaa81b4c1c1d5c` `939a33b6ed4710f07933626e75d6a82dbdede296` `packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/index.tsx`
- `28cc427573b64a92b8f138fdeb6cf94ebe5b94c3` `e058f78c1bbcaec5038bd1f1e272b386b2a64166` `packages/app-shell/test-browser/sucafina-native/draft-quarantine.test.ts`
- `b229c913a309e6de7010801ca3dee09d2cffcfa9` `ae5bcf613190468300a6706e1b1b56ec54fd08fa` `packages/app-shell/test-browser/sucafina-native/procurement-draft-leaves.test.ts`
- `15c2747b0826d68284414df8fa9e726eeaee602f` `84b8677a535b9d73f2ba95e5e6bcbbea3c86d19c` `packages/app-shell/test-browser/sucafina-native/request-title-races.test.ts`
- `806f30b0fab5d94d84ef304946dfad6132013a8b` `adddde3d22182d8ec74e5f46e00ab6ff28b4fd5a` `packages/app-shell/test-browser/sucafina-native/request-title.test.ts`
- `7f9e8c07ae1233e2f6125a9b20246acad6811d63` `5c2fd204149dc65160abcae9b2c815fbbe594d0d` `packages/app-shell/test-browser/sucafina-native/transport-contract.test.ts`
- `0fdeb64b81933fff10d3a12a057ae357d20d52ec` `1ccf87ef27dcf7b374b9c970494f8fc18cf3695e` `script/sf-ci/gate.mjs`
- `c6fdf5a40c12b7b684dce391cdb0bee3c883e038` `320db6a06bb5db8ee7ff1ce3a96eeedcc213b48d` `script/sf-ci/gate.test.mjs`
- `1e62d0b1a2bad28adf946e5e4b3cdd3f8ec72e0c` `b4fbb1cfc0d7c6472bcaeae499532e5bf834f9d1` `script/sf-ci/workflow-contract.mjs`
- `df5217e5e97bdd002566f1b2ec67279761a9f28f` `a699c06a4cd16097aac99f21d469b6ad3b35e010` `sf/azure/runtime/FACTORY-CLOSURE.md`
- `2682c64c58ad5d18bf9c955d2a1af12ba28568c1` `c8b91806ee7930d846b8c40d51cedeb0090ce0ad` `sf/ci/GPT-PLAN-10.md`
- `2803b318cf71ba264a00f7f57657003f8c265f5d` `MISSING` `sf/ci/assurance/e2e-inclusion.md`
- `ccac349d4dd128dc6c0a4a39599ab5a3ab9bd895` `MISSING` `sf/ci/assurance/guard-base-comparison.md`
- `c6fab9aa247ad6007ddb7595b0c5155b602b574a` `MISSING` `sf/ci/assurance/recipe-equivalence.md`
- `98dbdee60e70e318052819e165b3b5dee66d89b8` `63f18aeb7b0df778b17b7fa3ed726f903cbc0622` `sf/ci/suites.json`

### #261

- `ebb639e8728a55769a1c58315d5c7a37ab5c3c52` `19088961b21d227d9bdd3d41ebc14f7092d87acb` `packages/app-shell/src/orchestra/chapters/sucafina/planner/overview/index.tsx`

### #265

- `d1efe5479a56e6188a1a4ba6af2b26baecdddc2a` `041b1df8288db6414488fb2afe57ca0837e70bf2` `.github/workflows/sf-factory-package.yml`
- `cfc62ae5e3a4e3d6399cef6a8e96b2329a30d602` `ca9edcafc0e654c57b3cbfca224878c38f0359a2` `apps/cli/script/distribution-payload.ts`
- `4215130de3de6134f76cd91a3a52bd241e04ab30` `9a9c6df0d5b450224baceefe443d84ca3d494a59` `apps/cli/src/sucafina-product/installation.ts`
- `2c72db84605c33bd19d04ea5eb023d271f2578f1` `550a84c826aebd935d3d4c6ab6a5e2b64c523728` `apps/cli/test/distribution-web-native.test.ts`
- `74ce1253e30c52d15369360114f8cab4e3b77936` `8ceef2a78929e16af952d95c15d79d9b159d895d` `apps/cli/test/distribution-web.test.ts`
- `ff20aaa1669711c32b9c41784ce65765100617b4` `266ed73a79babb3726351d815752c033fedfcbe9` `apps/cli/test/factory-distribution-linux.test.ts`
- `44d384bc497a550244de2fa1207c9950c6d97a47` `e9e374960600212bd8d6e8e0a37f2ff45f63c21d` `modules/sucafina/Sucafinav1/local/entry.ts`
- `df5217e5e97bdd002566f1b2ec67279761a9f28f` `a699c06a4cd16097aac99f21d469b6ad3b35e010` `sf/azure/runtime/FACTORY-CLOSURE.md`

### #266

- `e7abd4d5cbc499ce650ca60d7202a7e26720f187` `8f05ac6f081d0b6e89de5f2047718dc93d626973` `.github/workflows/sf-ci.yml`
- `7f9e8c07ae1233e2f6125a9b20246acad6811d63` `5c2fd204149dc65160abcae9b2c815fbbe594d0d` `packages/app-shell/test-browser/sucafina-native/transport-contract.test.ts`
- `a8f6e0dc4d44a90385899daa49a13820ebc49da8` `1ccf87ef27dcf7b374b9c970494f8fc18cf3695e` `script/sf-ci/gate.mjs`
- `05a2b5aa1c87fb95357b9d2375128e6b28c16dab` `320db6a06bb5db8ee7ff1ce3a96eeedcc213b48d` `script/sf-ci/gate.test.mjs`
- `1e62d0b1a2bad28adf946e5e4b3cdd3f8ec72e0c` `b4fbb1cfc0d7c6472bcaeae499532e5bf834f9d1` `script/sf-ci/workflow-contract.mjs`
- `2682c64c58ad5d18bf9c955d2a1af12ba28568c1` `c8b91806ee7930d846b8c40d51cedeb0090ce0ad` `sf/ci/GPT-PLAN-10.md`
- `2803b318cf71ba264a00f7f57657003f8c265f5d` `MISSING` `sf/ci/coverage/e2e-inclusion.md`
- `ccac349d4dd128dc6c0a4a39599ab5a3ab9bd895` `MISSING` `sf/ci/coverage/guard-base-comparison.md`
- `c6fab9aa247ad6007ddb7595b0c5155b602b574a` `MISSING` `sf/ci/coverage/recipe-equivalence.md`
- `98dbdee60e70e318052819e165b3b5dee66d89b8` `63f18aeb7b0df778b17b7fa3ed726f903cbc0622` `sf/ci/suites.json`

### #267

- `cfc62ae5e3a4e3d6399cef6a8e96b2329a30d602` `ca9edcafc0e654c57b3cbfca224878c38f0359a2` `apps/cli/script/distribution-payload.ts`
- `bea605e04f81a7540b51f5d2cc432fd7936f3eb1` `5de5bb26c7196fb1ed1f4d5ff4d3e030f4e90888` `apps/cli/script/factory-receipt-check.ts`
- `4215130de3de6134f76cd91a3a52bd241e04ab30` `9a9c6df0d5b450224baceefe443d84ca3d494a59` `apps/cli/src/sucafina-product/installation.ts`
- `2c72db84605c33bd19d04ea5eb023d271f2578f1` `550a84c826aebd935d3d4c6ab6a5e2b64c523728` `apps/cli/test/distribution-web-native.test.ts`
- `74ce1253e30c52d15369360114f8cab4e3b77936` `8ceef2a78929e16af952d95c15d79d9b159d895d` `apps/cli/test/distribution-web.test.ts`
- `b49b3ea3bdb22b76acf22f25354594d181c6a613` `266ed73a79babb3726351d815752c033fedfcbe9` `apps/cli/test/factory-distribution-linux.test.ts`
- `44d384bc497a550244de2fa1207c9950c6d97a47` `e9e374960600212bd8d6e8e0a37f2ff45f63c21d` `modules/sucafina/Sucafinav1/local/entry.ts`

### #268

- `97193a11d7d9001636cf16bb6dc3a08515ce1be2` `MISSING` `sf/demo/flamengo/README.md`
- `f59a268fb967f0a7ff3754913cea4900bc70488b` `MISSING` `sf/demo/flamengo/TRACEABILITY.md`
- `0b6caf346119c19540b312a89be64d14c49890f2` `MISSING` `sf/demo/flamengo/catalog.json`
- `80e8c5db90b98b84a0a36d3e096b79f1aea94f87` `MISSING` `sf/demo/flamengo/org.json`
- `6376734b9c4825dfd3738b72512cb69b92025832` `MISSING` `sf/demo/flamengo/scenarios.json`
- `d5607c7b8bb24c0c6e8978b006f22cd4303a7a0c` `MISSING` `sf/demo/flamengo/schedule-native.ts`
- `a8547869a3f69479f1bb78fe21aff91578ceeff8` `MISSING` `sf/demo/flamengo/seed.mjs`
- `4811294d7e2a7d26de5a04ca67570a83e91a19e6` `MISSING` `sf/demo/flamengo/validate.mjs`

### #269

- `e7abd4d5cbc499ce650ca60d7202a7e26720f187` `8f05ac6f081d0b6e89de5f2047718dc93d626973` `.github/workflows/sf-ci.yml`
- `a8f6e0dc4d44a90385899daa49a13820ebc49da8` `1ccf87ef27dcf7b374b9c970494f8fc18cf3695e` `script/sf-ci/gate.mjs`
- `05a2b5aa1c87fb95357b9d2375128e6b28c16dab` `320db6a06bb5db8ee7ff1ce3a96eeedcc213b48d` `script/sf-ci/gate.test.mjs`
- `1e62d0b1a2bad28adf946e5e4b3cdd3f8ec72e0c` `b4fbb1cfc0d7c6472bcaeae499532e5bf834f9d1` `script/sf-ci/workflow-contract.mjs`
- `2682c64c58ad5d18bf9c955d2a1af12ba28568c1` `c8b91806ee7930d846b8c40d51cedeb0090ce0ad` `sf/ci/GPT-PLAN-10.md`
- `2803b318cf71ba264a00f7f57657003f8c265f5d` `MISSING` `sf/ci/coverage/e2e-inclusion.md`
- `ccac349d4dd128dc6c0a4a39599ab5a3ab9bd895` `MISSING` `sf/ci/coverage/guard-base-comparison.md`
- `c6fab9aa247ad6007ddb7595b0c5155b602b574a` `MISSING` `sf/ci/coverage/recipe-equivalence.md`
- `98dbdee60e70e318052819e165b3b5dee66d89b8` `63f18aeb7b0df778b17b7fa3ed726f903cbc0622` `sf/ci/suites.json`

### #270

- `fd9c8e5957eb21e623bbfb3f2b0709d6c3b7e0c4` `e9e374960600212bd8d6e8e0a37f2ff45f63c21d` `modules/sucafina/Sucafinav1/local/entry.ts`
- `2b6dd46d3118f8fda4bd69b83066c1eac30a9504` `1c677b85c0a672cb76b6f6aafde49bb4f5d63acd` `modules/sucafina/Sucafinav1/product/contracts/host-context.ts`
- `17f4b3ea6a000620d761f4bcb83af06e049a647e` `d00e6d8707aef8e99bdeabb485599399408d7ced` `modules/sucafina/Sucafinav1/product/integration/product-authority.ts`
- `c4dc921cd795fc1b6a6ca12e912cdecb8a2b5eca` `MISSING` `modules/sucafina/Sucafinav1/runtime/admin-surface.ts`
- `ce15f5d2ad4d6afb9028e9393b1610ee6e155da4` `64cfaf1fcada712548c5f28a12be12aff37f9620` `modules/sucafina/Sucafinav1/runtime/admin.ts`
- `9b69afcbdbefd57ebc2223e7b3bc4ba360ef5aab` `a0deff8a3b272019f472aa2f93499d1940a78370` `modules/sucafina/Sucafinav1/runtime/application.ts`
- `b88fa7865baf98dd72b6c8e03544068021a1499d` `4d149f3947cdb2bc697ebed8849a3c91337c398f` `modules/sucafina/Sucafinav1/runtime/entra-client.ts`
- `b518a99742b82391e624179d5a204178caf1b95c` `9b501e6c0a4ee13764fd94be755077a3b1bb5844` `modules/sucafina/Sucafinav1/runtime/local-identity.ts`
- `6fab05efe1e7d119bdcc62aeef8d3cc13d604767` `bd046251ececd05a5a179dd44d2c7b55f81b7498` `modules/sucafina/Sucafinav1/runtime/microsoft-policy.ts`
- `c8519c798df3ca0bfac3e361321346b104ff5ceb` `MISSING` `modules/sucafina/Sucafinav1/test/admin-surface.test.ts`
- `7876403f6c60a74c5856898fe7030c8b839d5a83` `17422dc0c812b22da51cc3bd6b57bb9e9ab01966` `modules/sucafina/Sucafinav1/test/microsoft-entra-client.test.ts`
- `64321fe4c27679b4afd2675a59459e6ea0221bb2` `9067ca8b93eadf01f1cc7e29d167704321fa3398` `packages/app-shell/src/orchestra/chapters/sucafina/home/index.tsx`
- `bd7d86ad273671e1b88152e0eb41f8be398ae4b6` `MISSING` `sf/docs/ADMIN-SURFACE-DESIGN.md`

### #272

- `fd9c8e5957eb21e623bbfb3f2b0709d6c3b7e0c4` `e9e374960600212bd8d6e8e0a37f2ff45f63c21d` `modules/sucafina/Sucafinav1/local/entry.ts`
- `2b6dd46d3118f8fda4bd69b83066c1eac30a9504` `1c677b85c0a672cb76b6f6aafde49bb4f5d63acd` `modules/sucafina/Sucafinav1/product/contracts/host-context.ts`
- `17f4b3ea6a000620d761f4bcb83af06e049a647e` `d00e6d8707aef8e99bdeabb485599399408d7ced` `modules/sucafina/Sucafinav1/product/integration/product-authority.ts`
- `c4dc921cd795fc1b6a6ca12e912cdecb8a2b5eca` `MISSING` `modules/sucafina/Sucafinav1/runtime/admin-surface.ts`
- `ce15f5d2ad4d6afb9028e9393b1610ee6e155da4` `64cfaf1fcada712548c5f28a12be12aff37f9620` `modules/sucafina/Sucafinav1/runtime/admin.ts`
- `9b69afcbdbefd57ebc2223e7b3bc4ba360ef5aab` `a0deff8a3b272019f472aa2f93499d1940a78370` `modules/sucafina/Sucafinav1/runtime/application.ts`
- `b88fa7865baf98dd72b6c8e03544068021a1499d` `4d149f3947cdb2bc697ebed8849a3c91337c398f` `modules/sucafina/Sucafinav1/runtime/entra-client.ts`
- `b518a99742b82391e624179d5a204178caf1b95c` `9b501e6c0a4ee13764fd94be755077a3b1bb5844` `modules/sucafina/Sucafinav1/runtime/local-identity.ts`
- `6fab05efe1e7d119bdcc62aeef8d3cc13d604767` `bd046251ececd05a5a179dd44d2c7b55f81b7498` `modules/sucafina/Sucafinav1/runtime/microsoft-policy.ts`
- `c8519c798df3ca0bfac3e361321346b104ff5ceb` `MISSING` `modules/sucafina/Sucafinav1/test/admin-surface.test.ts`
- `7876403f6c60a74c5856898fe7030c8b839d5a83` `17422dc0c812b22da51cc3bd6b57bb9e9ab01966` `modules/sucafina/Sucafinav1/test/microsoft-entra-client.test.ts`
- `64321fe4c27679b4afd2675a59459e6ea0221bb2` `9067ca8b93eadf01f1cc7e29d167704321fa3398` `packages/app-shell/src/orchestra/chapters/sucafina/home/index.tsx`
- `bd7d86ad273671e1b88152e0eb41f8be398ae4b6` `MISSING` `sf/docs/ADMIN-SURFACE-DESIGN.md`

### #273

- `7f9e8c07ae1233e2f6125a9b20246acad6811d63` `5c2fd204149dc65160abcae9b2c815fbbe594d0d` `packages/app-shell/test-browser/sucafina-native/transport-contract.test.ts`

### #274

- `3a414224df9a14fef54cde535b2e33849334f633` `8f05ac6f081d0b6e89de5f2047718dc93d626973` `.github/workflows/sf-ci.yml`

### #279

- `007966f647f3ddf4ff5efb2b039020a649558b20` `d0def63ec56e2697087722e948b484d31cd75be5` `modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts`
- `d1297f108d9f5e75f30f422f0bf0b93d475e9c95` `fd5e173de15a42431d5053d1fd132b593564752b` `packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx`
- `56f3f4f33f2a72a05429deb40ac30d7a4bdb3802` `a6172389d87a55f07da18ba6d0a99173b37c6989` `packages/client/src/sucafina/transport.ts`

### #280

- `8f7f744101fde1207aec8dd49a10254b9e7081b0` `0b45547ca50e672dc84d37223a662efb7222e241` `modules/sucafina/Sucafinav1/runtime/procurement.ts`
- `2b45e7b4a1c1afb3c5fd0816afb834f331fa57b9` `2949c56347cd55cd404fea1c7a3418b89b1543a3` `modules/sucafina/Sucafinav1/test/business-browser.test.ts`
- `81a291feb0b4abe9703395bacea2dd3935ec1304` `dd8ad154a36b014f106f90ffe70b2b823435f766` `modules/sucafina/Sucafinav1/test/installation.test.ts`
- `b98e863997e2787c22fb41df88ec56da9f8c0fa9` `def57f27a01943e623aae6d8dca733dffd6a4f66` `modules/sucafina/Sucafinav1/test/io-browser.test.ts`
- `b1a9a02f23169e352e0a5fa0fd4fc88f9dad573a` `dad523572076009e91a2605afd96dc6cb11c6047` `modules/sucafina/Sucafinav1/test/microsoft-routes.test.ts`
- `2fed7d88ed09be911d7a9a4557ea0877992eac9d` `e2695004b81956efd3e82cb9bc8245c217ed7a58` `modules/sucafina/Sucafinav1/test/operator-browser.test.ts`
- `2fbcb12b5ce7ff55e36711ac4920edd2d0576aaf` `e2c4335e02974bef2092cb6a2440742e55b5c870` `modules/sucafina/Sucafinav1/test/presentation.test.ts`
- `7a90c4662aad5aa25d87f5d9dbd04f791edfcacc` `ac391979eb8d5248532049a5fc15c1dc28448246` `modules/sucafina/Sucafinav1/test/s1.test.ts`
- `0d99910b0a5533648e4450a4ae561719fa81af19` `d809fa195f3932c90b4ff64df0fab258f49fba5a` `modules/sucafina/Sucafinav1/test/visual-layout.test.ts`

