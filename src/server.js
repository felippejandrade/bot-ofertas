// Painel web: login por senha, conexão via QR, escolha dos grupos e configurações.
import crypto from 'node:crypto'
import path from 'node:path'
import express from 'express'
import { convertLink, convertMessage } from './links.js'
import { getConfig, getHistory, updateConfig } from './store.js'
import { connect, getState, logout, refreshGroups, sendToTarget } from './whatsapp.js'

const PORT = Number(process.env.PORT) || 3000
const PASSWORD = process.env.PAINEL_SENHA

if (!PASSWORD) {
	console.error('Defina a variável PAINEL_SENHA (senha do painel) antes de iniciar.')
	process.exit(1)
}

const TOKEN = crypto.createHmac('sha256', PASSWORD).update('bot-ofertas').digest('hex')
const app = express()
app.use(express.json({ limit: '200kb' }))

const readCookie = (req, name) =>
	(req.headers.cookie || '')
		.split(';')
		.map(c => c.trim().split('='))
		.find(([k]) => k === name)?.[1]

app.post('/api/login', (req, res) => {
	const given = String(req.body?.senha || '')
	const ok = given.length === PASSWORD.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(PASSWORD))
	if (!ok) return res.status(401).json({ erro: 'Senha incorreta' })
	res.setHeader('Set-Cookie', `painel=${TOKEN}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${60 * 60 * 24 * 30}`)
	res.json({ ok: true })
})

app.use('/api', (req, res, next) => {
	if (readCookie(req, 'painel') !== TOKEN) return res.status(401).json({ erro: 'Faça login' })
	next()
})

app.get('/api/status', (req, res) => {
	const { status, qr, me } = getState()
	res.json({ status, qr, numero: me?.id?.split(':')[0]?.split('@')[0] || null })
})

app.get('/api/groups', async (req, res) => {
	res.json(await refreshGroups().catch(() => getState().groups))
})

app.get('/api/config', (req, res) => res.json(getConfig()))

app.post('/api/config', (req, res) => {
	const body = req.body || {}
	if (body.sourceGroups?.length > 2) return res.status(400).json({ erro: 'Escolha no máximo 2 grupos de origem' })
	if (body.targetGroup && body.sourceGroups?.some(g => g.id === body.targetGroup.id))
		return res.status(400).json({ erro: 'O grupo de destino não pode ser também um grupo de origem' })
	res.json(updateConfig(body))
})

app.get('/api/history', (req, res) => res.json(getHistory().slice(0, 100)))

// Testa a conversão sem enviar nada
app.post('/api/test', async (req, res) => {
	const text = String(req.body?.texto || '')
	const config = getConfig()
	if (/^\s*https?:\/\/\S+\s*$/.test(text)) return res.json({ link: await convertLink(text.trim(), config) })
	res.json({ mensagem: await convertMessage(text, config) })
})

// Envia uma mensagem de teste ao grupo de destino
app.post('/api/send-test', async (req, res) => {
	try {
		await sendToTarget(String(req.body?.texto || 'Teste do bot de ofertas ✅'))
		res.json({ ok: true })
	} catch (err) {
		res.status(400).json({ erro: err.message })
	}
})

app.post('/api/logout', async (req, res) => {
	await logout()
	res.json({ ok: true })
})

app.use(express.static(path.resolve('public')))

app.listen(PORT, () => console.log(`Painel em http://localhost:${PORT}`))
connect().catch(err => console.error('Falha ao conectar no WhatsApp:', err))
