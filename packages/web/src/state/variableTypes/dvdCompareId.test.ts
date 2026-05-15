import { describe, expect, test } from "vitest"
import { getVariableTypeDefinition } from "../../components/VariableCard/registry"
// Import for side effect: bootstrap registers dvdCompareId.
import "./dvdCompareId"

describe("dvdCompareId variable type", () => {
  test("is registered with multi cardinality and is linkable", () => {
    const definition = getVariableTypeDefinition("dvdCompareId")
    expect(definition).toBeDefined()
    expect(definition?.type).toBe("dvdCompareId")
    expect(definition?.cardinality).toBe("multi")
    expect(definition?.isLinkable).toBe(true)
    expect(definition?.label).toBe("DVD Compare ID")
  })

  test("validate rejects an empty value", () => {
    const definition = getVariableTypeDefinition("dvdCompareId")
    const result = definition?.validate?.("")
    expect(result?.isValid).toBe(false)
    expect(result?.message).toMatch(/required/i)
  })

  test("validate rejects a whitespace-only value", () => {
    const definition = getVariableTypeDefinition("dvdCompareId")
    expect(definition?.validate?.("   ")?.isValid).toBe(false)
  })

  test("validate accepts a slug-style id", () => {
    const definition = getVariableTypeDefinition("dvdCompareId")
    expect(
      definition?.validate?.("spider-man-2002")?.isValid,
    ).toBe(true)
  })

  test("validate accepts a numeric id", () => {
    const definition = getVariableTypeDefinition("dvdCompareId")
    expect(definition?.validate?.("74759")?.isValid).toBe(true)
  })

  test("validate accepts a full dvdcompare.net URL", () => {
    const definition = getVariableTypeDefinition("dvdCompareId")
    const result = definition?.validate?.(
      "https://dvdcompare.net/comparisons/film.php?fid=74759",
    )
    expect(result?.isValid).toBe(true)
  })

  test("validate rejects a string with spaces (neither slug nor URL)", () => {
    const definition = getVariableTypeDefinition("dvdCompareId")
    const result = definition?.validate?.("not a slug")
    expect(result?.isValid).toBe(false)
    expect(result?.message).toMatch(/slug|url/i)
  })
})
