// Mensagem padrão: extrai os dados da oferta original e monta o texto no modelo configurado.

export const DEFAULT_TEMPLATE = `*{titulo}*

~De: R$ {preco_de}~
💰 *Por: R$ {preco}*

🎟️  Cupom: *{cupom}*

👀  Acesse a oferta pelo link abaixo:
{link}

⚠️ _Os preços podem sofrer variações sem aviso prévio._

🏋 _Compartilhe com os amigos! Conheça o nosso blog_ 👇
🔗 https://muscleperformancebr.com.br/`

const PRICE = String.raw`R\$\s*([\d.]+(?:,\d{1,2})?)`
const URL_REGEX = /https?:\/\/\S+/i

// Remove formatação do WhatsApp (*negrito*, _itálico_, ~riscado~) e emojis da ponta da linha
const cleanLine = line =>
	line
		.replace(/[*_~]/g, '')
		.replace(/^[^\p{L}\p{N}]+/u, '')
		.trim()

export function parseOffer(text) {
	const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

	const titleLine =
		lines.find(l => /^\*[^*]{8,}\*$/.test(l) && !/R\$|cupom|https?:/i.test(l)) ||
		lines.find(l => !/R\$|cupom|https?:|^[^\p{L}]*$/iu.test(l) && cleanLine(l).length >= 8)
	const titulo = titleLine ? cleanLine(titleLine) : ''

	const de = text.match(new RegExp(String.raw`\bde:?\s*~?\s*` + PRICE, 'i'))
	const por = text.match(new RegExp(String.raw`\bpor:?\s*\*?\s*` + PRICE, 'i'))
	const allPrices = [...text.matchAll(new RegExp(PRICE, 'gi'))].map(m => m[1])

	let preco = por?.[1] || ''
	let preco_de = de?.[1] || ''
	if (!preco && allPrices.length) preco = allPrices[allPrices.length - 1]
	if (!preco_de && allPrices.length > 1 && allPrices[0] !== preco) preco_de = allPrices[0]

	const cupomMatch = text.match(/cupom:?\s*[*_~]*\s*([A-Z0-9][A-Z0-9_-]{2,})/i)
	const cupom = cupomMatch ? cupomMatch[1] : ''

	return { titulo, preco_de, preco, cupom }
}

// Linhas com um campo vazio (ex.: oferta sem cupom) somem da mensagem
export function renderTemplate(template, fields) {
	return template
		.split('\n')
		.filter(line => {
			const keys = [...line.matchAll(/\{(\w+)\}/g)].map(m => m[1])
			return keys.every(k => fields[k])
		})
		.map(line => line.replace(/\{(\w+)\}/g, (_, k) => fields[k]))
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim()
}

export function applyTemplate(original, link, template) {
	const fields = { ...parseOffer(original), link }
	if (!fields.titulo || !fields.preco || URL_REGEX.test(fields.titulo)) return null
	return renderTemplate(template || DEFAULT_TEMPLATE, fields)
}
