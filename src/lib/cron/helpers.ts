import * as Sentry from '@sentry/nextjs'

interface CronStepResult {
    ok:      boolean
    message: string
    data?:   Record<string, unknown>
}

/**
 * Tek bir cron adımını çalıştırır.
 * Hata olursa Sentry'e raporlar ve sonucu döner — exception fırlatmaz.
 */
export async function runCronStep(
    stepName: string,
    fn: () => Promise<CronStepResult>
): Promise<CronStepResult> {
    return Sentry.withScope(async (scope) => {
        scope.setTag('cron.step', stepName)
        scope.setContext('cron', { step: stepName, startedAt: new Date().toISOString() })

        try {
            const result = await fn()
            if (!result.ok) {
                // İş mantığı hatası — Sentry'e warning olarak ilet
                Sentry.captureMessage(`Cron step "${stepName}" failed: ${result.message}`, 'warning')
            }
            return result
        } catch (err) {
            // Beklenmedik exception — Sentry'e error olarak ilet
            Sentry.captureException(err, {
                tags:  { 'cron.step': stepName },
                extra: { step: stepName },
            })
            const message = err instanceof Error ? err.message : 'Unknown error'
            return { ok: false, message }
        }
    })
}

/**
 * Authorization header'ını doğrular.
 * Bearer <CRON_SECRET> formatı beklenir.
 */
export function verifyCronSecret(authHeader: string | null): boolean {
    const secret = process.env.CRON_SECRET
    if (!secret) {
        console.error('[Cron] CRON_SECRET env var is not set!')
        return false
    }
    return authHeader === `Bearer ${secret}`
}
