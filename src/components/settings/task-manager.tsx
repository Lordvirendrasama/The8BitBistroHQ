'use client';
import { useState, useMemo, useRef } from 'react';
import type { Task, TaskFormData, Employee } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash, Edit, Sun, Moon, Upload, ArrowUpDown, ArrowUp, ArrowDown, User, Clock, ArrowRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
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
import { addTask, updateTask, deleteTask, addTasks, bulkUpdateTasks, bulkDeleteTasks } from '@/firebase/firestore/tasks';
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
  const [sortField, setSortField] = useState<'name' | 'shiftType'>('shiftType');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const handleSort = (field: 'name' | 'shiftType') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    logUserAction(`Sorted tasks by ${field} ${sortField === field && sortDirection === 'asc' ? 'descending' : 'ascending'}.`);
  };

  const handleBulkAssign = async (assignedTo: string[]) => {
    const success = await bulkUpdateTasks(selectedTaskIds, { assignedTo });
    if (success) {
      toast({
        title: 'Tasks Updated',
        description: `Successfully assigned ${selectedTaskIds.length} tasks.`,
      });
      setSelectedTaskIds([]);
    } else {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'An error occurred while bulk updating tasks.',
      });
    }
  };

  const handleBulkChangeType = async (shiftType: 'opening' | 'closing' | 'both') => {
    const success = await bulkUpdateTasks(selectedTaskIds, { 
      shiftType,
      type: shiftType === 'opening' ? 'start-of-day' : shiftType === 'closing' ? 'end-of-day' : 'strategic'
    });
    if (success) {
      toast({
        title: 'Tasks Updated',
        description: `Successfully updated shift timing for ${selectedTaskIds.length} tasks.`,
      });
      setSelectedTaskIds([]);
    } else {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'An error occurred while bulk updating tasks.',
      });
    }
  };

  const handleBulkDelete = async () => {
    const success = await bulkDeleteTasks(selectedTaskIds);
    if (success) {
      toast({
        title: 'Tasks Deleted',
        description: `Successfully deleted ${selectedTaskIds.length} tasks.`,
      });
      setSelectedTaskIds([]);
    } else {
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: 'An error occurred while bulk deleting tasks.',
      });
    }
  };

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

          let shiftType: 'opening' | 'closing' | 'both';
          const typeNormalized = typeInput.replace(/[\s_-]+/g, '');
          if (['opening', 'open', 'startofday', 'start'].includes(typeNormalized)) {
            shiftType = 'opening';
          } else if (['closing', 'close', 'endofday', 'end'].includes(typeNormalized)) {
            shiftType = 'closing';
          } else if (['both', 'all', 'strategic', 'strat', 'owner'].includes(typeNormalized)) {
            shiftType = 'both';
          } else {
            errors.push(`Row ${rowNum}: Invalid type '${typeInput}'. Must be opening, closing, or both (or aliases).`);
            return;
          }

          const ownerOnly = ['true', 'yes', '1'].includes(ownerOnlyStr) || role === 'owner';
          const assignedToStr = (row.assignedto || row.assigned_to || row.assignee || row.employees || '').trim();
          const assignedTo = assignedToStr ? assignedToStr.split(/[;,]+/).map(s => s.trim()).filter(Boolean) : [];

          validTasks.push({
            name,
            shiftType,
            type: shiftType === 'opening' ? 'start-of-day' : shiftType === 'closing' ? 'end-of-day' : 'strategic',
            ownerOnly,
            assignedTo,
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

  const employeesCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'employees');
  }, [db]);

  const { data: employees } = useCollection<Employee>(employeesCollection);

  const activeEmployees = useMemo(() => {
    if (!employees) return [];
    return employees.filter(e => e.isActive);
  }, [employees]);

  const sortedTasks = useMemo(() => {
    if (!tasks) return [];
    return [...tasks].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
        if (comparison === 0) {
          const typeA = a.shiftType || a.type || '';
          const typeB = b.shiftType || b.type || '';
          comparison = typeA.localeCompare(typeB);
        }
      } else {
        const typeA = a.shiftType || a.type || '';
        const typeB = b.shiftType || b.type || '';
        comparison = typeA.localeCompare(typeB);
        if (comparison === 0) {
          comparison = a.name.localeCompare(b.name);
        }
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [tasks, sortField, sortDirection]);

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
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="font-headline tracking-wide text-2xl">Manage Shift Tasks</CardTitle>
              {tasks && (
                <Badge variant="secondary" className="font-mono text-xs font-bold px-2 py-0.5 rounded-full">
                  {tasks.length}
                </Badge>
              )}
            </div>
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
        {selectedTaskIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 mb-4 bg-muted/20 border-2 border-dashed rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-muted/50">
                {selectedTaskIds.length}
              </Badge>
              <span className="text-xs font-black uppercase text-muted-foreground tracking-wider">Tasks Selected</span>
            </div>
            
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="text-xs font-bold uppercase tracking-tight gap-1.5 border-2">
                    <User className="h-3.5 w-3.5" /> Assign to...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2 font-body" align="end">
                  <div className="space-y-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-start font-bold uppercase text-[10px] text-muted-foreground"
                      onClick={() => handleBulkAssign([])}
                    >
                      All Employees (Unassigned)
                    </Button>
                    {activeEmployees.map(emp => (
                      <Button 
                        key={emp.id}
                        variant="ghost" 
                        size="sm" 
                        className="w-full justify-start font-bold text-xs"
                        onClick={() => handleBulkAssign([emp.username])}
                      >
                        {emp.displayName} ({emp.username})
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="text-xs font-bold uppercase tracking-tight gap-1.5 border-2">
                    <Clock className="h-3.5 w-3.5" /> Change Shift...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2 font-body" align="end">
                  <div className="space-y-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-start font-bold text-xs"
                      onClick={() => handleBulkChangeType('opening')}
                    >
                      <Sun className="h-3.5 w-3.5 mr-1.5 text-blue-500" /> Opening Shift
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-start font-bold text-xs"
                      onClick={() => handleBulkChangeType('closing')}
                    >
                      <Moon className="h-3.5 w-3.5 mr-1.5 text-zinc-400" /> Closing Shift
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-start font-bold text-xs"
                      onClick={() => handleBulkChangeType('both')}
                    >
                      <PlusCircle className="h-3.5 w-3.5 mr-1.5 text-primary" /> Both Shifts
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="text-xs font-bold uppercase tracking-tight gap-1.5">
                    <Trash className="h-3.5 w-3.5" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="font-body">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the <strong>{selectedTaskIds.length}</strong> selected tasks.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">
                      Yes, delete selected
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
        {loading && <p>Loading tasks...</p>}
        {error && <p className="text-destructive">Error loading tasks: {error.message}</p>}
        {sortedTasks && (
          <ScrollArea className="h-[600px] rounded-xl border-2 border-dashed">
            <Table>
                <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                <TableRow>
                    <TableHead className="w-12 bg-muted/30">
                      <Checkbox 
                        checked={sortedTasks.length > 0 && selectedTaskIds.length === sortedTasks.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTaskIds(sortedTasks.map(t => t.id));
                          } else {
                            setSelectedTaskIds([]);
                          }
                        }}
                        className="border-2"
                      />
                    </TableHead>
                    <TableHead 
                      className="bg-muted/30 cursor-pointer select-none hover:bg-muted/40 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        Task Name
                        {sortField === 'name' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="bg-muted/30 cursor-pointer select-none hover:bg-muted/40 transition-colors"
                      onClick={() => handleSort('shiftType')}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        Shift Type
                        {sortField === 'shiftType' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="text-right bg-muted/30">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                 {sortedTasks.map((task) => (
                    <TableRow key={task.id} className={cn(selectedTaskIds.includes(task.id) && "bg-muted/10")}>
                    <TableCell className="w-12">
                      <Checkbox 
                        checked={selectedTaskIds.includes(task.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTaskIds(prev => [...prev, task.id]);
                          } else {
                            setSelectedTaskIds(prev => prev.filter(id => id !== task.id));
                          }
                        }}
                        className="border-2"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        <span>{task.name}</span>
                        {task.assignedTo && task.assignedTo.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {task.assignedTo.map(username => {
                              const emp = employees?.find(e => e.username === username);
                              return (
                                <Badge key={username} variant="outline" className="text-[8px] h-4 bg-muted/40 font-bold uppercase tracking-wider">
                                  {emp ? emp.displayName : username}
                                </Badge>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter mt-1">All Employees</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                        <Badge 
                          variant={(task.shiftType || task.type) === 'opening' || (task.shiftType || task.type) === 'start-of-day' ? 'default' : 'secondary'} 
                          className={cn(((task.shiftType || task.type) === 'opening' || (task.shiftType || task.type) === 'start-of-day') && 'bg-blue-500 hover:bg-blue-600')}
                        >
                        <div className="flex items-center gap-2 font-bold uppercase text-[9px]">
                            {((task.shiftType || task.type) === 'opening' || (task.shiftType || task.type) === 'start-of-day') ? (
                              <Sun className="h-3.5 w-3.5" />
                            ) : ((task.shiftType || task.type) === 'closing' || (task.shiftType || task.type) === 'end-of-day') ? (
                              <Moon className="h-3.5 w-3.5 text-zinc-400" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-primary" />
                            )}
                            {(task.shiftType || task.type || '').replace(/-/g, ' ')}
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
                        <TableCell colSpan={4} className="h-24 text-center">No tasks found. Add one to get started!</TableCell>
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
        employees={activeEmployees}
      />
    </Card>
  );
}
