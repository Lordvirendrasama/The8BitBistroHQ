'use client';

import { useState, useMemo, useRef } from 'react';
import { useFirebase } from '@/firebase/provider';
import { useAuth } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, type UploadTask } from 'firebase/storage';
import { registerDropboxFile, deleteDropboxFile, clearDropbox } from '@/firebase/firestore/dropbox';
import type { DropboxFile } from '@/lib/types';
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
  HardDrive,
  AlertTriangle
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
  const { db, storage } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTask, setActiveTask] = useState<UploadTask | null>(null);
  
  // Security: Restricted access
  const isAuthorized = user?.username === 'Viren' || user?.role === 'admin';

  const filesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'dropboxFiles'), orderBy('uploadedAt', 'desc'));
  }, [db]);

  const { data: files, loading } = useCollection<DropboxFile>(filesQuery);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !user || !storage || !db) return;
    
    setIsUploading(true);
    setUploadProgress(1); // Set to 1% immediately to show activity

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      
      try {
        // 1. Generate path
        const fileId = doc(collection(db, 'temp')).id;
        const storageRef = ref(storage, `dropbox/${fileId}_${file.name}`);
        
        // 2. Initialize Resumable Task
        const task = uploadBytesResumable(storageRef, file);
        setActiveTask(task);

        // 3. Wrap task in promise for better lifecycle management
        await new Promise((resolve, reject) => {
          task.on('state_changed', 
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(Math.max(1, Math.round(progress)));
            },
            (error) => {
              console.error("Firebase Storage Error Detail:", error);
              
              let errorMessage = error.message;
              if (error.code === 'storage/unauthorized') {
                errorMessage = "Access Denied. Check if Storage is enabled in Firebase Console.";
              } else if (error.code === 'storage/retry-limit-exceeded') {
                errorMessage = "Connection Timeout. Check your network or firewall.";
              } else if (error.code === 'storage/canceled') {
                errorMessage = "Transfer aborted by user.";
              }
              
              reject(new Error(errorMessage));
            },
            async () => {
              try {
                // 4. Get Public URL
                const downloadUrl = await getDownloadURL(task.snapshot.ref);
                
                // 5. Register in Firestore
                await registerDropboxFile(db, {
                  name: file.name,
                  url: downloadUrl,
                  type: file.type,
                  size: file.size,
                  uploadedAt: new Date().toISOString(),
                  uploadedBy: {
                    uid: user.username,
                    displayName: user.displayName
                  }
                }, user);
                
                resolve(true);
              } catch (regError) {
                reject(regError);
              }
            }
          );
        });

      } catch (error: any) {
        console.error("DropBox Sync Failure:", error);
        toast({ 
          variant: 'destructive', 
          title: "Transfer Failed", 
          description: error.message || "An unexpected error occurred during cloud sync."
        });
        // Stop the loop on first failure
        break;
      }
    }

    setIsUploading(false);
    setActiveTask(null);
    setUploadProgress(0);
  };

  const handleCancel = () => {
    if (activeTask) {
      activeTask.cancel();
      toast({ title: "Transfer Canceled" });
    }
  };

  const handleClear = async () => {
    if (!user || !db || !storage) return;
    const success = await clearDropbox(storage, db, user);
    if (success) {
      toast({ title: "DropBox Nuked", description: "Storage space has been cleared." });
    }
  };

  const handleDeleteFile = async (file: DropboxFile) => {
    if (!user || !db || !storage) return;
    const success = await deleteDropboxFile(storage, db, file.id, file.url, user);
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
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-4 text-center font-body">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="text-4xl font-headline uppercase tracking-tighter">Access Denied</h1>
        <p className="text-muted-foreground max-w-md font-medium">Bistro DropBox is restricted to management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto font-body pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
        <div className="flex flex-col gap-2">
          <h1 className="font-headline text-4xl sm:text-5xl tracking-wider text-foreground flex items-center gap-4">
            <Files className="h-10 w-10 text-primary" />
            DROPBOX HUB
          </h1>
          <p className="text-muted-foreground font-black uppercase tracking-[0.2em] text-[10px] pl-1">
            CROSS-DEVICE ASSET SYNCHRONIZATION // BUILD v2.2.7
          </p>
        </div>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="h-12 px-6 font-black uppercase border-2 border-destructive/30 text-destructive hover:bg-destructive/5 gap-2">
              <Trash2 className="h-4 w-4" />
              Clear Hub
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-4 border-destructive">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-headline text-destructive text-xl">WIPE SHARED POOL?</AlertDialogTitle>
              <AlertDialogDescription className="font-bold text-foreground">
                This will delete all files currently in the hub. Irreversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-bold">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleClear} className="bg-destructive hover:bg-destructive/90 font-black uppercase">Destroy All</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-2">
        <div className="lg:col-span-1 space-y-6">
          <Card 
            className={cn(
              "border-4 border-dashed transition-all duration-300 relative min-h-[300px] flex flex-col items-center justify-center p-8 text-center cursor-pointer group",
              isUploading ? "border-primary bg-primary/5 pointer-events-none" : "border-muted hover:border-primary/40 bg-muted/5"
            )}
          >
            {!isUploading && (
              <input 
                type="file" 
                multiple 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => handleUpload(e.target.files)}
              />
            )}
            
            {isUploading ? (
              <div className="space-y-6 w-full animate-in fade-in zoom-in-95 duration-300">
                <div className="relative flex items-center justify-center">
                  <Loader2 className="h-16 w-16 text-primary animate-spin" />
                  <span className="absolute font-mono font-black text-xs text-primary">
                    {uploadProgress}%
                  </span>
                </div>
                
                <div className="space-y-3">
                    <p className="font-black uppercase text-xs tracking-widest animate-pulse text-primary">Establishing Cloud Connection...</p>
                    <div className="w-full max-w-[200px] mx-auto space-y-1.5">
                        <Progress value={uploadProgress} className="h-2 bg-primary/10" />
                        <p className="text-[9px] font-mono font-black text-muted-foreground tracking-widest">{uploadProgress}% SYNCED</p>
                    </div>
                </div>

                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCancel}
                    className="h-9 px-6 font-black uppercase text-[10px] border-destructive/30 text-destructive hover:bg-destructive/5 transition-all shadow-md pointer-events-auto"
                >
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Cancel Transfer
                </Button>
              </div>
            ) : (
              <>
                <div className="bg-primary/10 p-6 rounded-full group-hover:scale-110 transition-transform mb-4">
                  <CloudUpload className="h-12 w-12 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-headline text-lg tracking-tight uppercase">Drop Files Here</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed max-w-[200px]">
                    Instant upload for cross-device access.
                  </p>
                </div>
              </>
            )}
          </Card>

          <Card className="border-2 bg-muted/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Connectivity Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">
                If uploads are stuck at 0%, ensure <strong>Firebase Storage</strong> is enabled in your console and that rules are deployed.
              </p>
              <div className="flex items-center gap-4">
                <Laptop className="h-6 w-6 text-primary opacity-20" />
                <div className="flex-1 h-[2px] bg-gradient-to-r from-primary/5 via-primary/20 to-primary/5 rounded-full" />
                <Smartphone className="h-6 w-6 text-primary opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

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
                {formatFileSize(files.reduce((s, f) => s + f.size, 0))}
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
                            <a href={file.url} target="_blank" rel="noopener noreferrer" download>
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
                    <p className="font-headline text-[10px] tracking-widest uppercase">The DropBox Hub is currently empty.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="bg-muted/10 border-t p-3 justify-center">
            <p className="text-[8px] font-black uppercase text-muted-foreground tracking-[0.2em]">MISSION CONTROL ASSET SYNCHRONIZATION</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
