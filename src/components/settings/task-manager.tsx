'use client';
import { useState, useMemo } from 'react';
import type { Task, TaskFormData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash, Edit, Sun, Moon } from 'lucide-react';
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
import { addTask, updateTask, deleteTask } from '@/firebase/firestore/tasks';
import { TaskFormModal } from './task-form-modal';
import { logUserAction } from '@/firebase/firestore/logs';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';

export function TaskManager() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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
          <Button size="sm" className="font-bold tracking-wider" onClick={handleAdd}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Task
          </Button>
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
                        <AlertDialog>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onSelect={() => handleEdit(task)}>
                                <Edit className="mr-2 h-4 w-4" />Edit
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem 
                                    className="text-destructive"
                                    onSelect={() => logUserAction(`Opened 'Delete Task' dialog for ${task.name}.`)}
                                >
                                <Trash className="mr-2 h-4 w-4" />Delete
                            </DropdownMenuItem>
                            </AlertDialogTrigger>
                            </DropdownMenuContent>
                        </DropdownMenu>
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
