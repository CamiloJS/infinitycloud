'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useItems } from '@/context/ItemsContext';
import { InfinityItem } from '@/types';
import { 
  X, 
  Save, 
  Download, 
  Copy, 
  Check, 
  Folder, 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  CheckSquare, 
  Quote, 
  Code, 
  Minus, 
  Link as LinkIcon, 
  Eye, 
  Edit3, 
  Columns, 
  FileText,
  Loader2
} from 'lucide-react';

interface TextEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItem?: InfinityItem | null;
  initialCollectionId?: string | null;
  onSaved?: (item: InfinityItem) => void;
}

export function TextEditorModal({
  isOpen,
  onClose,
  initialItem,
  initialCollectionId,
  onSaved
}: TextEditorModalProps) {
  const { collections, createTextDocument, editItem } = useItems();
  
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('split');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialItem) {
        setTitle(initialItem.name.replace(/\.md$/, ''));
        setContent(initialItem.metadata?.content || '');
        setCollectionId(initialItem.collectionId || null);
      } else {
        setTitle('Nuevo documento');
        setContent('');
        setCollectionId(initialCollectionId || null);
      }
      setSavedSuccess(false);
      // Default to split mode on desktop, edit mode on small screens
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setViewMode('edit');
      } else {
        setViewMode('split');
      }
    }
  }, [isOpen, initialItem, initialCollectionId]);

  if (!isOpen) return null;

  // Formatting helpers
  const insertFormatting = (prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const selection = current.substring(start, end) || defaultText;

    const before = current.substring(0, start);
    const after = current.substring(end);

    const replacement = `${prefix}${selection}${suffix}`;
    const nextContent = `${before}${replacement}${after}`;
    setContent(nextContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selection.length
      );
    }, 10);
  };

  const insertLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const current = textarea.value;
    const lastNewline = current.lastIndexOf('\n', start - 1);
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;

    const before = current.substring(0, lineStart);
    const after = current.substring(lineStart);

    setContent(`${before}${prefix}${after}`);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab inserts 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      insertFormatting('  ', '', '');
      return;
    }
    // Ctrl+S or Cmd+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  // Live statistics
  const trimmed = content.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const charCount = content.length;
  const lineCount = content ? content.split('\n').length : 1;
  const readingTime = Math.ceil(wordCount / 200);

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      const cleanTitle = title.trim();
      const filename = cleanTitle.endsWith('.md') || cleanTitle.endsWith('.txt') 
        ? cleanTitle 
        : `${cleanTitle}.md`;

      if (initialItem) {
        const blobSize = new Blob([content]).size;
        await editItem(initialItem.id, {
          name: filename,
          collectionId: collectionId || null,
          size: blobSize,
          metadata: {
            ...initialItem.metadata,
            content,
            wordCount,
            isLocalDocument: true,
            updatedAt: Date.now()
          }
        });
        const updated: InfinityItem = {
          ...initialItem,
          name: filename,
          collectionId: collectionId || null,
          size: blobSize,
          metadata: {
            ...initialItem.metadata,
            content,
            wordCount,
            isLocalDocument: true,
            updatedAt: Date.now()
          }
        };
        if (onSaved) onSaved(updated);
      } else {
        const created = await createTextDocument(filename, content, collectionId);
        if (onSaved) onSaved(created);
      }

      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Error saving document:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = (format: 'md' | 'txt') => {
    const filename = `${title.trim() || 'documento'}.${format}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Safe and clean Markdown rendering
  const renderMarkdown = (text: string) => {
    if (!text.trim()) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-16 text-center select-none">
          <FileText size={40} className="mb-2 opacity-50 stroke-[1.5]" />
          <p className="text-sm">Comienza a escribir para ver la vista previa en tiempo real.</p>
        </div>
      );
    }

    const lines = text.split('\n');
    let inCodeBlock = false;
    let codeBlockLang = '';
    let codeBlockLines: string[] = [];
    const elements: React.ReactNode[] = [];

    const flushCodeBlock = (key: string) => {
      if (codeBlockLines.length > 0) {
        elements.push(
          <div key={key} className="my-3 rounded-xl bg-slate-900 text-slate-100 p-4 font-mono text-xs overflow-x-auto border border-slate-800">
            {codeBlockLang && (
              <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1.5 font-bold">
                {codeBlockLang}
              </div>
            )}
            <pre className="whitespace-pre">{codeBlockLines.join('\n')}</pre>
          </div>
        );
        codeBlockLines = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Code block start / end
      if (trimmedLine.startsWith('```')) {
        if (inCodeBlock) {
          flushCodeBlock(`code_${index}`);
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeBlockLang = trimmedLine.replace(/^```/, '').trim();
          codeBlockLines = [];
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        return;
      }

      // Horizontal rule
      if (/^(---|\*\*\*|___)$/.test(trimmedLine)) {
        elements.push(
          <hr key={`hr_${index}`} className="my-5 border-slate-200 dark:border-slate-800" />
        );
        return;
      }

      // Headings
      if (line.startsWith('### ')) {
        elements.push(
          <h3 key={`h3_${index}`} className="text-base font-bold text-slate-900 dark:text-white mt-4 mb-2">
            {parseInlineMarkdown(line.substring(4))}
          </h3>
        );
        return;
      }
      if (line.startsWith('## ')) {
        elements.push(
          <h2 key={`h2_${index}`} className="text-lg font-bold text-slate-900 dark:text-white mt-5 mb-2 pb-1 border-b border-slate-200 dark:border-slate-800">
            {parseInlineMarkdown(line.substring(3))}
          </h2>
        );
        return;
      }
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={`h1_${index}`} className="text-2xl font-extrabold text-slate-900 dark:text-white mt-6 mb-3 pb-2 border-b border-slate-200 dark:border-slate-800">
            {parseInlineMarkdown(line.substring(2))}
          </h1>
        );
        return;
      }

      // Blockquotes
      if (line.startsWith('> ')) {
        elements.push(
          <blockquote key={`quote_${index}`} className="my-2.5 pl-3.5 border-l-4 border-blue-500 text-slate-600 dark:text-slate-300 italic text-sm">
            {parseInlineMarkdown(line.substring(2))}
          </blockquote>
        );
        return;
      }

      // Checklists
      if (line.startsWith('- [ ] ') || line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
        const isChecked = line.startsWith('- [x] ') || line.startsWith('- [X] ');
        elements.push(
          <div key={`check_${index}`} className="flex items-center gap-2.5 my-1 text-sm text-slate-700 dark:text-slate-200">
            <span className={`w-4 h-4 rounded flex items-center justify-center border ${isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}>
              {isChecked && <Check size={12} />}
            </span>
            <span className={isChecked ? 'line-through text-slate-400 dark:text-slate-500' : ''}>
              {parseInlineMarkdown(line.substring(6))}
            </span>
          </div>
        );
        return;
      }

      // Bullet lists
      if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(
          <li key={`li_${index}`} className="ml-5 list-disc my-1 text-sm text-slate-700 dark:text-slate-200">
            {parseInlineMarkdown(line.substring(2))}
          </li>
        );
        return;
      }

      // Numbered lists
      const orderedMatch = line.match(/^(\d+)\.\s(.*)$/);
      if (orderedMatch) {
        elements.push(
          <li key={`ol_${index}`} className="ml-5 list-decimal my-1 text-sm text-slate-700 dark:text-slate-200">
            {parseInlineMarkdown(orderedMatch[2])}
          </li>
        );
        return;
      }

      // Blank line
      if (trimmedLine === '') {
        elements.push(<div key={`blank_${index}`} className="h-3" />);
        return;
      }

      // Normal paragraph
      elements.push(
        <p key={`p_${index}`} className="my-1 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
          {parseInlineMarkdown(line)}
        </p>
      );
    });

    if (inCodeBlock) {
      flushCodeBlock('code_final');
    }

    return elements;
  };

  // Helper for inline markdown (bold, italic, code, links)
  const parseInlineMarkdown = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Bold
      const boldMatch = remaining.match(/^(\*\*|__)(.*?)\1/);
      if (boldMatch) {
        parts.push(<strong key={keyIdx++} className="font-semibold text-slate-900 dark:text-white">{boldMatch[2]}</strong>);
        remaining = remaining.substring(boldMatch[0].length);
        continue;
      }

      // Italic
      const italicMatch = remaining.match(/^(\*|_)(.*?)\1/);
      if (italicMatch) {
        parts.push(<em key={keyIdx++} className="italic">{italicMatch[2]}</em>);
        remaining = remaining.substring(italicMatch[0].length);
        continue;
      }

      // Strikethrough
      const strikeMatch = remaining.match(/^~~(.*?)~~/);
      if (strikeMatch) {
        parts.push(<del key={keyIdx++} className="line-through text-slate-400">{strikeMatch[1]}</del>);
        remaining = remaining.substring(strikeMatch[0].length);
        continue;
      }

      // Inline code
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        parts.push(
          <code key={keyIdx++} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-mono text-xs">
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.substring(codeMatch[0].length);
        continue;
      }

      // Links: [label](url)
      const linkMatch = remaining.match(/^\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={keyIdx++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700"
          >
            {linkMatch[1] || linkMatch[2]}
          </a>
        );
        remaining = remaining.substring(linkMatch[0].length);
        continue;
      }

      // Next plain text character chunk
      const nextSpecial = remaining.search(/(\*\*|__|\*|_|~~|`|\[)/);
      if (nextSpecial === -1) {
        parts.push(remaining);
        break;
      } else if (nextSpecial === 0) {
        parts.push(remaining[0]);
        remaining = remaining.substring(1);
      } else {
        parts.push(remaining.substring(0, nextSpecial));
        remaining = remaining.substring(nextSpecial);
      }
    }

    return parts;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[92vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
              <FileText size={18} />
            </div>
            
            {/* Title Input */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título del documento..."
              className="bg-transparent font-bold text-base sm:text-lg text-slate-900 dark:text-white placeholder-slate-400 outline-none w-full truncate border-b border-transparent focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Folder Selector */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
              <Folder size={13} className="text-violet-500 shrink-0" />
              <select
                value={collectionId || ''}
                onChange={(e) => setCollectionId(e.target.value ? e.target.value : null)}
                className="bg-transparent outline-none cursor-pointer text-xs pr-1 font-medium text-slate-700 dark:text-slate-300"
              >
                <option value="" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                  (Sin carpeta)
                </option>
                {collections.map(c => (
                  <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Cerrar editor"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Formatting Toolbar & View Mode Switcher */}
        <div className="px-4 sm:px-6 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 overflow-x-auto shrink-0 select-none">
          {/* Format Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => insertFormatting('**', '**', 'texto')}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Negrita (**)"
            >
              <Bold size={15} />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('*', '*', 'texto')}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Cursiva (*)"
            >
              <Italic size={15} />
            </button>

            <span className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />

            <button
              type="button"
              onClick={() => insertLinePrefix('# ')}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Encabezado 1 (#)"
            >
              <Heading1 size={15} />
            </button>
            <button
              type="button"
              onClick={() => insertLinePrefix('## ')}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Encabezado 2 (##)"
            >
              <Heading2 size={15} />
            </button>
            <button
              type="button"
              onClick={() => insertLinePrefix('### ')}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Encabezado 3 (###)"
            >
              <Heading3 size={15} />
            </button>

            <span className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />

            <button
              type="button"
              onClick={() => insertLinePrefix('- ')}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Lista con viñetas (-)"
            >
              <List size={15} />
            </button>
            <button
              type="button"
              onClick={() => insertLinePrefix('1. ')}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Lista numerada (1.)"
            >
              <ListOrdered size={15} />
            </button>
            <button
              type="button"
              onClick={() => insertLinePrefix('- [ ] ')}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Tarea / Checklist (- [ ])"
            >
              <CheckSquare size={15} />
            </button>
            <button
              type="button"
              onClick={() => insertLinePrefix('> ')}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Cita (>)"
            >
              <Quote size={15} />
            </button>

            <span className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />

            <button
              type="button"
              onClick={() => insertFormatting('`', '`', 'código')}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Código en línea (`)"
            >
              <Code size={15} />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('\n```\n', '\n```\n', 'código')}
              className="p-1.5 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Bloque de código (```)"
            >
              {'{}'}
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('\n---\n')}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Separador horizontal (---)"
            >
              <Minus size={15} />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('[', '](https://)', 'enlace')}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Enlace [texto](url)"
            >
              <LinkIcon size={15} />
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'edit'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Modo solo editor"
            >
              <Edit3 size={13} />
              <span className="hidden sm:inline">Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`hidden md:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'split'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Vista dividida (Editor y Vista previa)"
            >
              <Columns size={13} />
              <span>Dividido</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'preview'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Solo vista previa"
            >
              <Eye size={13} />
              <span className="hidden sm:inline">Vista previa</span>
            </button>
          </div>
        </div>

        {/* Main Content: Editor & Preview */}
        <div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-950">
          {/* Left / Main Textarea */}
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div className={`h-full flex flex-col ${viewMode === 'split' ? 'w-full md:w-1/2 border-r border-slate-200 dark:border-slate-800' : 'w-full'}`}>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe aquí tu documento en texto plano o Markdown...

# Título de ejemplo
Puedes usar **negrita**, *cursiva*, listas y bloques de código:
- Tarea o punto clave
- Documentación organizada"
                className="w-full flex-1 p-5 sm:p-6 bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm md:text-base font-mono resize-none outline-none leading-relaxed overflow-y-auto selection:bg-blue-500/20"
                spellCheck={false}
              />
            </div>
          )}

          {/* Right / Preview Area */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className={`h-full overflow-y-auto p-5 sm:p-7 bg-white dark:bg-slate-900 ${viewMode === 'split' ? 'hidden md:block md:w-1/2' : 'w-full'}`}>
              <div className="max-w-2xl mx-auto">
                {renderMarkdown(content)}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Status & Actions Bar */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          {/* Word and Line Counters */}
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>{wordCount} palabras</span>
            <span>•</span>
            <span>{charCount} caracteres</span>
            <span>•</span>
            <span className="hidden sm:inline">{lineCount} líneas</span>
            {wordCount > 0 && (
              <>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">~{readingTime} min lectura</span>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Copiar texto al portapapeles"
            >
              {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
            </button>

            <button
              type="button"
              onClick={() => handleDownload('md')}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Descargar como .md"
            >
              <Download size={16} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition-all"
            >
              {isSaving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : savedSuccess ? (
                <Check size={15} className="text-white" />
              ) : (
                <Save size={15} />
              )}
              <span>{savedSuccess ? '¡Guardado!' : (initialItem ? 'Actualizar' : 'Guardar')}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
