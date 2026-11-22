import { Option, Schema } from "effect"
import { unwrap } from "solid-js/store"

/**
 * Native state is not a wire DTO: Solid can retain proxy metadata on the raw
 * object as well as expose nested proxies. Materialize those values without
 * selecting fields, then apply the unchanged closed source decoder.
 * Extra string fields, undefined values and invalid numbers remain for it to
 * reject. A failed clone is an invalid input, never permission to dispatch.
 */
export function sfPortfolioDecodeInput<A>(schema: Schema.Decoder<A>, input: unknown): Option.Option<A> {
  try {
    return Schema.decodeUnknownOption(schema)(structuredClone(unwrap(input)))
  } catch {
    return Option.none()
  }
}
