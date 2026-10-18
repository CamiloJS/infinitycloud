import { z } from 'zod';

export const ProviderTypeSchema = z.enum([
  'notion',
  'youtube',
  'drive',
  'vimeo',
  'soundcloud',
  'direct',
  'generic'
]);

export const CategoryTypeSchema = z.enum([
  'photos',
  'videos',
  'music',
  'documents',
  'others'
]);

export const InfinityItemSchema = z.object({
  id: z.string().min(1),
  userId: z.string().optional().default(''),
  name: z.string().min(1, 'El nombre es obligatorio'),
  url: z.string().url('Debe ser una URL válida'),
  provider: ProviderTypeSchema,
  category: CategoryTypeSchema,
  mimeType: z.string().optional(),
  size: z.number().nonnegative().optional(),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  collectionId: z.string().nullable().optional(),
  isFavorite: z.boolean().default(false),
  isTrash: z.boolean().default(false),
  trashedAt: z.number().nullable().optional(),
  createdAt: z.number().default(() => Date.now()),
  updatedAt: z.number().default(() => Date.now()),
  metadata: z.record(z.string(), z.any()).optional()
});

export const InfinityCollectionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().optional().default(''),
  name: z.string().min(1, 'El nombre de la colección es obligatorio'),
  color: z.string().optional(),
  icon: z.string().optional(),
  createdAt: z.number().default(() => Date.now()),
  updatedAt: z.number().default(() => Date.now())
});

export const ExportDataSchema = z.object({
  version: z.literal(1),
  exportedAt: z.number(),
  source: z.literal('infinity'),
  collections: z.array(InfinityCollectionSchema),
  items: z.array(InfinityItemSchema)
});

export const CreateItemInputSchema = z.object({
  url: z.string().url('La URL no es válida'),
  name: z.string().min(1, 'El nombre es requerido'),
  category: CategoryTypeSchema,
  collectionId: z.string().nullable().optional(),
  thumbnailUrl: z.string().optional()
});

export type ExportData = z.infer<typeof ExportDataSchema>;
export type CreateItemInput = z.infer<typeof CreateItemInputSchema>;
