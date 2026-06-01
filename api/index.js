import { json } from '../src/server/supabaseAdmin.js'

import media from '../api_handlers/media.js'
import producer from '../api_handlers/producer.js'
import resetPassword from '../api_handlers/reset-password.js'
import resolveCourseMedia from '../api_handlers/resolve-course-media.js'
import sendEmail from '../api_handlers/send-email.js'
import simuladoCheckout from '../api_handlers/simulado-checkout.js'
import simuladoCheckoutVerify from '../api_handlers/simulado-checkout-verify.js'
import updateQuestion from '../api_handlers/update-question.js'
import uploadCourseMedia from '../api_handlers/upload-course-media.js'
import uploadQuestionMedia from '../api_handlers/upload-question-media.js'
import version from '../api_handlers/version.js'
import oauthGoogleStart from '../api_handlers/oauth/google-start.js'
import oauthGoogleCallback from '../api_handlers/oauth/google-callback.js'
import oauthFacebookStart from '../api_handlers/oauth/facebook-start.js'
import oauthFacebookCallback from '../api_handlers/oauth/facebook-callback.js'

import authAction from '../api_handlers/auth/[action].js'

import adminMe from '../api_handlers/admin/me.js'
import adminCoursesList from '../api_handlers/admin/courses/list.js'
import adminUsersList from '../api_handlers/admin/users/list.js'
import adminUsersGet from '../api_handlers/admin/users/get.js'
import adminUsersCreate from '../api_handlers/admin/users/create.js'
import adminUsersUpdate from '../api_handlers/admin/users/update.js'
import adminUsersBulkDisable from '../api_handlers/admin/users/bulk-disable.js'
import adminUsersBulkEnable from '../api_handlers/admin/users/bulk-enable.js'
import adminUsersBulkCreate from '../api_handlers/admin/users/bulk-create.js'
import adminUsersFirstAccessLink from '../api_handlers/admin/users/first-access-link.js'
import adminVercelStatus from '../api_handlers/admin/vercel/status.js'
import adminVercelDeploy from '../api_handlers/admin/vercel/deploy.js'
import adminWithdrawRequestsList from '../api_handlers/admin/withdraw_requests/list.js'
import adminWithdrawRequestsUpdateStatus from '../api_handlers/admin/withdraw_requests/update-status.js'
import adminLogosUpload from '../api_handlers/admin/logos/upload.js'

function getPathFromRequest(req) {
  try {
    const u = new URL(req.url, 'http://localhost')
    const forced = String(u.searchParams.get('__path') || '').trim()
    if (forced) return forced
    return String(u.pathname || '')
  } catch (_) {
    return ''
  }
}

export default async function handler(req, res) {
  try {
    const rawPath = getPathFromRequest(req)
    const pathname = String(rawPath || '').split('?')[0]

    const routes = new Map([
      ['/api/media', media],
      ['/api/producer', producer],
      ['/api/reset-password', resetPassword],
      ['/api/resolve-course-media', resolveCourseMedia],
      ['/api/send-email', sendEmail],
      ['/api/simulado-checkout', simuladoCheckout],
      ['/api/simulado-checkout-verify', simuladoCheckoutVerify],
      ['/api/update-question', updateQuestion],
      ['/api/upload-course-media', uploadCourseMedia],
      ['/api/upload-question-media', uploadQuestionMedia],
      ['/api/version', version],
      ['/api/oauth/google/start', oauthGoogleStart],
      ['/api/oauth/google/callback', oauthGoogleCallback],
      ['/api/oauth/facebook/start', oauthFacebookStart],
      ['/api/oauth/facebook/callback', oauthFacebookCallback],
      ['/api/oauth/google-start', oauthGoogleStart],
      ['/api/oauth/google-callback', oauthGoogleCallback],
      ['/api/oauth/facebook-start', oauthFacebookStart],
      ['/api/oauth/facebook-callback', oauthFacebookCallback],
      ['/api/admin/me', adminMe],
      ['/api/admin/courses/list', adminCoursesList],
      ['/api/admin/users/list', adminUsersList],
      ['/api/admin/users/get', adminUsersGet],
      ['/api/admin/users/create', adminUsersCreate],
      ['/api/admin/users/update', adminUsersUpdate],
      ['/api/admin/users/bulk-disable', adminUsersBulkDisable],
      ['/api/admin/users/bulk-enable', adminUsersBulkEnable],
      ['/api/admin/users/bulk-create', adminUsersBulkCreate],
      ['/api/admin/users/first-access-link', adminUsersFirstAccessLink],
      ['/api/admin/vercel/status', adminVercelStatus],
      ['/api/admin/vercel/deploy', adminVercelDeploy],
      ['/api/admin/withdraw-requests/list', adminWithdrawRequestsList],
      ['/api/admin/withdraw-requests/update-status', adminWithdrawRequestsUpdateStatus],
      ['/api/admin/logos/upload', adminLogosUpload],
    ])

    const direct = routes.get(pathname)
    if (direct) return await direct(req, res)

    if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) {
      return await authAction(req, res)
    }

    return json(res, 404, { error: 'not_found' })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}
