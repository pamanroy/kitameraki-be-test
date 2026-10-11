import { formSettingsContainer } from '~/cosmos'
import { DEFAULT_FORM_ROWS, FormSettings } from '~/models/formSettings'

export async function getFormSettings(organizationId: string): Promise<FormSettings> {
  const settings = await formSettingsContainer.item(organizationId, organizationId).read<FormSettings>()

  return settings.resource ?? { organizationId, rows: DEFAULT_FORM_ROWS }
}
