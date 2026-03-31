import { useMemo, useState } from 'react'

export type PosCartProduct = {
  id: string
  code: string
  name: string
  unit: string
  unitPrice: number
  stock: number
}

export type PosCartLine = PosCartProduct & {
  quantity: number
  total: number
}

export function usePosCart() {
  const [items, setItems] = useState<PosCartLine[]>([])

  const summary = useMemo(() => {
    const total = items.reduce((acc, item) => acc + item.total, 0)
    const quantity = items.reduce((acc, item) => acc + item.quantity, 0)
    return {
      items,
      total,
      quantity,
      uniqueItems: items.length,
      isEmpty: items.length === 0,
    }
  }, [items])

  function addProduct(product: PosCartProduct, quantity = 1) {
    const nextQuantity = Math.max(1, Number(quantity) || 1)

    setItems((current) => {
      const existing = current.find((item) => item.id === product.id)
      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + nextQuantity,
                total: (item.quantity + nextQuantity) * item.unitPrice,
              }
            : item,
        )
      }

      return [
        {
          ...product,
          quantity: nextQuantity,
          total: nextQuantity * product.unitPrice,
        },
        ...current,
      ]
    })
  }

  function setQuantity(productId: string, quantity: number) {
    const safeQuantity = Math.max(1, Number(quantity) || 1)
    setItems((current) =>
      current.map((item) =>
        item.id === productId
          ? {
              ...item,
              quantity: safeQuantity,
              total: safeQuantity * item.unitPrice,
            }
          : item,
      ),
    )
  }

  function removeProduct(productId: string) {
    setItems((current) => current.filter((item) => item.id !== productId))
  }

  function clearCart() {
    setItems([])
  }

  return {
    ...summary,
    addProduct,
    setQuantity,
    removeProduct,
    clearCart,
  }
}