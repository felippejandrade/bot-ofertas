// Link curto oficial (meli.la) gerado pelo Programa de Afiliados, usando a sessão do Mercado Livre do afiliado.
// Não existe API pública: o bot faz o mesmo pedido que o "Gerador de links" do site faz.
import fs from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from './store.js'

const COOKIES_FILE = path.join(DATA_DIR, 'ml-cookies.json')
const PROFILE_DIR = path.join(DATA_DIR, 'ml-navegador')
const CREATE_LINK_URL = 'https://www.mercadolivre.com.br/affiliate-program/api/v2/stripe/user/links'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const LOGIN_COOKIES = ['ssid', 'orguserid']
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000

const CHROME_PATHS = [
	process.env.CHROME_PATH,
	'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
	'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
	process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'),
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	'/usr/bin/google-chrome',
	'/usr/bin/chromium-browser',
	'/usr/bin/chromium'
].filter(Boolean)

let cookies = readCookies()
let session = { status: cookies.length ? 'conectado' : 'desconectado', erro: null }

function readCookies() {
	try {
		return JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'))
	} catch {
		return []
	}
}

function saveCookies(list) {
	cookies = list.filter(c => /mercadoli(vre|bre)\.com/.test(c.domain || '')).map(({ name, value, domain }) => ({ name, value, domain }))
	fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2))
	fs.chmodSync(COOKIES_FILE, 0o600)
}

export const getMeliSession = () => session

// Usado nos testes
export function useMeliCookies(list) {
	cookies = list
}

export function disconnectMeli() {
	cookies = []
	fs.rmSync(COOKIES_FILE, { force: true })
	session = { status: 'desconectado', erro: null }
}

// Abre o Chrome numa janela própria para o afiliado fazer login; guarda os cookies quando o login é detectado.
export async function connectMeli() {
	if (session.status === 'aguardando_login') return
	const executablePath = CHROME_PATHS.find(p => fs.existsSync(p))
	if (!executablePath) {
		session = { status: 'desconectado', erro: 'Não encontrei o Google Chrome neste computador' }
		return
	}
	session = { status: 'aguardando_login', erro: null }
	const { default: puppeteer } = await import('puppeteer-core')
	const browser = await puppeteer.launch({ executablePath, headless: false, userDataDir: PROFILE_DIR, defaultViewport: null, args: ['--start-maximized'] })
	try {
		const page = (await browser.pages())[0] || (await browser.newPage())
		await page.goto('https://www.mercadolivre.com.br/afiliados', { waitUntil: 'domcontentloaded' }).catch(() => {})
		const deadline = Date.now() + LOGIN_TIMEOUT_MS
		while (Date.now() < deadline) {
			const all = await browser.cookies().catch(() => [])
			if (LOGIN_COOKIES.every(name => all.some(c => c.name === name && /mercadolivre/.test(c.domain)))) {
				saveCookies(all)
				session = { status: 'conectado', erro: null }
				return
			}
			await new Promise(r => setTimeout(r, 2000))
		}
		session = { status: 'desconectado', erro: 'Tempo esgotado esperando o login (5 min)' }
	} catch (err) {
		session = { status: 'desconectado', erro: err.message }
	} finally {
		await browser.close().catch(() => {})
	}
}

const cookieHeader = () => cookies.map(c => `${c.name}=${c.value}`).join('; ')

async function csrfToken(productUrl) {
	const fallback = cookies.find(c => c.name === '_csrf')?.value || ''
	try {
		const res = await fetch(productUrl, { headers: { cookie: cookieHeader(), 'user-agent': UA }, signal: AbortSignal.timeout(10000) })
		const html = await res.text()
		const m = html.match(/csrfToken[^"]*"([^"]+)"/) || html.match(/name="csrf-token"\s+content="([^"]+)"/)
		return m?.[1] || fallback
	} catch {
		return fallback
	}
}

// Retorna o meli.la ou null (sem sessão, sessão expirada ou mudança no site); quem chama usa o link grande nesse caso.
export async function createShortLink(productUrl, tag) {
	if (!cookies.length) return null
	try {
		const res = await fetch(CREATE_LINK_URL, {
			method: 'POST',
			headers: {
				accept: 'application/json, text/plain, */*',
				'content-type': 'application/json',
				'x-csrf-token': await csrfToken(productUrl),
				cookie: cookieHeader(),
				referer: productUrl,
				origin: 'https://produto.mercadolivre.com.br',
				'user-agent': UA
			},
			body: JSON.stringify({ url: productUrl, tag }),
			signal: AbortSignal.timeout(15000)
		})
		const data = await res.json().catch(() => ({}))
		if (!res.ok || !data.short_url) {
			if (res.status === 401 || res.status === 403) session = { status: 'expirado', erro: 'Sessão do Mercado Livre expirou. Conecte de novo.' }
			else session = { ...session, erro: `Mercado Livre respondeu ${res.status} ao gerar link curto` }
			return null
		}
		session = { status: 'conectado', erro: null }
		return data.short_url
	} catch (err) {
		session = { ...session, erro: `Falha ao gerar link curto: ${err.message}` }
		return null
	}
}
