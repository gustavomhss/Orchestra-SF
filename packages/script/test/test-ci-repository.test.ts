import { expect, test } from "bun:test"
import { ciRepository, requireCiIdentity, requireCiOrigin } from "../../../script/test-ci-repository"

test("SF CI resolves its exact origin and repository identity", () => {
  expect(requireCiOrigin("git@github.com:gustavomhss/Orchestra-SF.git")).toBe(ciRepository.name)
  expect(requireCiOrigin("https://github.com/gustavomhss/Orchestra-SF", ciRepository.name)).toBe(ciRepository.name)
  expect(requireCiIdentity({ full_name: ciRepository.name, id: ciRepository.id })).toBe(ciRepository.name)
})

test("SF CI refuses the original source, crossed identities and unknown destinations", () => {
  expect(() => requireCiOrigin("git@github.com:gustavomhss/hugr-orchestra.git")).toThrow()
  expect(() => requireCiOrigin("git@github.com:gustavomhss/Orchestra-SF.git", "gustavomhss/hugr-orchestra")).toThrow()
  expect(() => requireCiIdentity({ full_name: "gustavomhss/hugr-orchestra", id: 1405035578 })).toThrow()
  expect(() => requireCiIdentity({ full_name: ciRepository.name, id: 1405035578 })).toThrow()
  expect(() => requireCiIdentity({ full_name: "gustavomhss/hugr-orchestra", id: ciRepository.id })).toThrow()
  expect(() => requireCiIdentity({ full_name: "someone/else", id: 1 })).toThrow()
  expect(() => requireCiIdentity({ full_name: ciRepository.name })).toThrow()
  expect(() => requireCiIdentity(null)).toThrow()
  expect(() => requireCiOrigin("https://github.com/other/Orchestra-SF.git")).toThrow()
})
