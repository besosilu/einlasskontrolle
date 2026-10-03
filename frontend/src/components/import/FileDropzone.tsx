import { useRef, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { cn } from '@/utils/cn';

interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  disabled?: boolean;
}

export function FileDropzone({ onFiles, accept = '.csv,.txt', disabled }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  function handleFiles(files: File[]) {
    setSelectedFiles(files);
    onFiles(files);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFiles(files);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) handleFiles(files);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors',
        isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />

      {selectedFiles.length > 0 ? (
        <div className="w-full max-h-48 overflow-y-auto space-y-2">
          {selectedFiles.map((file) => (
            <div key={`${file.name}-${file.size}`} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <FileText className="h-5 w-5 flex-shrink-0 text-blue-500" />
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-slate-700">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <Upload className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">CSV- oder TXT-Dateien hierher ziehen</p>
          <p className="text-xs text-slate-400 mt-1">oder klicken zum Auswählen (Mehrfachauswahl möglich)</p>
          <p className="mt-3 text-xs text-slate-400 bg-slate-100 rounded px-2 py-1 font-mono">
            Mitgliedsnummer;Name;Vorname
          </p>
        </>
      )}
    </div>
  );
}
