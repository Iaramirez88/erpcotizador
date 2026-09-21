import { RestaurantProductRole, RestauranteTurnoStatus, type Prisma } from '@prisma/client'
import { sanitizeRestaurantBoard } from '@/lib/restaurante'

export async function syncRestaurantRecipeCosts(
  tx: Prisma.TransactionClient,
  empresaId: string,
  board: ReturnType<typeof sanitizeRestaurantBoard>,
) {
  const linkedRecipes = board.recipes.filter((recipe) => recipe.materialId)
  if (!linkedRecipes.length) return

  const materialIds = Array.from(new Set(linkedRecipes.flatMap((recipe) => [
    recipe.materialId!,
    ...recipe.components.map((component) => component.materialId),
  ])))
  const materials = await tx.material.findMany({
    where: { empresaId, id: { in: materialIds } },
    select: { id: true, restaurantRole: true, precioCompra: true },
  })
  const materialsById = new Map(materials.map((material) => [material.id, material]))

  for (const recipe of linkedRecipes) {
    const output = materialsById.get(recipe.materialId!)
    if (output?.restaurantRole !== RestaurantProductRole.PREPARATION) throw new Error('INVALID_RECIPE_OUTPUT')

    let totalCost = 0
    for (const component of recipe.components) {
      const ingredient = materialsById.get(component.materialId)
      if (ingredient?.restaurantRole !== RestaurantProductRole.INGREDIENT) throw new Error('INVALID_RECIPE_COMPONENT')
      totalCost += (ingredient.precioCompra ?? 0) * component.quantity
    }

    await tx.material.update({
      where: { id: output.id },
      data: { precioCompra: totalCost / Math.max(recipe.yieldCount, 1) },
    })
  }
}

export async function syncLatestRestaurantIngredientCosts(
  tx: Prisma.TransactionClient,
  empresaId: string,
  materialIds: string[],
) {
  const uniqueIds = Array.from(new Set(materialIds.filter(Boolean)))
  for (const materialId of uniqueIds) {
    const latestPurchase = await tx.compra.findFirst({
      where: {
        empresaId,
        estado: 'REGISTRADA',
        items: { some: { materialId } },
      },
      orderBy: [{ fechaCompra: 'desc' }, { updatedAt: 'desc' }],
      select: {
        items: {
          where: { materialId },
          orderBy: { orden: 'desc' },
          take: 1,
          select: { cantidad: true, subtotalSinIva: true, precioUnitario: true, descuento: true },
        },
      },
    })
    const item = latestPurchase?.items[0]
    if (!item) continue
    const quantity = Math.max(item.cantidad, 0.000001)
    const netSubtotal = item.subtotalSinIva > 0
      ? item.subtotalSinIva
      : Math.max(0, item.cantidad * item.precioUnitario - item.descuento)
    await tx.material.updateMany({
      where: { id: materialId, empresaId, restaurantRole: RestaurantProductRole.INGREDIENT },
      data: { precioCompra: netSubtotal / quantity },
    })
  }

  const currentTurno = await tx.restauranteTurno.findFirst({
    where: { empresaId, status: RestauranteTurnoStatus.ABIERTO },
    orderBy: { updatedAt: 'desc' },
    select: { boardData: true },
  })
  if (currentTurno) await syncRestaurantRecipeCosts(tx, empresaId, sanitizeRestaurantBoard(currentTurno.boardData))
}
