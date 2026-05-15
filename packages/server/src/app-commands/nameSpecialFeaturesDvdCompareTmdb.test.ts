import { describe, expect, test } from "vitest"
import {
  groupRenamesByTarget,
  promoteRenameToFront,
} from "./nameSpecialFeaturesDvdCompareTmdb.js"

describe(groupRenamesByTarget.name, () => {
  test("groups multiple renames sharing the same target and preserves input order within each group", () => {
    const renameOne = {
      renamedFilename: "Behind the Scenes -behindthescenes",
    }
    const renameTwo = {
      renamedFilename: "Trailer -trailer",
    }
    const renameThree = {
      renamedFilename: "Behind the Scenes -behindthescenes",
    }
    const groups = groupRenamesByTarget([
      renameOne,
      renameTwo,
      renameThree,
    ])
    expect(
      groups.get("Behind the Scenes -behindthescenes"),
    ).toEqual([renameOne, renameThree])
    expect(groups.get("Trailer -trailer")).toEqual([
      renameTwo,
    ])
  })

  test("returns single-entry groups for non-duplicate targets", () => {
    const renameOne = { renamedFilename: "A" }
    const renameTwo = { renamedFilename: "B" }
    const groups = groupRenamesByTarget([
      renameOne,
      renameTwo,
    ])
    expect(groups.size).toBe(2)
  })
})

describe(promoteRenameToFront.name, () => {
  test("moves the chosen entry to the front while preserving the relative order of the rest", () => {
    const first = { id: 1 }
    const second = { id: 2 }
    const third = { id: 3 }
    expect(
      promoteRenameToFront([first, second, third], second),
    ).toEqual([second, first, third])
  })

  test("returns the array unchanged when the chosen entry is not present", () => {
    const first = { id: 1 }
    const stranger = { id: 99 }
    expect(promoteRenameToFront([first], stranger)).toEqual(
      [first],
    )
  })

  test("returns the array unchanged when the chosen entry is already at the front", () => {
    const first = { id: 1 }
    const second = { id: 2 }
    expect(
      promoteRenameToFront([first, second], first),
    ).toEqual([first, second])
  })
})
