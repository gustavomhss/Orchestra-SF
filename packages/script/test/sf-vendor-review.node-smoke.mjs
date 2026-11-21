import { readFileSync } from "node:fs"
import { gatewayProof } from "../../../modules/sucafina/Sucafinav1/product/ai/packs/vendor-review/proof.mjs"
import { runSfGatewayProof } from "./sf-purchase-invoke.node-smoke.mjs"

const installed = process.argv.includes("--installed-fixture") ? JSON.parse(readFileSync(0, "utf8")) : undefined
await runSfGatewayProof(gatewayProof, installed)
console.log(`SF supplier review ${gatewayProof.refs.A}/${gatewayProof.refs.B}: two own reads, two crossed denials.`)
