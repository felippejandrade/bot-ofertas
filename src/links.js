// Encontra links em uma mensagem e troca pelos links de afiliado configurados.

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const ML_HOSTS = ['mercadolivre.com.br', 'mercadolivre.com', 'mercadolibre.com', 'meli.la']
const AMAZON_HOSTS = ['amazon.com.br', 'amazon.com', 'amzn.to', 'amzn.com', 'a.co']

const hostMatches = (host, list) => list.some(h => host === h || host.endsWith('.' + h))

export function extractUrls(text) {
	return [...new Set((text.match(URL_REGEX) || []).map(u => u.replace(/[.,;:!?)\]*_~]+$/, '')))]
}

export function marketplaceOf(url) {
	try {
		const host = new URL(url).hostname.toLowerCase()
		if (hostMatches(host, ML_HOSTS)) return 'ml'
		if (hostMatches(host, AMAZON_HOSTS)) return 'amazon'
	} catch {}
	return null
}

async function fetchText(url, timeoutMs = 10000) {
	const res = await fetch(url, {
		headers: { 'user-agent': UA, 'accept-language': 'pt-BR,pt;q=0.9' },
		redirect: 'follow',
		signal: AbortSignal.timeout(timeoutMs)
	})
	return { url: res.url, status: res.status, html: await res.text() }
}

// Segue redirecionamentos (encurtadores, meli.la, amzn.to) até a página final.
export async function expandUrl(url, maxHops = 8) {
	let current = url
	for (let i = 0; i < maxHops; i++) {
		let res
		try {
			res = await fetch(current, {
				headers: { 'user-agent': UA },
				redirect: 'manual',
				signal: AbortSignal.timeout(10000)
			})
		} catch {
			return current
		}
		const location = res.headers.get('location')
		if (res.status >= 300 && res.status < 400 && location) {
			current = new URL(location, current).toString()
			continue
		}
		// Alguns encurtadores redirecionam por HTML/JS em vez de cabeçalho
		if (res.status === 200 && isShortener(current)) {
			const html = await res.text()
			const next = findRedirectInHtml(html)
			if (next && next !== current) {
				current = next
				continue
			}
		}
		return current
	}
	return current
}

function isShortener(url) {
	const host = new URL(url).hostname
	return ['meli.la', 'amzn.to', 'a.co', 'bit.ly', 'tinyurl.com'].some(h => host === h || host.endsWith('.' + h))
}

function findRedirectInHtml(html) {
	const meta = html.match(/http-equiv=["']refresh["'][^>]*url=([^"'>]+)/i)
	if (meta) return decodeHtml(meta[1])
	const js = html.match(/(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i)
	if (js) return decodeHtml(js[1])
	return null
}

const decodeHtml = s => s.replace(/&amp;/g, '&').replace(/\\u002F/gi, '/').replace(/\\\//g, '/')

// ---------- Mercado Livre ----------

const ML_ITEM_REGEX = /MLB-?(\d{6,})/i

export function mlItemId(url) {
	const m = url.match(ML_ITEM_REGEX)
	return m ? 'MLB' + m[1] : null
}

const isMlProductUrl = url => {
	const { hostname, pathname } = new URL(url)
	return hostMatches(hostname, ML_HOSTS) && ML_ITEM_REGEX.test(pathname)
}

// Página "social" (vitrine de outro afiliado): procura o link do produto dentro do HTML.
async function productFromSocialPage(url) {
	try {
		const { html } = await fetchText(url)
		const text = decodeHtml(html)
		const candidates = text.match(/https?:\/\/(?:www\.|produto\.|lista\.)?mercadolivre\.com\.br\/[^"'\s<>\\]*MLB-?\d{6,}[^"'\s<>\\]*/gi) || []
		const product = candidates.find(c => !c.includes('/social/'))
		if (product) return product
		const id = text.match(/MLB-?\d{6,}/i)
		if (id) return `https://www.mercadolivre.com.br/p/${id[0].replace('-', '')}`
	} catch {}
	return null
}

export async function convertMercadoLivre(url, { mattWord, mattTool }) {
	if (!mattWord || !mattTool) return { ok: false, reason: 'Tag do Mercado Livre não configurada' }
	let finalUrl = await expandUrl(url)
	if (!isMlProductUrl(finalUrl)) {
		const product = await productFromSocialPage(finalUrl)
		if (!product) return { ok: false, reason: 'Não encontrei o produto do Mercado Livre nesse link', finalUrl }
		finalUrl = product
	}
	const u = new URL(finalUrl)
	const clean = new URL(u.origin + u.pathname)
	clean.searchParams.set('matt_word', mattWord)
	clean.searchParams.set('matt_tool', mattTool)
	return { ok: true, url: clean.toString(), productId: mlItemId(finalUrl), finalUrl }
}

// ---------- Amazon ----------

const ASIN_REGEX = /\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin)\/([A-Z0-9]{10})/i

export async function convertAmazon(url, { tag }) {
	if (!tag) return { ok: false, reason: 'Tag da Amazon não configurada' }
	const finalUrl = await expandUrl(url)
	const m = finalUrl.match(ASIN_REGEX)
	if (!m) return { ok: false, reason: 'Não encontrei o produto da Amazon nesse link', finalUrl }
	const host = new URL(finalUrl).hostname.replace(/^(www\.)?/, 'www.')
	return { ok: true, url: `https://${host}/dp/${m[1].toUpperCase()}?tag=${encodeURIComponent(tag)}`, productId: 'AMZ' + m[1].toUpperCase(), finalUrl }
}

// ---------- Mensagem inteira ----------

export async function convertLink(url, config) {
	let market = marketplaceOf(url)
	let target = url
	if (!market) {
		// Encurtador desconhecido (bit.ly etc.): expande para ver se cai em ML/Amazon
		target = await expandUrl(url)
		market = marketplaceOf(target)
	}
	if (market === 'ml' && config.mercadoLivre.enabled) return { market, ...(await convertMercadoLivre(target, config.mercadoLivre)) }
	if (market === 'amazon' && config.amazon.enabled) return { market, ...(await convertAmazon(target, config.amazon)) }
	return { market, ok: false, reason: market ? 'Marketplace desativado' : 'Link não é de marketplace' }
}

// Retorna o texto com os links trocados, ou null se a mensagem não deve ser enviada.
export async function convertMessage(text, config) {
	const urls = extractUrls(text)
	let output = text
	const converted = []
	const failed = []

	for (const url of urls) {
		if (/chat\.whatsapp\.com|wa\.me|t\.me\//i.test(url)) {
			if (config.removeGroupInvites) output = removeLineWith(output, url)
			continue
		}
		const result = await convertLink(url, config)
		if (result.ok) {
			output = output.split(url).join(result.url)
			converted.push({ from: url, to: result.url, market: result.market, productId: result.productId })
		} else if (result.market) {
			failed.push({ url, reason: result.reason })
		}
	}

	if (config.footer?.trim()) output = output.trimEnd() + '\n\n' + config.footer.trim()
	const send = converted.length > 0 && failed.length === 0
	return { send, text: output.trim(), converted, failed }
}

function removeLineWith(text, url) {
	return text
		.split('\n')
		.filter(line => !line.includes(url))
		.join('\n')
}
