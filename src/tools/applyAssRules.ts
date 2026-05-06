import {
  type AssFile,
  type AssModificationRule,
  type AssScriptInfoSection,
  type ScaleResolutionRule,
  type SetScriptInfoRule,
  type SetStyleFieldsRule,
} from "./assTypes.js"

const getScriptInfoSection = (
  assFile: AssFile,
): AssScriptInfoSection | undefined => (
  assFile.sections.find(
    (s): s is AssScriptInfoSection => s.sectionType === "scriptInfo",
  )
)

const getScriptInfoValue = (
  assFile: AssFile,
  key: string,
): string | undefined => {
  const section = getScriptInfoSection(assFile)
  if (!section) return undefined
  const entry = section.entries.find(
    (e) => e.type === "property" && e.key === key,
  )
  return entry?.type === "property" ? entry.value : undefined
}

const applySetScriptInfo = (
  assFile: AssFile,
  rule: SetScriptInfoRule,
): AssFile => ({
  ...assFile,
  sections: assFile.sections.map((section) => {
    if (section.sectionType !== "scriptInfo") return section

    const existingIdx = section.entries.findIndex(
      (e) => e.type === "property" && e.key === rule.key,
    )

    if (existingIdx !== -1) {
      const entries = [...section.entries]
      entries[existingIdx] = { type: "property", key: rule.key, value: rule.value }
      return { ...section, entries }
    }

    const lastPropertyIdx = section.entries.reduce(
      (last, e, i) => (e.type === "property" ? i : last),
      -1,
    )
    const entries = [...section.entries]
    entries.splice(lastPropertyIdx + 1, 0, {
      type: "property",
      key: rule.key,
      value: rule.value,
    })
    return { ...section, entries }
  }),
})

const applyScaleResolution = (
  assFile: AssFile,
  rule: ScaleResolutionRule,
): AssFile => {
  const currentWidth = getScriptInfoValue(assFile, "PlayResX")
  const currentHeight = getScriptInfoValue(assFile, "PlayResY")

  if (
    rule.from
    && (
      currentWidth !== String(rule.from.width)
      || currentHeight !== String(rule.from.height)
    )
  ) {
    return assFile
  }

  const subRules: SetScriptInfoRule[] = [
    { type: "setScriptInfo", key: "PlayResX", value: String(rule.to.width) },
    { type: "setScriptInfo", key: "PlayResY", value: String(rule.to.height) },
  ]

  if (rule.isLayoutResSynced !== false) {
    const hasLayoutResX = getScriptInfoValue(assFile, "LayoutResX") !== undefined
    const hasLayoutResY = getScriptInfoValue(assFile, "LayoutResY") !== undefined

    if (hasLayoutResX || rule.hasLayoutRes) {
      subRules.push({ type: "setScriptInfo", key: "LayoutResX", value: String(rule.to.width) })
    }
    if (hasLayoutResY || rule.hasLayoutRes) {
      subRules.push({ type: "setScriptInfo", key: "LayoutResY", value: String(rule.to.height) })
    }
  }

  if (rule.hasScaledBorderAndShadow !== false) {
    subRules.push({
      type: "setScriptInfo",
      key: "ScaledBorderAndShadow",
      value: "yes",
    })
  }

  return subRules.reduce(
    (subRules, setScriptInfoRule) => applySetScriptInfo(subRules, setScriptInfoRule),
    assFile,
  )
}

const applySetStyleFields = (
  assFile: AssFile,
  rule: SetStyleFieldsRule,
): AssFile => {
  const ignoredStyleNamesRegex = rule.ignoredStyleNamesRegexString
    ? new RegExp(rule.ignoredStyleNamesRegexString, "i")
    : null

  return {
    ...assFile,
    sections: assFile.sections.map((section) => {
      if (section.sectionType !== "formatted") return section

      const hasStyleEntries = section.entries.some(
        (e) => e.entryType === "Style",
      )
      if (!hasStyleEntries) return section

      return {
        ...section,
        entries: section.entries.map((entry) => {
          if (entry.entryType !== "Style") return entry

          const styleName = entry.fields["Name"] ?? ""
          if (ignoredStyleNamesRegex && ignoredStyleNamesRegex.test(styleName)) return entry

          return {
            ...entry,
            fields: { ...entry.fields, ...rule.fields },
          }
        }),
      }
    }),
  }
}

export const applyAssRules = (
  assFile: AssFile,
  rules: AssModificationRule[],
): AssFile =>
  rules.reduce((acc, rule) => {
    switch (rule.type) {
      case "setScriptInfo": return applySetScriptInfo(acc, rule)
      case "scaleResolution": return applyScaleResolution(acc, rule)
      case "setStyleFields": return applySetStyleFields(acc, rule)
    }
  }, assFile)
