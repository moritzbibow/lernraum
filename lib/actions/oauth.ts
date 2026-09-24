'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { buildRedirect, createAuthorizationCode, validateAuthorizeRequest, type AuthorizeParams } from '../auth/oauth'
import { resourceUrl } from '../auth/oauth-metadata'
import { assertSession } from '../auth/session'
import { baseUrl } from '../env'

function paramsFrom(form: FormData): AuthorizeParams {
  const get = (k: string) => {
    const v = form.get(k)
    return typeof v === 'string' && v.length ? v : null
  }
  return {
    response_type: get('response_type'),
    client_id: get('client_id'),
    redirect_uri: get('redirect_uri'),
    code_challenge: get('code_challenge'),
    code_challenge_method: get('code_challenge_method'),
    state: get('state'),
    scope: get('scope'),
    resource: get('resource'),
  }
}

export async function decideAuthorizationAction(form: FormData): Promise<void> {
  await assertSession()
  const h = await headers()
  const issuer = baseUrl(h)
  const result = validateAuthorizeRequest(paramsFrom(form), [resourceUrl(h), issuer])
  if (!result.ok) {
    if (result.redirectable) {
      redirect(buildRedirect(result.redirectUri, { error: result.error, error_description: result.description, state: result.state, iss: issuer }))
    }
    redirect('/einstellungen#claude')
  }
  const req = result.request
  if (form.get('decision') !== 'allow') {
    redirect(buildRedirect(req.redirectUri, { error: 'access_denied', error_description: 'Zugriff abgelehnt.', state: req.state, iss: issuer }))
  }
  const code = createAuthorizationCode(req)
  redirect(buildRedirect(req.redirectUri, { code, state: req.state, iss: issuer }))
}
