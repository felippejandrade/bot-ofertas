// Configuração e histórico salvos em arquivos JSON dentro da pasta data/.
import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_TEMPLATE } from './template.js'

export const DATA_DIR = process.env.DATA_DIR || path.resolve('data')
fs.mkdirSync(DATA_DIR, { recursive: true })

const CONFIG_FILE = path.join(DATA_DIR, 'config.json')
const HISTORY_FILE = path.join(DATA_DIR, 'history.json')

const DEFAULT_CONFIG = {
	enabled: false,
	sourceGroups: [], // até 2 grupos de origem: [{ id, name }]
	targetGroup: null, // { id, name }
	mercadoLivre: { enabled: true, mattWord: '', mattTool: '' },
	amazon: { enabled: false, tag: '' },
	delaySeconds: 30, // intervalo mínimo entre envios
	dedupHours: 12, // não repete o mesmo produto dentro desse período
	removeGroupInvites: true,
	footer: '', // usado só quando a mensagem padrão está desligada ou não se aplica
	template: { enabled: true, text: DEFAULT_TEMPLATE }
}

const MAX_SOURCE_GROUPS = 2
const MAX_HISTORY = 300

function readJson(file, fallback) {
	try {
		return JSON.parse(fs.readFileSync(file, 'utf8'))
	} catch {
		return fallback
	}
}

function writeJson(file, value) {
	const tmp = file + '.tmp'
	fs.writeFileSync(tmp, JSON.stringify(value, null, 2))
	fs.renameSync(tmp, file)
}

let config = mergeConfig(DEFAULT_CONFIG, readJson(CONFIG_FILE, {}))
let history = readJson(HISTORY_FILE, [])

function mergeConfig(base, patch) {
	return {
		...base,
		...patch,
		mercadoLivre: { ...base.mercadoLivre, ...patch.mercadoLivre },
		amazon: { ...base.amazon, ...patch.amazon },
		template: { ...base.template, ...patch.template }
	}
}

export const getConfig = () => config

export function updateConfig(patch) {
	const next = mergeConfig(config, patch)
	next.sourceGroups = (next.sourceGroups || []).slice(0, MAX_SOURCE_GROUPS)
	next.delaySeconds = Math.max(5, Number(next.delaySeconds) || DEFAULT_CONFIG.delaySeconds)
	next.dedupHours = Math.max(0, Number(next.dedupHours) || 0)
	next.mercadoLivre.mattWord = String(next.mercadoLivre.mattWord || '').trim()
	next.mercadoLivre.mattTool = String(next.mercadoLivre.mattTool || '').trim()
	next.amazon.tag = String(next.amazon.tag || '').trim()
	if (!String(next.template.text || '').trim()) next.template.text = DEFAULT_TEMPLATE
	config = next
	writeJson(CONFIG_FILE, config)
	return config
}

export const getHistory = () => history

export function addHistory(entry) {
	history = [{ at: new Date().toISOString(), ...entry }, ...history].slice(0, MAX_HISTORY)
	writeJson(HISTORY_FILE, history)
}

export function recentlySent(productIds, hours) {
	if (!hours || !productIds.length) return false
	const since = Date.now() - hours * 3600 * 1000
	return history.some(
		h => h.status === 'enviado' && new Date(h.at).getTime() > since && h.productIds?.some(id => productIds.includes(id))
	)
}
