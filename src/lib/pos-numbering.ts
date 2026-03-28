import { Prisma } from '@prisma/client'

function formatPosNumber(prefix: string, seq: number) {
	return `${prefix}-${String(seq).padStart(6, '0')}`
}

export async function reserveNextPosInvoiceNumber(
	tx: Prisma.TransactionClient,
	args: { sedeId: string; prefix: string; maxAttempts?: number }
) {
	const maxAttempts = Math.max(1, args.maxAttempts ?? 50)

	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const seq = await tx.posSequence.upsert({
			where: { sedeId: args.sedeId },
			create: { sedeId: args.sedeId, nextInvoiceNumber: 2, nextReturnNumber: 1 },
			update: { nextInvoiceNumber: { increment: 1 } },
			select: { nextInvoiceNumber: true },
		})

		const numero = formatPosNumber(args.prefix, seq.nextInvoiceNumber - 1)
		const existing = await tx.posInvoice.findUnique({ where: { numero }, select: { id: true } })
		if (!existing) return numero
	}

	throw new Error('POS_INVOICE_NUMBER_EXHAUSTED')
}

export async function reserveNextPosReturnNumber(
	tx: Prisma.TransactionClient,
	args: { sedeId: string; prefix: string; maxAttempts?: number }
) {
	const maxAttempts = Math.max(1, args.maxAttempts ?? 50)

	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const seq = await tx.posSequence.upsert({
			where: { sedeId: args.sedeId },
			create: { sedeId: args.sedeId, nextInvoiceNumber: 1, nextReturnNumber: 2 },
			update: { nextReturnNumber: { increment: 1 } },
			select: { nextReturnNumber: true },
		})

		const numero = formatPosNumber(args.prefix, seq.nextReturnNumber - 1)
		const existing = await tx.posReturn.findUnique({ where: { numero }, select: { id: true } })
		if (!existing) return numero
	}

	throw new Error('POS_RETURN_NUMBER_EXHAUSTED')
}
