import { z } from "@hono/zod-openapi"
import { describe, expect, test } from "vitest"
import { fieldBuilder } from "./buildFields"

describe("fieldBuilder", () => {
  test("pulls description from the schema when override is silent", () => {
    const schema = z.object({
      sourcePath: z.string().describe("Source directory"),
    })
    const f = fieldBuilder(schema)
    const field = f("sourcePath", { type: "path" })
    expect(field.description).toBe("Source directory")
  })

  test("override wins over schema description", () => {
    const schema = z.object({
      sourcePath: z.string().describe("Source directory"),
    })
    const f = fieldBuilder(schema)
    const field = f("sourcePath", {
      type: "path",
      description: "Pick where your files live",
    })
    expect(field.description).toBe(
      "Pick where your files live",
    )
  })

  test("pulls default value from .default(...) on the schema", () => {
    const schema = z.object({
      isRecursive: z.boolean().default(true),
      depth: z.number().default(3),
    })
    const f = fieldBuilder(schema)
    expect(f("isRecursive", { type: "boolean" }).default).toBe(
      true,
    )
    expect(f("depth", { type: "number" }).default).toBe(3)
  })

  test("override default wins when explicitly given", () => {
    const schema = z.object({
      depth: z.number().default(3),
    })
    const f = fieldBuilder(schema)
    expect(
      f("depth", { type: "number", default: 5 }).default,
    ).toBe(5)
  })

  test("required is false when the schema is optional", () => {
    const schema = z.object({
      sourcePath: z.string(),
      tag: z.string().optional(),
    })
    const f = fieldBuilder(schema)
    expect(f("sourcePath", { type: "string" }).required).toBe(
      true,
    )
    expect(f("tag", { type: "string" }).required).toBe(false)
  })

  test("auto-derives enum options from z.enum(...)", () => {
    const schema = z.object({
      strategy: z.enum(["merge", "replace", "skip"]),
    })
    const f = fieldBuilder(schema)
    const field = f("strategy", { type: "enum" })
    expect(field.options).toEqual([
      { value: "merge", label: "merge" },
      { value: "replace", label: "replace" },
      { value: "skip", label: "skip" },
    ])
  })

  test("passes through web-only UI hints (lookupType, visibleWhen, min)", () => {
    const schema = z.object({
      malId: z.number().optional(),
    })
    const f = fieldBuilder(schema)
    const field = f("malId", {
      type: "numberWithLookup",
      lookupType: "mal",
      companionNameField: "malName",
      min: 1,
      visibleWhen: { searchTerm: { isEmpty: true } },
    })
    expect(field.lookupType).toBe("mal")
    expect(field.companionNameField).toBe("malName")
    expect(field.min).toBe(1)
    expect(field.visibleWhen).toEqual({
      searchTerm: { isEmpty: true },
    })
  })
})

// Defends against silent server/web default drift for the commands that
// have been migrated to fieldBuilder. Each entry asserts the schema's
// .default(...) value matches what the web UI ships. When a new command
// migrates, add it here so the contract stays enforced.
describe("commands registry default-drift guards", () => {
  test("storeAspectRatioData isRecursive defaults to true", async () => {
    const schemas = await import(
      "@media-tools/server/api-schemas"
    )
    const shape =
      schemas.storeAspectRatioDataRequestSchema.def.shape
    const def = (
      shape.isRecursive as {
        def: { type: string; defaultValue: unknown }
      }
    ).def
    expect(def.type).toBe("default")
    expect(def.defaultValue).toBe(true)
  })

  test("storeAspectRatioData recursiveDepth defaults to 3", async () => {
    const schemas = await import(
      "@media-tools/server/api-schemas"
    )
    const shape =
      schemas.storeAspectRatioDataRequestSchema.def.shape
    const def = (
      shape.recursiveDepth as {
        def: { type: string; defaultValue: unknown }
      }
    ).def
    expect(def.type).toBe("default")
    expect(def.defaultValue).toBe(3)
  })
})
