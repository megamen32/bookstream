export type BibliographyDetectionConfidence = 'heading' | 'tail-heuristic' | 'none'

export interface BibliographyItem {
  number: number
  rawText: string
  normalizedText: string | null
}

export interface BibliographyDetectionResult {
  items: BibliographyItem[]
  bibliographySectionId?: string
  confidence: BibliographyDetectionConfidence
}

export interface BibliographicAnnotationMarker {
  id: string
  markerText: string
  itemNumbers: number[]
}

export interface BibliographicAnnotationDiagnostics {
  bibliographyDetected: boolean
  detectionMethod: BibliographyDetectionConfidence
  bibliographyItemsCount: number
  annotationMarkersCount: number
  unresolvedMarkersCount: number
}

export interface TransformBibliographicAnnotationsResult {
  html: string
  items: BibliographyItem[]
  bibliographySectionId?: string
  annotations: BibliographicAnnotationMarker[]
  diagnostics: BibliographicAnnotationDiagnostics
}

