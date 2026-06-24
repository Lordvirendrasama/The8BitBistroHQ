'use client';
import { useState, useMemo, useRef } from 'react';
import type { Task, TaskFormData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash, Edit, Sun, Moon, Upload } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { addTask, updateTask, deleteTask, addTasks } from '@/firebase/firestore/tasks';
import { TaskFormModal } from './task-form-modal';
import { logUserAction } from '@/firebase/firestore/logs';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';

function parseCSV(text: string): Record<string, string>[] {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentLine += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === '\n' || char === '\r') {
      if (inQuotes) {
        currentLine += char;
      } else {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        lines.push(currentLine);
        currentLine = '';
      }
    } else {
      currentLine += char;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  
  if (lines.length === 0) return [];
  
  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',') {
        if (inQuotes) {
          cell += ',';
        } else {
          cells.push(cell.trim());
          cell = '';
        }
      } else {
        cell += char;
      }
    }
    cells.push(cell.trim());
    return cells;
  };
  
  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const results: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    results.push(obj);
  }
  
  return results;
}

export function TaskManager() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    logUserAction("Clicked 'Import CSV' button.");
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) {
        toast({
          variant: 'destructive',
          title: 'Empty File',
          description: 'The selected CSV file is empty.',
        });
        return;
      }

      try {
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          toast({
            variant: 'destructive',
            title: 'No Data Found',
            description: 'Could not find any data rows in the CSV file.',
          });
          return;
        }

        const validTasks: TaskFormData[] = [];
        const errors: string[] = [];

        parsed.forEach((row, index) => {
          const rowNum = index + 2;

          const name = (row.name || row.taskname || row.title || row.task || '').trim();
          const typeInput = (row.type || row.tasktype || '').trim().toLowerCase();
          const ownerOnlyStr = (row.owneronly || row.owner_only || '').trim().toLowerCase();
          const role = (row.role || '').trim().toLowerCase();

          // Skip completely empty rows (blank lines, rows with just commas/spaces)
          if (!name && !typeInput && !ownerOnlyStr && !role) {
            return;
          }

          if (!name) {
            errors.push(`Row ${rowNum}: Task name is empty.`);
            return;
          }

          let type: 'start-of-day' | 'end-of-day' | 'strategic';
          const typeNormalized = typeInput.replace(/[\s_-]+/g, '');
          if (['startofday', 'start', 'opening', 'open'].includes(typeNormalized)) {
            type = 'start-of-day';
          } else if (['endofday', 'end', 'closing', 'close'].includes(typeNormalized)) {
            type = 'end-of-day';
          } else if (['strategic', 'strat', 'owner'].includes(typeNormalized)) {
            type = 'strategic';
          } else {
            errors.push(`Row ${rowNum}: Invalid type '${typeInput}'. Must be start-of-day, end-of-day, or strategic (or aliases like opening, closing, owner).`);
            return;
          }

          const ownerOnly = ['true', 'yes', '1'].includes(ownerOnlyStr) || role === 'owner';

          validTasks.push({
            name,
            type,
            ownerOnly,
          });
        });

        if (errors.length > 0) {
          const displayedErrors = errors.slice(0, 3).join('\n');
          const remainingCount = errors.length - 3;
          toast({
            variant: 'destructive',
            title: 'Import Validation Failed',
            description: (
              <div className="whitespace-pre-line text-xs font-mono mt-1 text-left">
                {displayedErrors}
                {remainingCount > 0 && `\n...and ${remainingCount} more error(s)`}
              </div>
            ) as any,
          });
          return;
        }

        const success = await addTasks(validTasks);
        if (success) {
          toast({
            title: 'Tasks Imported',
            description: `Successfully imported ${validTasks.length} shift tasks.`,
          });
          logUserAction(`Imported ${validTasks.length} shift tasks from CSV.`);
        } else {
          toast({
            variant: 'destructive',
            title: 'Import Failed',
            description: 'An error occurred while saving the tasks to the database.',
          });
        }
      } catch (err) {
        console.error(err);
        toast({
          variant: 'destructive',
          title: 'Import Error',
          description: 'An error occurred while parsing the CSV file.',
        });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const tasksCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'tasks');
  }, [db]);

  const { data: tasks, loading, error } = useCollection<Task>(tasksCollection);

  const sortedTasks = useMemo(() => {
    if (!tasks) return [];
    return [...tasks].sort((a, b) => {
      if (a.type < b.type) return -1;
      if (a.type > b.type) return 1;
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });
  }, [tasks]);

  const handleAdd = () => {
    setSelectedTask(null);
    setModalOpen(true);
    logUserAction("Clicked 'Add Shift Task' button.");
  };

  const handleEdit = (task: Task) => {
    setSelectedTask(task);
    setModalOpen(true);
    logUserAction(`Clicked 'Edit' for shift task '${task.name}'.`, { taskId: task.id });
  };

  const handleDelete = (task: Task) => {
    deleteTask(task.id, task.name);
    toast({
      variant: 'destructive',
      title: 'Task Deleted',
      description: `${task.name} has been removed.`,
    });
  };
  
  const handleSave = (formData: TaskFormData) => {
    if(selectedTask) {
      updateTask(selectedTask.id, formData);
       toast({
        title: 'Task Updated',
        description: `${formData.name} has been successfully updated.`,
      });
    } else {
      addTask(formData);
      toast({
        title: 'Task Added',
        description: `${formData.name} has been successfully added.`,
      });
    }
  }

  return (
    <Card className="overflow-hidden border-2 shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-headline tracking-wide text-2xl">Manage Shift Tasks</CardTitle>
            <CardDescription>Add, edit, or remove the daily tasks for employee shifts.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />
            <Button size="sm" variant="outline" className="font-bold tracking-wider" onClick={handleImportClick}>
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <Button size="sm" className="font-bold tracking-wider" onClick={handleAdd}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && <p>Loading tasks...</p>}
        {error && <p className="text-destructive">Error loading tasks: {error.message}</p>}
        {sortedTasks && (
          <ScrollArea className="h-[600px] rounded-xl border-2 border-dashed">
            <Table>
                <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                <TableRow>
                    <TableHead className="bg-muted/30">Task Name</TableHead>
                    <TableHead className="bg-muted/30">Type</TableHead>
                    <TableHead className="text-right bg-muted/30">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {sortedTasks.map((task) => (
                    <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.name}</TableCell>
                    <TableCell>
                        <Badge variant={task.type === 'start-of-day' ? 'default' : 'secondary'} className={cn(task.type === 'start-of-day' && 'bg-blue-500 hover:bg-blue-600')}>
                        <div className="flex items-center gap-2">
                            {task.type === 'start-of-day' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                            {task.type.replace(/-/g, ' ')}
                        </div>
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleEdit(task)}
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => logUserAction(`Opened 'Delete Task' dialog for ${task.name}.`)}
                            >
                              <Trash className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the task <strong>{task.name}</strong>.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => logUserAction('Cancelled task deletion.')}>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(task)} className="bg-destructive hover:bg-destructive/90">
                                Yes, delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                    </TableRow>
                ))}
                {sortedTasks.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center">No tasks found. Add one to get started!</TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
      <TaskFormModal 
        isOpen={modalOpen} 
        onOpenChange={setModalOpen}
        onSave={handleSave}
        task={selectedTask}
      />
    </Card>
  );
}
