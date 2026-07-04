import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import next from 'next'
import { startContentAnalysisWorker } from './workers/contentAnalysisWorker.js'
import { startScheduledPostsWorker } from './workers/scheduledPostsWorker.js'

const dev = process.env.NODE_ENV !== 'production'
const nextApp = next({ dev })
const handle = nextApp.getRequestHandler()
const port = Number(process.env.PORT || 3000)

async function main() {
  await nextApp.prepare()

  const server = express()

  server.use(express.json({ limit: '50mb' }))
  server.use(express.urlencoded({ extended: true, limit: '50mb' }))

  server.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      console.error('JSON parsing error:', err.message)
      return res.status(400).json({ error: 'Invalid JSON in request body' })
    }
    _next(err)
  })

  server.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', message: 'Carubra Backend is running' })
  })

  // All other routes go through Next.js (including /api/*)
  server.all('*', (req: Request, res: Response) => {
    return handle(req, res)
  })

  server.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Global Error Handler] Error:', err)
    console.error('[Global Error Handler] Stack:', err.stack)
    res.status(500).json({ error: err.message || 'Internal server error' })
  })

  startContentAnalysisWorker()
  startScheduledPostsWorker()

  server.listen(port, () => {
    console.log(`🚀 Carubra Media Generator running on http://localhost:${port}`)
  })
}

main().catch((error) => {
  console.error('Fatal error starting server:', error)
  process.exit(1)
})
