import fixture from './fixtures/entrenador-ia.json'
import { analyzeLitografiaBriefWithRules } from '@/lib/litografia-ai'
import { estimateEditorialKnowledgeCost } from '@/lib/litografia-ai-editorial'
import { litografiaAiKnowledgeDocumentSchema } from '@/lib/litografia-ai-knowledge'

const brief = 'Cartilla editorial tamaño carta · 2000 ejemplares · 28 páginas internas · propalcote 150 gms · portada propalcote 300 gms · plastificado mate parcial UV · acabado Holmet'

const document = litografiaAiKnowledgeDocumentSchema.parse(fixture)
const analysis = analyzeLitografiaBriefWithRules(brief)
const estimate = estimateEditorialKnowledgeCost({
  brief,
  extracted: analysis.extracted,
  document,
})

console.log(JSON.stringify({
  brief,
  analysis,
  estimate,
}, null, 2))