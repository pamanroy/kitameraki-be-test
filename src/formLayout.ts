import { builtInFieldIdSchema, DEFAULT_FORM_ROWS, FormField, FormSettings } from '~/models/formSettings'

export function addMissingBuiltInFields(settings: FormSettings): FormSettings {
  const present = new Set(settings.rows.flat().map(field => field.id))
  const missing = builtInFieldIdSchema.options.filter(id => !present.has(id))

  const defaultLabels = new Map(DEFAULT_FORM_ROWS.flat().map(field => [field.id, field.label]))
  const rows: FormField[][] = missing.map(id => [{ builtIn: true, id, label: defaultLabels.get(id) ?? id }])

  return { ...settings, rows: [...settings.rows, ...rows] }
}
