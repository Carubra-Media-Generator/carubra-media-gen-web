import { NextRequest, NextResponse } from "next/server"
import { CONTENT_STRATEGY_SYSTEM_PROMPT, buildUserPrompt } from "./prompts"
import { getUserFromRequest } from "@/middleware/auth"
import { insert, find } from "@/lib/supabase"


export type StrategyResult = {
	concept_title: string
	concept_description: string
	hook: string
	content_flow: string[]
	caption: string
	caption_score: number
	caption_tone: string
	hashtags: string[]
	hashtag_warning: string | null
	estimated_views: { min: string; max: string }
	engagement_rate: number
	viral_score: number
	best_post_time: string
	best_post_days: string
	content_formats: string[]
	audience_match: { segment: string; pct: number }[]
	platform_reach: { platform: string; reach: string; color: string }[]
	trend_30d: number[]
	sentiment: { positive: number; neutral: number; negative: number }
	sentiment_summary: string
	recommendations: {
		icon: string
		title: string
		description: string
		priority: "high" | "medium" | "low"
	}[]
	competitor_insight: string
	cta_suggestions: string[]
}

export type StrategyJob = {
	id: string
	prompt: string
	platform: string
	target_audience: string
	status: "completed" | "processing" | "failed"
	created_at: string
	result: StrategyResult | null
	error?: string
}

// ── Per-user in-memory fallback (used when Supabase table doesn't exist) ────
const fallbackStore: Map<string, Map<string, StrategyJob>> = new Map()
function getFallbackJobs(userId: string): Map<string, StrategyJob> {
	if (!fallbackStore.has(userId)) fallbackStore.set(userId, new Map())
	return fallbackStore.get(userId)!
}

async function persistJob(job: StrategyJob, userId: string, targetAudience?: string, contentType?: string) {
	try {
		console.log('[content-analysis] persisting job:', { jobId: job.id, userId, targetAudience, contentType, status: job.status })
		const { upsert } = await import('@/lib/supabase')
		await upsert('content_analysis', {
			id: job.id,
			user_id: userId,
			prompt: job.prompt,
			platform: job.platform,
			target_audience: targetAudience,
			content_type: contentType,
			status: job.status,
			analysis_result: job.result,
			created_at: job.created_at,
			updated_at: new Date().toISOString(),
		}, { onConflict: 'id' })
		console.log('[content-analysis] successfully persisted job:', job.id)
	} catch (e: any) {
		console.error('[content-analysis] failed to persist:', e.message, e)
		// Table may not exist yet — use in-memory fallback
		getFallbackJobs(userId).set(job.id, job)
	}
}

async function updatePersistedJob(jobId: string, userId: string, updates: Partial<StrategyJob>) {
	try {
		const { upsert } = await import('@/lib/supabase')
		const dbUpdates: any = { updated_at: new Date().toISOString() }
		if (updates.status) dbUpdates.status = updates.status
		if (updates.result !== undefined) dbUpdates.analysis_result = updates.result
		// Use upsert to avoid UUID type issues
		await upsert('content_analysis', {
			id: jobId,
			user_id: userId,
			...dbUpdates,
		}, { onConflict: 'id' })
		console.log('[content-analysis] successfully updated job:', jobId)
	} catch (e: any) {
		console.error('[content-analysis] failed to update:', e.message, e)
		const existing = getFallbackJobs(userId).get(jobId)
		if (existing) getFallbackJobs(userId).set(jobId, { ...existing, ...updates })
	}
}

async function loadJobs(userId: string): Promise<StrategyJob[]> {
	try {
		console.log('[content-analysis] loading jobs for userId:', userId)
		const rows = await find('content_analysis', { user_id: userId }, { orderBy: 'created_at', ascending: false })
		console.log('[DEBUG content_analysis rows]', rows?.length, rows)
		return (rows || []).map((r: any) => {
			let parsedResult = r.analysis_result
			if (typeof parsedResult === 'string') {
				try { parsedResult = JSON.parse(parsedResult) } catch (e) {}
			}
			// console.log('[DEBUG parsedResult]', typeof parsedResult, r.analysis_result)
			return {
				id: r.id,
				prompt: r.prompt,
				platform: r.platform,
				target_audience: r.target_audience ?? 'Umum',
				status: r.status,
				created_at: r.created_at,
				result: parsedResult ?? null,
			}
		})
	} catch (e: any) {
		console.error('[content-analysis] failed to load:', e.message, e)
		// Fallback to in-memory
		return Array.from(getFallbackJobs(userId).values()).sort(
			(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
		)
	}
}

// ─────────────────────────────────────────────────────────────────────────────

function extractJsonBlock(text: string) {
	const matches = text.match(/\{[\s\S]*\}/g)
	if (!matches) return null
	return matches.reduce((a, b) => (a.length > b.length ? a : b), "")
}

function escapeUnescapedStringNewlines(text: string) {
	let inString = false
	let escaped = false
	let result = ""
	for (let i = 0; i < text.length; i++) {
		const char = text[i]
		if (char === '"' && !escaped) {
			inString = !inString
			result += char
			continue
		}
		if (char === '\\' && !escaped) {
			escaped = true
			result += char
			continue
		}
		if (char === '\n' && inString && !escaped) {
			result += '\\n'
			continue
		}
		if (char === '\r' && inString && !escaped) {
			result += '\\n'
			escaped = false
			continue
		}
		result += char
		escaped = false
	}
	return result
}

function normalizeJsonText(text: string) {
	let t = text
	t = t.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim()
	const singleQuotesLikely = /'[^']*'/.test(t) && !/"[^\"]*"/.test(t)
	if (singleQuotesLikely) {
		t = t.replace(/'/g, '"')
	}
	t = t.replace(/,\s*([}\]])/g, "$1")
	t = escapeUnescapedStringNewlines(t)
	return t
}

function repairTruncatedJson(text: string): any {
	// Analyze which brackets/strings are still open, then close them
	let inString = false
	let escaped = false
	const stack: string[] = []
	for (let i = 0; i < text.length; i++) {
		const ch = text[i]
		if (escaped) { escaped = false; continue }
		if (ch === '\\' && inString) { escaped = true; continue }
		if (ch === '"') {
			if (inString) { inString = false }
			else { inString = true }
			continue
		}
		if (inString) continue
		if (ch === '{') stack.push('}')
		else if (ch === '[') stack.push(']')
		else if (ch === '}' || ch === ']') stack.pop()
	}

	// Build suffix to close everything that's open
	let suffix = ''
	if (inString) suffix += '"'
	for (let i = stack.length - 1; i >= 0; i--) {
		suffix += stack[i]
	}

	// Remove trailing partial tokens (e.g. a trailing comma or colon before we close)
	let base = text.trimEnd()
	// Remove trailing comma that would be invalid before a closing bracket
	base = base.replace(/,\s*$/, '')

	const attempt = base + suffix
	try {
		return JSON.parse(attempt)
	} catch {}

	// Also try closing an open string value first
	const attempt2 = base + '"' + suffix
	try {
		return JSON.parse(attempt2)
	} catch {}

	// Try with null for the truncated value
	const attempt3 = base.replace(/:\s*"[^"]*$/, ': null') + suffix
	try {
		return JSON.parse(attempt3)
	} catch {}

	return null
}

function robustParseJsonFromText(text: string) {
	const cleaned = normalizeJsonText(text)
	try {
		return JSON.parse(cleaned)
	} catch {
		const block = extractJsonBlock(text)
		if (!block) {
			// No complete JSON block found — may be truncated, try repairing the full text
			const repaired = repairTruncatedJson(normalizeJsonText(text))
			if (repaired) return repaired
			throw new Error("AI tidak mengembalikan JSON yang bisa diekstrak. Response: " + text.slice(0, 600))
		}
		const normalizedBlock = normalizeJsonText(block)
		try {
			return JSON.parse(normalizedBlock)
		} catch {
			const repaired = repairTruncatedJson(normalizedBlock)
			if (repaired) return repaired
			throw new Error("AI tidak mengembalikan JSON valid. Response: " + normalizedBlock.slice(0, 600))
		}
	}
}

function unwrapRootObject(src: any) {
	if (!src || typeof src !== 'object') return src
	const keys = Object.keys(src)
	if (keys.length === 1 && typeof src[keys[0]] === 'object') {
		return src[keys[0]]
	}
	return src
}

function mapKeysToStrategy(obj: any, platform: string, targetAudience: string | undefined, contentType: string | undefined): StrategyResult {
	const source = unwrapRootObject(obj)

	function pick(src: any, alts: string[]) {
		if (!src || typeof src !== 'object') return undefined
		for (const a of alts) {
			if (src[a] !== undefined) return src[a]
			const found = Object.keys(src).find(k => k.toLowerCase() === a.toLowerCase())
			if (found) return src[found]
		}
		return undefined
	}

	function firstStringArray(src: any, alts: string[]) {
		const value = pick(src, alts)
		if (Array.isArray(value)) return value.map(String)
		if (typeof value === 'string' && value.trim()) return [value]
		return []
	}

	function normalizeArray(src: any) {
		if (Array.isArray(src)) return src
		if (typeof src === 'string' && src.trim()) return [src]
		return []
	}

	function firstObjectArray(src: any, alts: string[]) {
		const value = pick(src, alts)
		return Array.isArray(value) ? value : []
	}

	const out: any = {}
	out.concept_title = pick(source, ['concept_title', 'judul', 'title', 'goal', 'deskripsi', 'nama_konten', 'deskripsi_produk']) ?? 'Konsep Konten'
	out.concept_description = pick(source, ['concept_description', 'deskripsi', 'description', 'goal', 'deskripsi_produk']) ?? ''
	out.hook = pick(source, ['hook', 'opening', 'tangkapan', 'hook_3s']) ?? ''
	out.content_flow = firstStringArray(source, ['content_flow', 'alur_konten', 'steps', 'flow', 'ide_konten'])
	out.caption = pick(source, ['caption', 'caption_text', 'keterangan']) ?? ''
	out.caption_score = Number(pick(source, ['caption_score', 'score_caption'])) || 0
	out.caption_tone = pick(source, ['caption_tone', 'tone', 'caption_style']) ?? 'relatable'
	out.hashtags = firstStringArray(source, ['hashtags', 'tagar', 'tags', 'hashtags_strategy', 'keyThemes', 'hashtag_rekomendasi'])
	out.hashtag_warning = pick(source, ['hashtag_warning', 'peringatan_hashtag']) ?? null
	out.estimated_views = pick(source, ['estimated_views', 'perkiraan_views']) ?? { min: '0', max: '0' }
	out.engagement_rate = Number(pick(source, ['engagement_rate', 'eng_rate'])) || 0
	out.viral_score = Number(pick(source, ['viral_score', 'viral'])) || 0
	out.best_post_time = pick(source, ['best_post_time', 'waktu_terbaik']) ?? ''
	out.best_post_days = pick(source, ['best_post_days', 'hari_terbaik']) ?? ''
	out.content_formats = firstStringArray(source, ['content_formats', 'format_konten', 'content_format_recommendations'])
	out.audience_match = pick(source, ['audience_match', 'audience']) ?? []
	out.platform_reach = pick(source, ['platform_reach', 'jangkauan_platform', 'measurement_metrics']) ?? []
	out.trend_30d = normalizeArray(pick(source, ['trend_30d', 'trend']))
	out.sentiment = pick(source, ['sentiment', 'sentimen']) ?? { positive: 60, neutral: 30, negative: 10 }
	out.sentiment_summary = pick(source, ['sentiment_summary', 'ringkasan_sentimen']) ?? ''
	out.recommendations = pick(source, ['recommendations', 'rekomendasi', 'engagement_tactics']) ?? []
	out.competitor_insight = pick(source, ['competitor_insight', 'insight_competitor', 'insight_kompetitor']) ?? ''
	out.cta_suggestions = firstStringArray(source, ['cta_suggestions', 'cta', 'cta_variations'])

	const pillars = firstObjectArray(source, ['content_pillars', 'pillars', 'contentPillar', 'content_pillar', 'ide_konten'])
	if (out.content_flow.length === 0 && pillars.length > 0) {
		out.content_flow = pillars.flatMap((p: any) => {
			if (Array.isArray(p.contentIdeas)) {
				return p.contentIdeas.slice(0, 2).map((idea: any) => String(idea.idea || idea.title || idea.name || 'Ide konten'))
			}
			return [p.pillar_name || p.pillarName || p.nama_konten || p.deskripsi || String(p)]
		}).slice(0, 5)
	}

	if (out.content_formats.length === 0) {
		const contentTypeList = pick(source, ['contentTypes', 'content_types', 'tipe_konten', 'content_type'])
		if (Array.isArray(contentTypeList)) {
			out.content_formats = Array.from(new Set(contentTypeList.map(String)))
		} else if (typeof contentTypeList === 'string') {
			out.content_formats = [contentTypeList]
		}
	}

	if (out.recommendations.length === 0 && pillars.length > 0) {
		out.recommendations = pillars.slice(0, 4).map((p: any) => ({
			icon: '🔥',
			title: p.pillar_name || p.pillarName || 'Strategi utama',
			description: Array.isArray(p.contentIdeas)
				? p.contentIdeas.slice(0, 2).map((idea: any) => String(idea.recommendations || idea.description || idea.idea || idea.title || idea.name)).filter(Boolean).join('; ')
				: String(p.description ?? ''),
			priority: 'medium',
		}))
	}

	if (out.hashtags.length === 0) {
		const keyThemes = pick(source, ['keyThemes', 'tema_kunci', 'themes'])
		if (Array.isArray(keyThemes)) {
			out.hashtags = keyThemes.slice(0, 7).map((tag: any) => {
				const raw = String(tag)
				return raw.startsWith('#') ? raw : `#${raw.replace(/\s+/g, '').toLowerCase()}`
			})
		}
	}

	if (out.cta_suggestions.length === 0) {
		const ctas = pick(source, ['cta_suggestions', 'cta', 'call_to_action'])
		if (Array.isArray(ctas)) out.cta_suggestions = ctas.map(String)
		else if (typeof ctas === 'string') out.cta_suggestions = [ctas]
	}

	if (!out.concept_description) out.concept_description = String(pick(source, ['goal', 'deskripsi']) ?? '')
	if (out.content_flow.length === 0) out.content_flow = [`Mulai dengan pengenalan ${platform}`]
	if (out.hashtags.length === 0) out.hashtags = ['#foryou', '#trending']
	if (out.recommendations.length === 0) out.recommendations = [
		{ icon: '🔥', title: 'Gunakan tren', description: 'Fokus pada momen launch dengan konten yang mudah dibagikan.', priority: 'medium' },
		{ icon: '📌', title: 'CTA jelas', description: 'Tutup dengan ajakan bertindak yang relevan untuk Gen Z.', priority: 'high' },
		{ icon: '⚡', title: 'Visual kuat', description: 'Pastikan konten bergerak cepat dan eye-catching.', priority: 'medium' },
		{ icon: '💬', title: 'Engagement', description: 'Tanyakan opini follower untuk meningkatkan interaksi.', priority: 'low' },
	]

	if (!Array.isArray(out.trend_30d)) out.trend_30d = []
	if (!out.sentiment || typeof out.sentiment !== 'object') out.sentiment = { positive: 60, neutral: 30, negative: 10 }
	if (!out.sentiment_summary) out.sentiment_summary = 'Sentimen positif terhadap campaign ini cenderung tinggi.'

	return out as StrategyResult
}

export async function POST(req: NextRequest) {
	const user = getUserFromRequest(req)
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

	try {
		const body = await req.json()
		const { prompt, platform, target_audience, content_type } = body

		if (!prompt?.trim()) {
			return NextResponse.json({ error: 'Prompt tidak boleh kosong' }, { status: 400 })
		}
		if (!platform) {
			return NextResponse.json({ error: 'Platform harus dipilih' }, { status: 400 })
		}

		const jobId = `ca_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
		const job: StrategyJob = {
			id: jobId,
			prompt,
			platform,
			target_audience: target_audience ?? 'Umum',
			status: 'processing',
			created_at: new Date().toISOString(),
			result: null,
		}

		// Persist immediately as 'processing'
		await persistJob(job, user.id, target_audience, content_type)

		const userMessage = buildUserPrompt({
			prompt,
			platform,
			targetAudience: target_audience,
			contentType: content_type,
		})

		const apiUrl = (process.env.CONTENT_API_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')
		const aiResponse = await fetch(`${apiUrl}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${process.env.CONTENT_API_KEY || ''}`,
			},
			body: JSON.stringify({
				model: process.env.CONTENT_MODEL || 'google/gemini-2.5-flash',
				max_tokens: 4096,
				temperature: 0.7,
				response_format: { type: 'json_object' },
				system: CONTENT_STRATEGY_SYSTEM_PROMPT,
				messages: [{ role: 'user', content: userMessage }],
			}),
		})

		if (!aiResponse.ok) {
			const errText = await aiResponse.text()
			throw new Error(`AI API error: ${aiResponse.status} — ${errText}`)
		}

		const aiData = await aiResponse.json()
		const finishReason = aiData?.choices?.[0]?.finish_reason
		let rawText: any = aiData?.choices?.[0]?.message?.content
		console.log('[content-analysis rawText]', typeof rawText, typeof rawText === 'string' && rawText.slice ? rawText.slice(0, 1000) : rawText)
		if (finishReason === 'length') {
			console.warn('[content-analysis] Response truncated (finish_reason=length), will attempt repair')
		}

		let parsed: any
		if (rawText === undefined || rawText === null) {
			throw new Error('AI response kosong')
		}
		if (typeof rawText === 'object') {
			parsed = rawText
		} else if (typeof rawText === 'string') {
			const trimmed = rawText.trim()
			if (!trimmed) throw new Error('AI mengembalikan string kosong')
			parsed = robustParseJsonFromText(trimmed)
		} else {
			throw new Error('Tipe response AI tidak dikenali: ' + typeof rawText)
		}

		const result = mapKeysToStrategy(parsed, platform, target_audience, content_type)
		job.status = 'completed'
		job.result = result

		// Update persisted job with result using upsert
		await persistJob(job, user.id, target_audience, content_type)

		return NextResponse.json({ job }, { status: 201 })
	} catch (err: any) {
		console.error('[content-analysis POST]', err)
		return NextResponse.json({ error: err.message ?? 'Terjadi kesalahan internal' }, { status: 500 })
	}
}

export async function GET(req: NextRequest) {
	const user = getUserFromRequest(req)
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

	try {
		const jobs = await loadJobs(user.id)
		return NextResponse.json({ jobs })
	} catch (err: any) {
		console.error('[content-analysis GET error]', err)
		return NextResponse.json({ error: err.message }, { status: 500 })
	}
}


