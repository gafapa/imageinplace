import {
  ArrowDownToLine,
  BookOpen,
  Crop,
  Eraser,
  Frame,
  Gauge,
  Maximize2,
  PenLine,
  Ruler,
  Scan,
  ScanFace,
  Shrink,
  SlidersHorizontal,
  Sparkles,
  Stamp,
  RotateCw,
  Tag,
} from 'lucide-react';
import { t } from '../i18n/index.js';

/** Groups shown in the individual editor rail, named after the user's task rather than editing jargon. */
export const toolGroups = [
  { id: 'adjust', get label() { return t('Ajustar'); } },
  { id: 'frame', get label() { return t('Encuadrar'); } },
  { id: 'protect', get label() { return t('Proteger y añadir'); } },
  { id: 'output', get label() { return t('Guardar'); } },
];

// `short` labels sit under the rail icons; `label` is the full accessible name and panel title.
export const tools = [
  { id: 'adjust', group: 'adjust', get short() { return t('Mejorar'); }, get label() { return t('Mejorar'); }, get description() { return t('Luz, color y nitidez'); }, icon: SlidersHorizontal },
  { id: 'resize', group: 'adjust', get short() { return t('Tamaño'); }, get label() { return t('Tamaño'); }, get description() { return t('Medidas exactas'); }, icon: Maximize2 },
  { id: 'rotate', group: 'adjust', get short() { return t('Girar'); }, get label() { return t('Girar'); }, get description() { return t('Gira o refleja'); }, icon: RotateCw },
  { id: 'deskew', group: 'adjust', get short() { return t('Enderezar'); }, get label() { return t('Enderezar'); }, get description() { return t('Alinea documentos con precisión'); }, icon: Ruler },
  { id: 'perspective', group: 'adjust', get short() { return t('Perspectiva'); }, get label() { return t('Perspectiva'); }, get description() { return t('Corrige las cuatro esquinas'); }, icon: Scan },
  { id: 'crop', group: 'frame', get short() { return t('Recortar'); }, get label() { return t('Recortar'); }, get description() { return t('Encuadre y proporción'); }, icon: Crop },
  { id: 'trim', group: 'frame', get short() { return t('Sin bordes'); }, get label() { return t('Recortar al contenido'); }, get description() { return t('Quita bordes vacíos'); }, icon: Shrink },
  { id: 'canvas', group: 'frame', get short() { return t('Lienzo'); }, get label() { return t('Lienzo'); }, get description() { return t('Márgenes y fondo'); }, icon: Frame },
  { id: 'background', group: 'frame', get short() { return t('Sin fondo'); }, get label() { return t('Quitar fondo'); }, get description() { return t('Fondo transparente'); }, icon: Eraser },
  { id: 'privacy', group: 'protect', get short() { return t('Ocultar'); }, get label() { return t('Ocultar'); }, get description() { return t('Protege datos y caras'); }, icon: ScanFace },
  { id: 'annotate', group: 'protect', get short() { return t('Anotar'); }, get label() { return t('Anotar'); }, get description() { return t('Texto, flechas y figuras'); }, icon: PenLine },
  { id: 'watermark', group: 'protect', get short() { return t('Marca'); }, get label() { return t('Marca'); }, get description() { return t('Añade autoría'); }, icon: Stamp },
  { id: 'compress', group: 'output', get short() { return t('Comprimir'); }, get label() { return t('Comprimir'); }, get description() { return t('Peso objetivo'); }, icon: Gauge },
  { id: 'rename', group: 'output', get short() { return t('Nombre'); }, get label() { return t('Renombrar'); }, get description() { return t('Nombre del archivo'); }, icon: Tag },
  { id: 'workflow', group: 'output', get short() { return t('Flujos'); }, get label() { return t('Flujo'); }, get description() { return t('Acciones guardadas'); }, icon: Sparkles },
  { id: 'export', group: 'output', get short() { return t('Descargar'); }, get label() { return t('Exportar'); }, get description() { return t('Formato y peso'); }, icon: ArrowDownToLine },
  // Reached from the Crop panel ("Recorte visual"), not listed in the rail.
  { id: 'visualcrop', group: 'frame', get short() { return t('Recorte visual'); }, get label() { return t('Recorte visual'); }, get description() { return t('Arrastra el marco de recorte'); }, icon: Crop, hidden: true },
];

// The gallery toolbar shows the frequent tools in `section` order; `more` tools live in its "Más" menu.
export const batchTools = [
  { id: 'adjust', section: 'edit', get short() { return t('Mejorar'); }, get label() { return t('Mejorar imágenes seleccionadas'); }, icon: SlidersHorizontal },
  { id: 'resize', section: 'edit', get short() { return t('Tamaño'); }, get label() { return t('Cambiar tamaño de imágenes seleccionadas'); }, icon: Maximize2 },
  { id: 'crop', section: 'edit', get short() { return t('Recortar'); }, get label() { return t('Recortar imágenes seleccionadas'); }, icon: Crop },
  { id: 'rotate', section: 'edit', get short() { return t('Girar'); }, get label() { return t('Girar imágenes seleccionadas'); }, icon: RotateCw },
  { id: 'background', section: 'add', get short() { return t('Sin fondo'); }, get label() { return t('Quitar fondo'); }, icon: Eraser },
  { id: 'watermark', section: 'add', get short() { return t('Marca'); }, get label() { return t('Añadir marca a imágenes seleccionadas'); }, icon: Stamp },
  { id: 'compress', section: 'output', get short() { return t('Comprimir'); }, get label() { return t('Comprimir a un peso objetivo'); }, icon: Gauge },
  { id: 'export', section: 'output', get short() { return t('Convertir'); }, get label() { return t('Exportar imágenes seleccionadas'); }, icon: ArrowDownToLine },
  { id: 'trim', more: true, get short() { return t('Sin bordes'); }, get label() { return t('Recortar al contenido'); }, icon: Shrink },
  { id: 'canvas', more: true, get short() { return t('Lienzo'); }, get label() { return t('Márgenes y lienzo'); }, icon: Frame },
  { id: 'rename', more: true, get short() { return t('Nombre'); }, get label() { return t('Renombrar selección'); }, icon: Tag },
  { id: 'print', more: true, get short() { return t('Láminas A4'); }, get label() { return t('Crear láminas A4'); }, icon: BookOpen },
  { id: 'workflow', more: true, get short() { return t('Flujos'); }, get label() { return t('Flujos reutilizables'); }, icon: Sparkles },
];
