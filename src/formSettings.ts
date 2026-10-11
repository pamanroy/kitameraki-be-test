import { formSettingsContainer } from '~/cosmos'
import { addMissingBuiltInFields } from '~/formLayout'
import { DEFAULT_FORM_ROWS, FormSettings } from '~/models/formSettings'

export async function getFormSettings(organizationId: string): Promise<FormSettings> {
  const settings = await formSettingsContainer.item(organizationId, organizationId).read<FormSettings>()

  return settings.resource ? addMissingBuiltInFields(settings.resource) : { organizationId, rows: DEFAULT_FORM_ROWS }
}
