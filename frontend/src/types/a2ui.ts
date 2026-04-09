// A2UI schema types — mirrors the Python Pydantic models in backend/app/models/schemas.py

export type LessonType = 'lesson' | 'quiz' | 'flashcard' | 'worksheet' | 'vocabulary'

export interface A2UIMetadata {
  title: string
  subject: string
  grade_level: string
  lesson_type: LessonType
  generated_at: string
  image_filename: string
  dataset_name: string
  caption: string
  caption_method: string
  model_used: string
}

export interface A2UILayout {
  type: 'stack' | 'grid' | 'tabs'
  gap: 'sm' | 'md' | 'lg'
}

// ── Component prop types ──────────────────────────────────────────────────────

export interface ContentBlockProps {
  heading: string
  body: string
  highlight?: string[]
}

export interface Annotation {
  id: string
  x: number   // 0.0 – 1.0 (fraction of image width)
  y: number   // 0.0 – 1.0 (fraction of image height)
  label: string
  color: string
}

export interface ImageAnnotationProps {
  src: string
  alt: string
  annotations?: Annotation[]
}

export interface QuizBlockProps {
  question: string
  options: string[]
  correct_index: number
  explanation: string
  points?: number
}

export interface Flashcard {
  front: string
  back: string
}

export interface FlashcardBlockProps {
  cards: Flashcard[]
}

export interface FillBlankProps {
  template: string
  blanks: string[]
  hint?: string
}

export interface WordBankTarget {
  id: string
  definition: string
  answer: string
}

export interface WordBankProps {
  words: string[]
  instructions: string
  targets: WordBankTarget[]
}

// ── Discriminated union for components ───────────────────────────────────────

export type A2UIComponent =
  | { id: string; type: 'content_block';    props: ContentBlockProps }
  | { id: string; type: 'image_annotation'; props: ImageAnnotationProps }
  | { id: string; type: 'quiz_block';       props: QuizBlockProps }
  | { id: string; type: 'flashcard_block';  props: FlashcardBlockProps }
  | { id: string; type: 'fill_blank';       props: FillBlankProps }
  | { id: string; type: 'word_bank';        props: WordBankProps }

// ── Root document ─────────────────────────────────────────────────────────────

export interface A2UIDocument {
  schema_version: string
  document_id: string
  metadata: A2UIMetadata
  layout: A2UILayout
  components: A2UIComponent[]
}

// ── API response types ────────────────────────────────────────────────────────

export interface GenerateResponse {
  lesson_id: string
  caption: string
  caption_method: string
  a2ui_schema: A2UIDocument
  model_used: string
  generation_time_ms: number
  cached: boolean
}

export interface Dataset {
  id: number
  uuid: string
  name: string
  display_name: string | null
  description: string | null
  subject: string | null
  grade_level: string | null
  folder_path: string
  image_count: number
  is_public: boolean
  owner_id: number
  created_at: string
}

export interface ImageItem {
  filename: string
  url: string
  size_bytes: number
  mime_type: string
}

export interface User {
  id: number
  uuid: string
  email: string
  full_name: string | null
  role: string
  school_id: number | null
  is_active: boolean
  created_at: string
}
