// Testes da mensagem padrão.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_TEMPLATE, applyTemplate, parseOffer } from '../src/template.js'

const OFERTA = `*RESVERATROL 100% PURO - Fórmula Exclusiva com Máxima Concentração e Biodisponibilidade - 30 Doses*

~De: R$ 88,77~
💰 *Por: R$ 38,34*

🎟️  Cupom: *MEUVALE*

👀  Acesse a oferta  pelo  link abaixo:
https://redirect.popbot.com.br/db47b98

⚠️ _Os preços podem sofrer variações sem aviso prévio._

🏋 _Compartilhe com os amigos! Link do grupo_ 👇
🔗 https://marombot.com.br/grupos`

const LINK = 'https://produto.mercadolivre.com.br/MLB-123456789?matt_word=anfe5611342&matt_tool=27164927'

test('extrai título, preços e cupom', () => {
	assert.deepEqual(parseOffer(OFERTA), {
		titulo: 'RESVERATROL 100% PURO - Fórmula Exclusiva com Máxima Concentração e Biodisponibilidade - 30 Doses',
		preco_de: '88,77',
		preco: '38,34',
		cupom: 'MEUVALE'
	})
})

test('monta a mensagem padrão com o meu link e sem o link do outro grupo', () => {
	const text = applyTemplate(OFERTA, LINK, DEFAULT_TEMPLATE)
	assert.ok(text.startsWith('*RESVERATROL 100% PURO'))
	assert.ok(text.includes('~De: R$ 88,77~'))
	assert.ok(text.includes('💰 *Por: R$ 38,34*'))
	assert.ok(text.includes('Cupom: *MEUVALE*'))
	assert.ok(text.includes(LINK))
	assert.ok(text.includes('https://muscleperformancebr.com.br/'))
	assert.ok(!text.includes('marombot') && !text.includes('popbot'))
})

test('oferta sem cupom e sem preço antigo some com essas linhas', () => {
	const text = applyTemplate('🔥 Creatina Monohidratada 1kg Max Titanium\nApenas R$ 79,90\nhttps://x.co/a', LINK, DEFAULT_TEMPLATE)
	assert.ok(text.startsWith('*Creatina Monohidratada 1kg Max Titanium*'))
	assert.ok(text.includes('Por: R$ 79,90'))
	assert.ok(!text.includes('Cupom') && !text.includes('De:'))
})

test('sem título ou preço reconhecível, não usa o modelo', () => {
	assert.equal(applyTemplate('olha isso\nhttps://x.co/a', LINK, DEFAULT_TEMPLATE), null)
})
