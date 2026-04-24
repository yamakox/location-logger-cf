import { Hono, Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { getCookie, setCookie } from 'hono/cookie'
import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1'
import { clients, locations } from '../drizzle/schema'
import { Client, Location } from '../src/shared/model'
import { eq, desc } from 'drizzle-orm'
// import { cors } from 'hono/cors'

const VERSION = '0.0.1'
const MAX_LOCATION_COUNT = 300

type ClientRow = typeof clients.$inferSelect
type LocationRow = typeof locations.$inferSelect

const app = new Hono<{ Bindings: Env }>()

// CORSミドルウェア
/*
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  })
)
*/

app.onError((err: Error | HTTPException, c: Context) => {
  const errorMessage = err?.message || err?.toString() || 'Unknown error'
  return c.json({ error: `プログラムエラーが発生しました: ${errorMessage}` }, 500)
})

app.get('/api/v1/misc/version', async (c: Context) => {
  return c.json({ version: VERSION })
})

app.get('/api/v1/client', async (c: Context) => {
  const db = drizzle(c.env.DB)
  const client = await getClient(db, c)
  return c.json({ cid: client.cid })
})

app.get('/api/v1/location', async (c: Context) => {
  const db = drizzle(c.env.DB)
  const client = await getClient(db, c)
  const locationRows: LocationRow[] = await db
    .select()
    .from(locations)
    .where(eq(locations.clientId, client.id))
    .orderBy(desc(locations.timestamp))
    .limit(MAX_LOCATION_COUNT)
  return c.json(
    locationRows.map(
      (row: LocationRow) =>
        ({
          timestamp: row.timestamp,
          latitude: row.latitude,
          longitude: row.longitude,
          distance: row.distance,
          address: row.address,
        }) as Location
    )
  )
})

app.post('/api/v1/location', async (c: Context) => {
  const db = drizzle(c.env.DB)
  const client = await getClient(db, c)
  const location = await c.req.json<Location>()
  const locationRow = await db
    .insert(locations)
    .values({
      timestamp: location.timestamp,
      latitude: location.latitude,
      longitude: location.longitude,
      distance: location.distance,
      address: location.address,
      clientId: client.id,
    })
    .returning()
  return c.json({ id: locationRow[0].id })
})

async function getClient(
  db: DrizzleD1Database<Record<string, never>>,
  c: Context
): Promise<Client> {
  var clientRow: ClientRow[] = []
  const cid = getCookie(c, 'cid')
  if (cid) {
    clientRow = await db.select().from(clients).where(eq(clients.cid, cid)).limit(1)
  }
  if (clientRow.length === 0) {
    clientRow = await db
      .insert(clients)
      .values({
        cid: crypto.randomUUID(),
        ua: c.req.header('User-Agent') ?? 'Unknown UA',
      })
      .returning()
  }
  setCookie(c, 'cid', clientRow[0].cid, {
    maxAge: 365 * 24 * 60 * 60, // 最大400日まで設定可能
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'Strict',
  })
  return clientRow[0] as Client
}

export default app
