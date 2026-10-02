import { useRef, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { cn } from '@/utils/cn';

interface FileDropzoneProps {
  onFile: (file: File) => void;
  accept?: string;
  disabled?: boolean;
}

export function FileDropzone({ onFile, accept = '.csv,.txt', disabled }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleFile(file: File) {
    setSelectedFile(file);
    onFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
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
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />

      {selectedFile ? (
        <>
          <FileText className="h-10 w-10 text-blue-500" />
          <p className="mt-3 font-medium text-slate-700">{selectedFile.name}</p>
          <p className="text-xs text-slate-400 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
        </>
      ) : (
        <>
          <Upload className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">CSV- oder TXT-Datei hierher ziehen</p>
          <p className="text-xs text-slate-400 mt-1">oder klicken zum Auswählen</p>
          <p className="mt-3 text-xs text-slate-400 bg-slate-100 rounded px-2 py-1 font-mono">
            Mitgliedsnummer;Name;Vorname
          </p>
        </>
      )}
    </div>
  );
}
