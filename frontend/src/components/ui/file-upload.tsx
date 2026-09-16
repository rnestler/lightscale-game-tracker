import type { JSX } from 'react';
import { useRef, useState, useEffect, useCallback } from 'react';
import { Paperclip, X, Upload, CheckCircle, ZoomIn, RefreshCw } from 'lucide-react';
import type { FileUploadValue, FileValue } from '../../types/file';
import { cn } from '../../utils/cn';

interface FileUploadProps {
  value: FileUploadValue | null;
  onChange: (value: FileUploadValue | null) => void;
  existingFile?: FileValue | null;
  existingFileUrl?: string | null;
  accept?: string;
  maxSize?: number;
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1000000000) {
    return `${(bytes / 1000000000).toString()} GB`;
  }
  if (bytes >= 1000000) {
    return `${(bytes / 1000000).toString()} MB`;
  }
  return `${(bytes / 1000).toString()} KB`;
}

function fileMatchesAccept(fileType: string, accept: string): boolean {
  const type = fileType.toLowerCase();
  const patterns = accept
    .split(',')
    .map((pattern) => pattern.trim().toLowerCase())
    .filter((pattern) => pattern !== '');
  if (patterns.length === 0) {
    return true;
  }
  return patterns.some((pattern) =>
    pattern.endsWith('/*') ? type.startsWith(pattern.slice(0, -1)) : type === pattern
  );
}

function acceptLabel(pattern: string): string {
  const parts = pattern.toLowerCase().split('/');
  const top = parts[0] ?? '';
  const sub = parts[1] ?? '';
  if (sub === '*') {
    return `any ${top}`;
  }
  return (sub.split('+')[0] ?? '').toUpperCase();
}

function describeAcceptedTypes(accept: string): string {
  return accept
    .split(',')
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern !== '')
    .map((pattern) => acceptLabel(pattern))
    .join(', ');
}

interface PreviewLightboxProps {
  src: string;
  alt: string;
  isVideo: boolean;
  onClose: () => void;
}

function PreviewLightbox({ src, alt, isVideo, onClose }: PreviewLightboxProps): JSX.Element {
  const handleKey = useCallback(
    (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect((): (() => void) => {
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return (): void => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [handleKey]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>
      {isVideo ? (
        <video
          src={src}
          controls
          autoPlay
          className="max-w-full max-h-full rounded-lg shadow-2xl"
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
      ) : (
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full rounded-lg shadow-2xl object-contain"
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
      )}
    </div>
  );
}

export function FileUpload({
  value,
  onChange,
  existingFile,
  existingFileUrl,
  accept,
  maxSize,
  className,
}: FileUploadProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [existingLightboxOpen, setExistingLightboxOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function processFile(file: File): void {
    if (accept !== undefined && accept !== '' && !fileMatchesAccept(file.type, accept)) {
      setError('File type not allowed.');
      return;
    }
    if (maxSize !== undefined && file.size > maxSize) {
      setError(`File is too large. Maximum size is ${formatFileSize(maxSize)}.`);
      return;
    }
    setError(null);
    setProgress(0);
    setPreview(null);
    setLightboxOpen(false);

    const reader = new FileReader();

    reader.onprogress = (e: ProgressEvent): void => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    reader.onload = (): void => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] ?? '';
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        setPreview(result);
      }
      setProgress(100);
      setTimeout(() => {
        setProgress(null);
        onChange({ data: base64, mimeType: file.type, fileName: file.name });
      }, 400);
    };

    reader.readAsDataURL(file);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    processFile(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLButtonElement>): void {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(): void {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLButtonElement>): void {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }

  function handleRemove(): void {
    onChange(null);
    setPreview(null);
    setProgress(null);
    setLightboxOpen(false);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  function handleReplaceClick(): void {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    inputRef.current?.click();
  }

  const isLoading = progress !== null && progress < 100;
  const isDone = progress === 100;
  const isImage = (value?.mimeType ?? '').startsWith('image/');
  const isVideo = (value?.mimeType ?? '').startsWith('video/');
  const canPreview = isImage || isVideo;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />

      {error !== null && <p className="text-sm text-destructive-text">{error}</p>}

      {(isLoading || isDone) && (
        <div className="flex flex-col gap-1.5 p-3 bg-secondary rounded-md border border-border">
          <div className="flex items-center gap-2">
            {isDone ? (
              <CheckCircle className="h-4 w-4 ui-success-text flex-shrink-0" />
            ) : (
              <Upload className="h-4 w-4 text-muted-foreground flex-shrink-0 animate-pulse" />
            )}
            <span className="text-sm text-foreground flex-1 truncate">
              {isDone ? 'File ready' : 'Reading file…'}
            </span>
            <span className="text-xs text-muted-foreground">{progress}%</span>
          </div>
          <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-accent transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {!isLoading && !isDone && value !== null && (
        <div className="flex flex-col gap-2 p-3 bg-secondary rounded-md border border-border">
          <div className="flex gap-3">
            {preview !== null && (
              <div
                className="relative h-14 w-14 rounded overflow-hidden flex-shrink-0 border border-border cursor-zoom-in group"
                onClick={() => {
                  setLightboxOpen(true);
                }}
              >
                {isVideo ? (
                  <video src={preview} className="h-full w-full object-cover" muted />
                ) : (
                  <img src={preview} alt={value.fileName} className="h-full w-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            )}
            {preview === null && (
              <div className="h-14 w-14 rounded bg-border flex items-center justify-center flex-shrink-0">
                <Paperclip className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
              <span className="text-sm font-medium text-foreground truncate">{value.fileName}</span>
              <span className="text-xs text-muted-foreground">{value.mimeType}</span>
            </div>
            <button
              type="button"
              aria-label="Remove"
              title="Remove"
              onClick={handleRemove}
              className="text-muted-foreground hover:text-foreground transition-colors self-start mt-0.5 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={handleReplaceClick}
            className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 border border-dashed border-border rounded hover:border-foreground/30"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Replace file
          </button>
          {canPreview && (
            <button
              type="button"
              onClick={() => {
                setLightboxOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 border border-dashed border-border rounded hover:border-foreground/30"
            >
              <ZoomIn className="h-3.5 w-3.5" />
              Preview {isVideo ? 'video' : 'image'}
            </button>
          )}
        </div>
      )}

      {!isLoading &&
        !isDone &&
        value === null &&
        existingFile !== null &&
        existingFile !== undefined && (
          <div className="flex flex-col gap-2 p-3 bg-secondary rounded-md border border-border">
            <div className="flex gap-3">
              {existingFileUrl !== null &&
              existingFileUrl !== undefined &&
              existingFile.mimeType.startsWith('image/') ? (
                <div
                  className="relative h-14 w-14 rounded overflow-hidden flex-shrink-0 border border-border cursor-zoom-in group"
                  onClick={() => {
                    setExistingLightboxOpen(true);
                  }}
                >
                  <img
                    src={existingFileUrl}
                    alt={existingFile.fileName}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ) : existingFileUrl !== null &&
                existingFileUrl !== undefined &&
                existingFile.mimeType.startsWith('video/') ? (
                <div
                  className="relative h-14 w-14 rounded overflow-hidden flex-shrink-0 border border-border cursor-zoom-in group"
                  onClick={() => {
                    setExistingLightboxOpen(true);
                  }}
                >
                  <video
                    src={existingFileUrl}
                    className="h-full w-full object-cover"
                    muted
                    preload="metadata"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ) : (
                <div className="h-14 w-14 rounded bg-border flex items-center justify-center flex-shrink-0">
                  <Paperclip className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                <span className="text-sm font-medium text-foreground truncate">
                  {existingFile.fileName}
                </span>
                <span className="text-xs text-muted-foreground">{existingFile.mimeType}</span>
              </div>
              <button
                type="button"
                aria-label="Remove"
                title="Remove"
                onClick={handleRemove}
                className="text-muted-foreground hover:text-foreground transition-colors self-start mt-0.5 flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleReplaceClick}
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 border border-dashed border-border rounded hover:border-foreground/30"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Replace file
            </button>
            {existingFileUrl !== null &&
              existingFileUrl !== undefined &&
              (existingFile.mimeType.startsWith('image/') ||
                existingFile.mimeType.startsWith('video/')) && (
                <button
                  type="button"
                  onClick={() => {
                    setExistingLightboxOpen(true);
                  }}
                  className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 border border-dashed border-border rounded hover:border-foreground/30"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                  Preview {existingFile.mimeType.startsWith('video/') ? 'video' : 'image'}
                </button>
              )}
          </div>
        )}

      {!isLoading &&
        !isDone &&
        value === null &&
        (existingFile === null || existingFile === undefined) && (
          <button
            type="button"
            onClick={() => {
              inputRef.current?.click();
            }}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed rounded-md transition-all duration-200 text-sm group',
              isDragging
                ? 'border-accent text-accent-text bg-accent/10'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/50'
            )}
          >
            <Upload
              className={cn(
                'h-6 w-6 transition-transform duration-200',
                isDragging ? 'scale-110' : 'group-hover:scale-110'
              )}
            />
            <span>{isDragging ? 'Drop file here' : 'Click or drag file here'}</span>
            {((accept !== undefined && accept !== '') || maxSize !== undefined) && (
              <span className="text-xs text-muted-foreground/70">
                {[
                  accept !== undefined && accept !== '' ? describeAcceptedTypes(accept) : null,
                  maxSize !== undefined ? `max ${formatFileSize(maxSize)}` : null,
                ]
                  .filter((part) => part !== null)
                  .join(' · ')}
              </span>
            )}
          </button>
        )}

      {lightboxOpen && value !== null && canPreview && preview !== null && (
        <PreviewLightbox
          src={preview}
          alt={value.fileName}
          isVideo={isVideo}
          onClose={() => {
            setLightboxOpen(false);
          }}
        />
      )}
      {existingLightboxOpen &&
        existingFile !== null &&
        existingFile !== undefined &&
        existingFileUrl !== null &&
        existingFileUrl !== undefined && (
          <PreviewLightbox
            src={existingFileUrl}
            alt={existingFile.fileName}
            isVideo={existingFile.mimeType.startsWith('video/')}
            onClose={() => {
              setExistingLightboxOpen(false);
            }}
          />
        )}
    </div>
  );
}
