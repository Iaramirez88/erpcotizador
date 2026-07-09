'use client'

import { BookOpen, FileText, FoldVertical, Package2, Sparkles, Ticket } from 'lucide-react'
import type { LitografiaVisualProduct } from '@/lib/litografia-visual-products'
import { cn } from '@/lib/utils'

type Props = {
  product: LitografiaVisualProduct
  selected?: boolean
  mode?: 'card' | 'hero'
  className?: string
}

type VisualKind = 'simple' | 'folded' | 'brochure' | 'card' | 'folder' | 'booklet'

function getVisualKind(product: LitografiaVisualProduct): VisualKind {
  const source = `${product.id} ${product.title} ${product.description}`.toLowerCase()
  if (source.includes('carpeta') || source.includes('sobre')) return 'folder'
  if (source.includes('encuadern') || source.includes('booklet')) return 'booklet'
  if (source.includes('tripti') || source.includes('triptico') || source.includes('dipt')) return 'brochure'
  if (source.includes('cuadript')) return 'folded'
  if (source.includes('tarjeta') || source.includes('postal') || source.includes('invitacion')) return 'card'
  return 'simple'
}

function getPalette(product: LitografiaVisualProduct, selected: boolean) {
  const source = `${product.id} ${product.title}`.toLowerCase()
  if (source.includes('carta') || source.includes('menu')) {
    return selected
      ? ['from-sky-500', 'via-cyan-400', 'to-teal-300']
      : ['from-sky-200', 'via-cyan-100', 'to-teal-100']
  }
  if (source.includes('flyer') || source.includes('brochure')) {
    return selected
      ? ['from-amber-500', 'via-orange-400', 'to-rose-300']
      : ['from-amber-200', 'via-orange-100', 'to-rose-100']
  }
  if (source.includes('tarjeta') || source.includes('postal')) {
    return selected
      ? ['from-emerald-500', 'via-lime-400', 'to-yellow-300']
      : ['from-emerald-200', 'via-lime-100', 'to-yellow-100']
  }
  if (source.includes('carpeta') || source.includes('sobre')) {
    return selected
      ? ['from-fuchsia-500', 'via-pink-400', 'to-amber-300']
      : ['from-fuchsia-200', 'via-pink-100', 'to-amber-100']
  }
  return selected
    ? ['from-slate-700', 'via-slate-500', 'to-slate-300']
    : ['from-slate-200', 'via-slate-100', 'to-white']
}

function getIcon(product: LitografiaVisualProduct) {
  const kind = getVisualKind(product)
  switch (kind) {
    case 'brochure':
      return FoldVertical
    case 'card':
      return Ticket
    case 'folder':
      return Package2
    case 'booklet':
      return BookOpen
    case 'simple':
      return FileText
    default:
      return Sparkles
  }
}

export function LitografiaProductVisual({ product, selected = false, mode = 'card', className }: Props) {
  const Icon = getIcon(product)
  const kind = getVisualKind(product)
  const [from, via, to] = getPalette(product, selected)
  const compact = mode === 'card'
  const imageUrl = String(product.imageUrl || '').trim()

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-white/60 bg-white shadow-sm',
        compact ? 'h-24' : 'h-40',
        className,
      )}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-95', from, via, to)} />
      <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.85),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.45),transparent_34%)]' />
      <div className='absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/60 to-transparent' />

      <div className={cn('absolute right-3 top-3 z-10 rounded-full border border-white/80 bg-white/75 p-1.5 text-slate-700 backdrop-blur', compact ? 'scale-90' : '')}>
        <Icon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </div>

      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt={product.title}
            className='absolute inset-0 h-full w-full object-cover'
          />
          <div className='absolute inset-0 bg-gradient-to-t from-slate-950/30 via-slate-900/5 to-white/10' />
        </>
      ) : null}

      {!imageUrl && kind === 'simple' ? (
        <>
          <div className={cn('absolute left-[18%] top-[18%] rounded-lg border border-slate-300/80 bg-white/90 shadow-[0_12px_22px_-16px_rgba(15,23,42,0.8)]', compact ? 'h-14 w-12' : 'h-24 w-20')} />
          <div className={cn('absolute left-[22%] top-[24%] rounded bg-slate-200/80', compact ? 'h-1.5 w-7' : 'h-2 w-12')} />
          <div className={cn('absolute left-[22%] rounded bg-slate-300/70', compact ? 'top-[34%] h-1 w-10' : 'top-[37%] h-1.5 w-14')} />
          <div className={cn('absolute left-[22%] rounded bg-slate-300/70', compact ? 'top-[42%] h-1 w-8' : 'top-[46%] h-1.5 w-12')} />
          <div className={cn('absolute left-[22%] rounded bg-slate-300/70', compact ? 'top-[50%] h-1 w-9' : 'top-[55%] h-1.5 w-11')} />
        </>
      ) : null}

      {!imageUrl && kind === 'card' ? (
        <>
          <div className={cn('absolute left-[16%] top-[26%] rotate-[-8deg] rounded-lg border border-slate-300/80 bg-white/95 shadow-[0_18px_24px_-18px_rgba(15,23,42,0.8)]', compact ? 'h-10 w-16' : 'h-16 w-24')} />
          <div className={cn('absolute left-[24%] top-[20%] rotate-[10deg] rounded-lg border border-slate-300/80 bg-white/90 shadow-[0_18px_24px_-18px_rgba(15,23,42,0.8)]', compact ? 'h-10 w-16' : 'h-16 w-24')} />
          <div className={cn('absolute rounded-full bg-emerald-300/80', compact ? 'left-[22%] top-[34%] h-2 w-2' : 'left-[26%] top-[32%] h-3 w-3')} />
          <div className={cn('absolute rounded bg-slate-300/70', compact ? 'left-[28%] top-[35%] h-1 w-8' : 'left-[32%] top-[34%] h-1.5 w-12')} />
          <div className={cn('absolute rounded bg-slate-200/80', compact ? 'left-[28%] top-[43%] h-1 w-6' : 'left-[32%] top-[44%] h-1.5 w-10')} />
        </>
      ) : null}

      {!imageUrl && kind === 'brochure' ? (
        <>
          <div className={cn('absolute left-[18%] top-[18%] rounded-lg border border-slate-300/80 bg-white/95 shadow-[0_18px_24px_-18px_rgba(15,23,42,0.8)]', compact ? 'h-14 w-16' : 'h-24 w-28')} />
          <div className={cn('absolute border-l border-dashed border-slate-300/80', compact ? 'left-[31%] top-[18%] h-14' : 'left-[35%] top-[18%] h-24')} />
          <div className={cn('absolute border-l border-dashed border-slate-300/80', compact ? 'left-[40%] top-[18%] h-14' : 'left-[47%] top-[18%] h-24')} />
          <div className={cn('absolute rounded bg-rose-300/80', compact ? 'left-[22%] top-[26%] h-2 w-8' : 'left-[23%] top-[26%] h-3 w-14')} />
          <div className={cn('absolute rounded bg-slate-300/70', compact ? 'left-[22%] top-[36%] h-1 w-5' : 'left-[23%] top-[40%] h-1.5 w-10')} />
          <div className={cn('absolute rounded bg-slate-300/70', compact ? 'left-[34%] top-[36%] h-1 w-5' : 'left-[39%] top-[40%] h-1.5 w-10')} />
          <div className={cn('absolute rounded bg-slate-300/70', compact ? 'left-[45%] top-[36%] h-1 w-5' : 'left-[54%] top-[40%] h-1.5 w-10')} />
        </>
      ) : null}

      {!imageUrl && kind === 'folded' ? (
        <>
          <div className={cn('absolute left-[20%] top-[20%] rounded-lg border border-slate-300/80 bg-white/95 shadow-[0_18px_24px_-18px_rgba(15,23,42,0.8)]', compact ? 'h-14 w-18' : 'h-24 w-32')} />
          <div className={cn('absolute rounded-lg border border-slate-300/80 bg-white/80', compact ? 'left-[35%] top-[24%] h-12 w-12' : 'left-[43%] top-[26%] h-20 w-20')} />
          <div className={cn('absolute rounded bg-amber-300/80', compact ? 'left-[24%] top-[30%] h-2 w-8' : 'left-[25%] top-[32%] h-3 w-16')} />
          <div className={cn('absolute rounded bg-slate-300/70', compact ? 'left-[24%] top-[40%] h-1 w-10' : 'left-[25%] top-[44%] h-1.5 w-18')} />
        </>
      ) : null}

      {!imageUrl && kind === 'folder' ? (
        <>
          <div className={cn('absolute left-[17%] top-[22%] rounded-xl border border-slate-300/80 bg-white/95 shadow-[0_18px_24px_-18px_rgba(15,23,42,0.8)]', compact ? 'h-12 w-18' : 'h-20 w-28')} />
          <div className={cn('absolute rounded-b-xl border border-slate-300/80 bg-white/80', compact ? 'left-[27%] top-[44%] h-8 w-12' : 'left-[31%] top-[46%] h-12 w-16')} />
          <div className={cn('absolute rounded bg-fuchsia-300/80', compact ? 'left-[21%] top-[29%] h-2 w-8' : 'left-[22%] top-[30%] h-3 w-14')} />
          <div className={cn('absolute rounded bg-slate-300/70', compact ? 'left-[21%] top-[39%] h-1 w-9' : 'left-[22%] top-[42%] h-1.5 w-12')} />
        </>
      ) : null}

      {!imageUrl && kind === 'booklet' ? (
        <>
          <div className={cn('absolute left-[16%] top-[18%] rounded-l-xl rounded-r-md border border-slate-300/80 bg-white/95 shadow-[0_18px_24px_-18px_rgba(15,23,42,0.8)]', compact ? 'h-15 w-12' : 'h-26 w-20')} />
          <div className={cn('absolute left-[31%] top-[18%] rounded-l-md rounded-r-xl border border-slate-300/80 bg-white/90 shadow-[0_18px_24px_-18px_rgba(15,23,42,0.6)]', compact ? 'h-15 w-12' : 'h-26 w-20')} />
          <div className={cn('absolute rounded bg-sky-300/80', compact ? 'left-[19%] top-[29%] h-2 w-6' : 'left-[20%] top-[28%] h-3 w-10')} />
          <div className={cn('absolute rounded bg-slate-300/70', compact ? 'left-[19%] top-[40%] h-1 w-8' : 'left-[20%] top-[42%] h-1.5 w-12')} />
          <div className={cn('absolute rounded bg-slate-300/70', compact ? 'left-[34%] top-[32%] h-1 w-7' : 'left-[35%] top-[34%] h-1.5 w-10')} />
          <div className={cn('absolute rounded bg-slate-200/80', compact ? 'left-[34%] top-[42%] h-1 w-8' : 'left-[35%] top-[44%] h-1.5 w-12')} />
        </>
      ) : null}

      <div className='absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-900/20 to-transparent' />
    </div>
  )
}