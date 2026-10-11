import { HttpRequest, HttpResponseInit } from '@azure/functions'
import { formSettingsContainer } from '~/cosmos'
import { getFormSettings } from '~/formSettings'
import { register } from '~/http'
import { getFormSettingsParamsSchema, updateFormSettingsRequestSchema } from '~/models/formSettings'
import { parseBody, parseParams } from '~/validation'

export async function GetFormSettings(request: HttpRequest): Promise<HttpResponseInit> {
  const params = parseParams(request, getFormSettingsParamsSchema)
  if ('error' in params) return params.error

  const settings = await getFormSettings(params.data.organizationId)

  return { jsonBody: settings, status: 200 }
}

export async function UpdateFormSettings(request: HttpRequest): Promise<HttpResponseInit> {
  const params = parseParams(request, getFormSettingsParamsSchema)
  if ('error' in params) return params.error

  const { organizationId } = params.data
  const parsed = await parseBody(request, updateFormSettingsRequestSchema)
  if ('error' in parsed) return parsed.error

  const settings = await formSettingsContainer.items.upsert({ ...parsed.data, id: organizationId, organizationId })

  return { jsonBody: settings.resource, status: 200 }
}

export async function DeleteFormSettings(request: HttpRequest): Promise<HttpResponseInit> {
  const params = parseParams(request, getFormSettingsParamsSchema)
  if ('error' in params) return params.error

  const { organizationId } = params.data
  await formSettingsContainer
    .item(organizationId, organizationId)
    .delete()
    .catch(error => {
      if (error.code !== 404) throw error
    })

  return { status: 204 }
}

const FORM_SETTINGS_ROUTE = 'organizations/{organizationId}/form-settings'

register('GET', FORM_SETTINGS_ROUTE, GetFormSettings)
register('PUT', FORM_SETTINGS_ROUTE, UpdateFormSettings)
register('DELETE', FORM_SETTINGS_ROUTE, DeleteFormSettings)
