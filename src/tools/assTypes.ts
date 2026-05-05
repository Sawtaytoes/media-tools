export type AssScriptInfoComment = {
  type: 'comment'
  text: string
}

export type AssScriptInfoProperty = {
  type: 'property'
  key: string
  value: string
}

export type AssScriptInfoEntry = AssScriptInfoComment | AssScriptInfoProperty

export type AssFormatEntry = {
  entryType: string
  fields: Record<string, string>
}

export type AssScriptInfoSection = {
  sectionName: string
  sectionType: 'scriptInfo'
  entries: AssScriptInfoEntry[]
}

export type AssFormattedSection = {
  sectionName: string
  sectionType: 'formatted'
  format: string[]
  entries: AssFormatEntry[]
}

export type AssRawSection = {
  sectionName: string
  sectionType: 'raw'
  lines: string[]
}

export type AssSection = AssScriptInfoSection | AssFormattedSection | AssRawSection

export type AssFile = {
  sections: AssSection[]
}

export type SetScriptInfoRule = {
  type: 'setScriptInfo'
  key: string
  value: string
}

export type ScaleResolutionRule = {
  type: 'scaleResolution'
  from?: { width: number; height: number }
  to: { width: number; height: number }
  syncLayoutRes?: boolean
  addLayoutRes?: boolean
  ensureScaledBorderAndShadow?: boolean
}

export type SetStyleFieldsRule = {
  type: 'setStyleFields'
  skipNamePattern?: string
  fields: Record<string, string>
}

export type AssModificationRule = SetScriptInfoRule | ScaleResolutionRule | SetStyleFieldsRule
