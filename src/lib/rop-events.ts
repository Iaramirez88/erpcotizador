import { EventEmitter } from 'node:events'
import type { RopRiskLevel } from '@prisma/client'

type RopEventsState = {
  emitter: EventEmitter
}

const ROP_EVENTS_KEY = '__sgd_rop_events__'
const TRUST_RECOMPUTED_EVENT = 'rop.trust_score_recomputed'

export type RopTrustScoreRecomputedEvent = {
  eventType: typeof TRUST_RECOMPUTED_EVENT
  companyId: string
  empresaId: string | null
  reason: 'WORK_ORDER_CLOSED' | 'RATING_UPDATED' | 'RATING_DISPUTED' | 'RATING_MODERATED'
  sourceRef: string
  overallScore: number
  deltaFromPrevious: number | null
  riskLevel: RopRiskLevel
  computedAt: string
  evidence: {
    totalTerminalOrders: number
    successfulOrders: number
    cancelledOrders: number
    onTimeOrders: number
    ratedSamples: number
  }
}

function getRopEventsState() {
  const globalState = globalThis as typeof globalThis & {
    [ROP_EVENTS_KEY]?: RopEventsState
  }

  if (!globalState[ROP_EVENTS_KEY]) {
    const emitter = new EventEmitter()
    emitter.setMaxListeners(0)
    globalState[ROP_EVENTS_KEY] = { emitter }
  }

  return globalState[ROP_EVENTS_KEY]!
}

export function publishRopTrustScoreRecomputedEvent(payload: RopTrustScoreRecomputedEvent) {
  getRopEventsState().emitter.emit(TRUST_RECOMPUTED_EVENT, payload)
}

export function subscribeToRopTrustScoreRecomputedEvent(listener: (payload: RopTrustScoreRecomputedEvent) => void) {
  const emitter = getRopEventsState().emitter
  emitter.on(TRUST_RECOMPUTED_EVENT, listener)

  return () => {
    emitter.off(TRUST_RECOMPUTED_EVENT, listener)
  }
}