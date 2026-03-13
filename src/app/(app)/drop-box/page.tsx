'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { useFirebase } from '@/firebase/provider';
import { useAuth } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { uploadDropboxFile, deleteDropboxFile, clearDropbox } from '@/firebase/firestore/dropbox';
import type { DropboxFile } from '@/lib/types';
import type { UploadTask } from 'firebase/storage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  CloudUpload, 
  Trash2, 
  Download, 
  ShieldAlert, 
  Files, 
  History, 
  Smartphone, 
  Laptop, 
  ArrowRightLeft,
  X,
  FileText,
  FileImage,
  Loader2,
  HardDrive
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';

export default function DropboxPage() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isClearing, setIsClearing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // Transfer Control Refs
  const currentTaskRef = useRef<UploadTask | null>(null);
  const cancelRequestedRef = useRef(false);

  // Security: Restricted access
  const isAuthorized = user?.username === 'Viren' || user?.role === 'admin';

  const filesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'dropboxFiles'), orderBy('uploadedAt', 'desc'));
  }, [db]);

  const { data: files, loading } = useCollection<DropboxFile>(filesQuery);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !user) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    cancelRequestedRef.current = false;
    let successCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      if (cancelRequestedRef.current) break;
      
      const file = fileList[i];
      const result = await uploadDropboxFile(file, user, (task) => {
        currentTaskRef.current = task;
        
        // Listen for progress
        task.on('state_changed', (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        });
      });

      if (result) successCount++;
    }

    if (successCount > 0 && !cancelRequestedRef.current) {
      toast({ title: "Transfer Successful", description: `${successCount} asset(s) uploaded to the cloud.` });
    }
    
    setIsUploading(false);
    setUploadProgress(0);
    currentTaskRef.current = null;
  };

  const handleCancel = () => {
    if (currentTaskRef.current) {
      currentTaskRef.current.cancel();
    }
    cancelRequestedRef.current = true;
    setIsUploading(false);
    setUploadProgress(0);
    toast({ variant: 'destructive', title: "Transfer Aborted" });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const handleClear = async () => {
    if (!user) return;
    setIsClearing(true);
    const success = await clearDropbox(user);
    if (success) {
      toast({ title: "DropBox Nuked", description: "All shared assets have been deleted." });
    }
    setIsClearing(false);
  };

  const handleDeleteFile = async (file: DropboxFile) => {
    if (!user) return;
    const success = await deleteDropboxFile(file.id, file.url, user);
    if (success) {
      toast({ title: "Asset Removed" });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isAuthorized) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-4 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="text-4xl font-headline uppercase tracking-tighter">Access Denied</h1>
        <p className="text-muted-foreground max-w-md font-medium">The Bistro DropBox is a restricted asset hub.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto font-body pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-headline text-4xl sm:text-5xl tracking-wider text-foreground flex items-center gap-4">
            <Files className="h-10 w-10 text-primary" />
            BISTRO DROPBOX
          </h1>
          <p className="text-muted-foreground font-black uppercase tracking-[0.2em] text-[10px] pl-1">
            SEAMLESS FILE TRANSFER BETWEEN TERMINALS & MOBILE.
          </p>
        </div>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="h-12 px-6 font-black uppercase border-2 border-destructive/30 text-destructive hover:bg-destructive/5 gap-2">
              <Trash2 className="h-4 w-4" />
              Wipe DropBox
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-4 border-destructive">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-headline text-destructive text-xl">NUCLEAR CLEANUP?</AlertDialogTitle>
              <AlertDialogDescription className="font-bold text-foreground">
                This will PERMANENTLY delete all files currently in the drop box across all devices.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-bold">ABORT</AlertDialogCancel>
              <AlertDialogAction onClick={handleClear} className="bg-destructive hover:bg-destructive/90 font-black uppercase">Destroy All Files</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: UPLOAD ZONE */}
        <div className="lg:col-span-1 space-y-6">
          <Card 
            className={cn(
              "border-4 border-dashed transition-all duration-300 relative min-h-[300px] flex flex-col items-center justify-center p-8 text-center cursor-pointer group",
              dragActive ? "border-primary bg-primary/5 scale-[1.02]" : "border-muted-foreground/20 bg-muted/5 hover:border-primary/40",
              isUploading && "pointer-events-none opacity-50"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              multiple 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => handleUpload(e.target.files)}
            />
            {isUploading ? (
              <div className="space-y-4">
                <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
                <div className="space-y-2">
                    <p className="font-black uppercase text-xs tracking-widest animate-pulse">Syncing to Cloud...</p>
                    {uploadProgress > 0 && (
                        <div className="w-full max-w-[150px] mx-auto space-y-1">
                            <Progress value={uploadProgress} className="h-1" />
                            <p className="text-[8px] font-mono font-bold text-muted-foreground">{Math.round(uploadProgress)}% COMPLETE</p>
                        </div>
                    )}
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => {
                        e.stopPropagation();
                        handleCancel();
                    }}
                    className="h-8 px-4 font-black uppercase text-[10px] border-destructive/30 text-destructive hover:bg-destructive/5 active:scale-95 transition-all"
                >
                    <X className="mr-1.5 h-3 w-3" />
                    Cancel Transfer
                </Button>
              </div>
            ) : (
              <>
                <div className="bg-primary/10 p-6 rounded-full group-hover:scale-110 transition-transform mb-4">
                  <CloudUpload className="h-12 w-12 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-headline text-lg tracking-tight uppercase">Drop Assets Here</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed max-w-[200px]">
                    Drag files on PC or tap to upload from your phone.
                  </p>
                </div>
              </>
            )}
          </Card>

          <Card className="border-2 bg-muted/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Transfer Workflow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <Laptop className="h-6 w-6 text-primary opacity-40" />
                  <span className="text-[8px] font-bold uppercase">PC</span>
                </div>
                <div className="flex-1 h-[2px] bg-gradient-to-r from-primary/40 via-primary to-primary/40 rounded-full" />
                <div className="flex flex-col items-center gap-1">
                  <Smartphone className="h-6 w-6 text-primary opacity-40" />
                  <span className="text-[8px] font-bold uppercase">Phone</span>
                </div>
              </div>
              <p className="text-[10px] font-medium text-muted-foreground italic leading-relaxed">
                Use this hub to quickly move bills, menu drafts, or promotional assets across your hardware suite.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: FILE LIST */}
        <Card className="lg:col-span-2 border-2 shadow-xl overflow-hidden flex flex-col h-[600px]">
          <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between py-4">
            <div className="space-y-1">
              <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-primary" />
                Active Assets
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
                {files?.length || 0} items available in the shared pool.
              </CardDescription>
            </div>
            {files && files.length > 0 && (
              <Badge variant="outline" className="font-mono bg-background text-[10px] h-6">
                {formatFileSize(files.reduce((s, f) => s + f.size, 0))} Total
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0 bg-background/50">
            <ScrollArea className="h-full">
              <div className="divide-y">
                {loading ? (
                  <div className="p-20 text-center animate-pulse opacity-30 font-headline text-[10px] uppercase">Querying Registry...</div>
                ) : files && files.length > 0 ? (
                  files.map((file) => {
                    const isImage = file.type.startsWith('image/');
                    return (
                      <div key={file.id} className="p-4 flex items-center justify-between hover:bg-muted/5 transition-all group">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className={cn(
                            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border-2",
                            isImage ? "bg-emerald-500/10 border-emerald-500/20" : "bg-primary/10 border-primary/20"
                          )}>
                            {isImage ? <FileImage className="text-emerald-600 h-6 w-6" /> : <FileText className="text-primary h-6 w-6" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-black uppercase text-xs sm:text-sm truncate group-hover:text-primary transition-colors">
                              {file.name}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-[9px] font-bold text-muted-foreground uppercase tracking-tight">
                              <span>{formatFileSize(file.size)}</span>
                              <span className="opacity-30">•</span>
                              <span>{format(new Date(file.uploadedAt), 'MMM d, p')}</span>
                              <span className="opacity-30">•</span>
                              <span className="text-primary/60">By {file.uploadedBy.displayName}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button 
                            asChild 
                            variant="outline" 
                            size="icon" 
                            className="h-10 w-10 border-2 hover:bg-primary hover:text-white transition-all shadow-sm"
                          >
                            <a href={file.url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteFile(file)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-32 flex flex-col items-center justify-center opacity-30 italic text-center px-10">
                    <History className="h-12 w-12 mb-4" />
                    <p className="font-headline text-[10px] tracking-widest uppercase">The DropBox is currently empty.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="bg-muted/10 border-t p-3 justify-center">
            <p className="text-[8px] font-black uppercase text-muted-foreground tracking-[0.2em]">End-to-End Strategic Asset Synchronization</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
