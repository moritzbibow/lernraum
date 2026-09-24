import { withApi } from '@/lib/api'
import { exportAll } from '@/lib/services/export'

export const dynamic = 'force-dynamic'

/** GET /api/export – kompletter JSON-Export zum Herunterladen. */
export const GET = withApi(
  async () => {
    const date = new Date().toISOString().slice(0, 10)
    return new Response(JSON.stringify(exportAll(), null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="lernraum-export-${date}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  },
  { allowSession: true },
)
