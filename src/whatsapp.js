// Conexão com o WhatsApp (Baileys), leitura dos grupos de origem e envio para o grupo de destino.
import fs from 'node:fs'
import path from 'node:path'
import makeWASocket, {
	Browsers,
	DisconnectReason,
	downloadMediaMessage,
	fetchLatestBaileysVersion,
	useMultiFileAuthState
} from '@whiskeysockets/baileys'
import pino from 'pino'
import QRCode from 'qrcode'
import { convertMessage } from './links.js'
import { DATA_DIR, addHistory, getConfig, recentlySent } from './store.js'

const AUTH_DIR = path.join(DATA_DIR, 'auth')
const logger = pino({ level: process.env.LOG_LEVEL || 'warn' })

const state = {
	status: 'desconectado', // desconectado | aguardando_qr | conectando | conectado
	qr: null,
	me: null,
	groups: []
}

let sock = null
let reconnectTimer = null

export const getState = () => state

export async function connect() {
	clearTimeout(reconnectTimer)
	const { state: auth, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
	const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }))

	state.status = 'conectando'
	sock = makeWASocket({
		version,
		auth,
		logger,
		browser: Browsers.ubuntu('Bot Ofertas'),
		markOnlineOnConnect: false,
		syncFullHistory: false
	})

	sock.ev.on('creds.update', saveCreds)

	sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
		if (qr) {
			state.status = 'aguardando_qr'
			state.qr = await QRCode.toDataURL(qr)
		}
		if (connection === 'open') {
			state.status = 'conectado'
			state.qr = null
			state.me = sock.user
			await refreshGroups().catch(err => logger.error(err, 'erro ao listar grupos'))
		}
		if (connection === 'close') {
			const code = lastDisconnect?.error?.output?.statusCode
			state.status = 'desconectado'
			state.me = null
			if (code === DisconnectReason.loggedOut) {
				// Sessão encerrada pelo celular: apaga a sessão e gera um QR novo
				fs.rmSync(AUTH_DIR, { recursive: true, force: true })
			}
			reconnectTimer = setTimeout(() => connect().catch(err => logger.error(err)), 3000)
		}
	})

	sock.ev.on('messages.upsert', ({ messages, type }) => {
		if (type !== 'notify') return
		for (const msg of messages) handleIncoming(msg).catch(err => logger.error(err, 'erro ao processar mensagem'))
	})
}

// O evento de desconexão (loggedOut) apaga a sessão e gera um QR novo
export async function logout() {
	await sock?.logout().catch(() => {})
}

export async function refreshGroups() {
	if (!sock || state.status !== 'conectado') return state.groups
	const groups = await sock.groupFetchAllParticipating()
	state.groups = Object.values(groups)
		.map(g => ({ id: g.id, name: g.subject, size: g.participants?.length || 0 }))
		.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
	return state.groups
}

// ---------- Processamento das ofertas ----------

function messageContent(msg) {
	let m = msg.message
	if (!m) return {}
	m = m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message || m
	if (m.conversation) return { text: m.conversation }
	if (m.extendedTextMessage) return { text: m.extendedTextMessage.text || '' }
	if (m.imageMessage) return { text: m.imageMessage.caption || '', image: true, inner: m }
	if (m.videoMessage) return { text: m.videoMessage.caption || '' }
	return {}
}

async function handleIncoming(msg) {
	const config = getConfig()
	const groupId = msg.key.remoteJid
	if (!config.enabled || !config.targetGroup || msg.key.fromMe) return
	const source = config.sourceGroups.find(g => g.id === groupId)
	if (!source) return

	const { text, image, inner } = messageContent(msg)
	if (!text) return

	const result = await convertMessage(text, config)
	const productIds = result.converted.map(c => c.productId).filter(Boolean)
	const base = { source: source.name, original: text, text: result.text, converted: result.converted, failed: result.failed, productIds }

	if (!result.send) {
		if (result.converted.length || result.failed.length) addHistory({ ...base, status: 'ignorado', reason: result.failed[0]?.reason || 'Sem link convertido' })
		return
	}
	if (recentlySent(productIds, config.dedupHours) || productIds.some(id => queuedIds.has(id))) {
		addHistory({ ...base, status: 'ignorado', reason: 'Produto já enviado recentemente' })
		return
	}

	let imageBuffer = null
	if (image) {
		imageBuffer = await downloadMediaMessage({ ...msg, message: inner }, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage }).catch(() => null)
	}
	enqueue({ text: result.text, imageBuffer, productIds, base })
}

// Fila com intervalo mínimo entre envios, para não parecer spam ao WhatsApp
const queue = []
const queuedIds = new Set()
let sending = false
let lastSentAt = 0

function enqueue(item) {
	item.productIds.forEach(id => queuedIds.add(id))
	queue.push(item)
	processQueue()
}

async function processQueue() {
	if (sending) return
	sending = true
	try {
		while (queue.length) {
			const config = getConfig()
			const wait = lastSentAt + config.delaySeconds * 1000 + Math.random() * 5000 - Date.now()
			if (wait > 0) await new Promise(r => setTimeout(r, wait))
			const item = queue.shift()
			try {
				await sendToTarget(item.text, item.imageBuffer)
				addHistory({ ...item.base, status: 'enviado' })
			} catch (err) {
				addHistory({ ...item.base, status: 'erro', reason: err.message })
			}
			item.productIds.forEach(id => queuedIds.delete(id))
			lastSentAt = Date.now()
		}
	} finally {
		sending = false
	}
}

export async function sendToTarget(text, imageBuffer) {
	const config = getConfig()
	if (!sock || state.status !== 'conectado') throw new Error('WhatsApp desconectado')
	if (!config.targetGroup) throw new Error('Grupo de destino não configurado')
	const content = imageBuffer ? { image: imageBuffer, caption: text } : { text }
	await sock.sendMessage(config.targetGroup.id, content)
}
