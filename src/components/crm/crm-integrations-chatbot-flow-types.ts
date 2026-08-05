import type { ChatbotFlowStage } from '@/lib/crm-chatbot-flow'

export type ChatbotCanvasNode = {
  stage: ChatbotFlowStage
  x: number
  y: number
  width: number
  height: number
}

export type ChatbotCanvasConnection = {
  id: string
  fromStageId: string
  toStageId: string
  optionId: string
  label: string
  path: string
  labelX: number
  labelY: number
}