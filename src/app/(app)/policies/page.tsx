'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { useFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { addPolicySection, updatePolicySection, deletePolicySection } from '@/firebase/firestore/policies';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { logUserAction } from '@/firebase/firestore/logs';
import { 
  BookOpen, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  Sparkles,
  ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PolicySection } from '@/lib/types';

function parseMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];

  const parseInline = (str: string): React.ReactNode[] => {
    const parts = str.split('**');
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index} className="font-extrabold text-foreground">{part}</strong>;
      }
      return part;
    });
  };

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.substring(2);
      currentList.push(
        <li key={`${lineIndex}-li`} className="ml-5 list-disc mt-1 text-sm text-foreground/85 leading-relaxed">
          {parseInline(content)}
        </li>
      );
    } else {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`${lineIndex}-ul`} className="my-2 space-y-1">
            {currentList}
          </ul>
        );
        currentList = [];
      }

      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={lineIndex} className="text-base font-black uppercase tracking-tight text-primary mt-4 mb-2">
            {parseInline(trimmed.substring(4))}
          </h3>
        );
      } else if (trimmed.startsWith('#### ')) {
        elements.push(
          <h4 key={lineIndex} className="text-sm font-bold uppercase text-foreground/90 mt-3 mb-1.5">
            {parseInline(trimmed.substring(5))}
          </h4>
        );
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={lineIndex} className="text-lg font-black uppercase tracking-tight text-primary mt-5 mb-3 border-b-2 pb-1 border-primary/20">
            {parseInline(trimmed.substring(3))}
          </h2>
        );
      } else if (trimmed.startsWith('# ')) {
        elements.push(
          <h1 key={lineIndex} className="text-xl font-black uppercase tracking-widest text-primary mt-6 mb-4 border-b-2 pb-1.5 border-primary/20">
            {parseInline(trimmed.substring(2))}
          </h1>
        );
      } else if (trimmed === '') {
        elements.push(<div key={lineIndex} className="h-2" />);
      } else {
        elements.push(
          <p key={lineIndex} className="text-sm text-foreground/80 leading-relaxed my-2">
            {parseInline(line)}
          </p>
        );
      }
    }
  });

  if (currentList.length > 0) {
    elements.push(
      <ul key={`final-ul`} className="my-2 space-y-1">
        {currentList}
      </ul>
    );
  }

  return <div className="space-y-1">{elements}</div>;
}

const DEFAULT_POLICIES = [
  {
    title: '1. Shift Attendance & Punctuality',
    content: '### Core Hours & Expectation\nAll staff members are expected to clock in on time. Shifts are scheduled from **11:00 AM** to **11:00 PM**.\n\n### Late Arrivals & Grace Period\n- A grace period of **5 minutes** is allowed.\n- Any arrivals after the grace period will be marked as **Late**.\n- Repeated late arrivals will trigger a review of shifts and performance multipliers.',
    order: 1
  },
  {
    title: '2. Professional Conduct & Customer Relations',
    content: '### Guest First Philosophy\nCustomers are the lifeblood of **The 8 Bit Bistro**.\n\n### Operational Rules\n- Always greet customers with a smile.\n- Explain gaming rates and packages politely.\n- Resolve disputes with a focus on guest satisfaction.\n- Ensure clean, friendly language at all times on the bistro floor.',
    order: 2
  },
  {
    title: '3. Station Maintenance & Hygiene',
    content: '### Cleaning Protocols\nCleanliness is a top priority for our gaming and dining spaces.\n\n### Key Duties\n- **Opening Shift**: Clean gaming controllers and wipe all stations.\n- **During Shift**: Wipe tables, mop floors, empty trash bins.\n- **Closing Shift**: Empty trash bins, sweep/mop floors, and clean washrooms.',
    order: 3
  },
  {
    title: '4. Financial Integrity & Registry Settlement',
    content: '### Reconciliation Guidelines\nEnsure physical cash matches system values perfectly.\n\n### Procedures\n- Always double-check cash transactions.\n- Verify UPI payments in real-time.\n- Hand over the register with **zero variance**.\n- Any discrepancies must be recorded and reported to **Viren** immediately.\n- Petty cash/expenses must have receipts uploaded.',
    order: 4
  }
];

export default function PoliciesPage() {
  const { user } = useAuth();
  const { db } = useFirebase();
  const { toast } = useToast();

  const isOwner = user?.username === 'Viren' || user?.role === 'admin';

  const policiesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'policies'), orderBy('order', 'asc'));
  }, [db]);

  const { data: policies, loading, error } = useCollection<PolicySection>(policiesQuery);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editOrder, setEditOrder] = useState<number>(1);

  // New section state
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newOrder, setNewOrder] = useState<number>(1);

  // Expanded card view state for staff
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleInitializeDefaults = async () => {
    try {
      for (const policy of DEFAULT_POLICIES) {
        await addPolicySection(policy.title, policy.content, policy.order);
      }
      toast({
        title: 'Policies Initialized',
        description: 'Successfully initialized the employee policies with defaults.',
      });
      logUserAction('Initialized default policies collection.');
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Initialization Failed',
        description: 'An error occurred while initializing default policies.',
      });
    }
  };

  const handleEditClick = (policy: PolicySection) => {
    setEditingId(policy.id);
    setEditTitle(policy.title);
    setEditContent(policy.content);
    setEditOrder(policy.order);
    logUserAction(`Started editing policy section: ${policy.title}`);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    logUserAction('Cancelled editing policy section.');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editTitle.trim() || !editContent.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Title and content cannot be empty.',
      });
      return;
    }

    const success = await updatePolicySection(id, editTitle, editContent);
    if (success) {
      toast({
        title: 'Policy Updated',
        description: `Successfully updated section "${editTitle}".`,
      });
      logUserAction(`Saved updates for policy section: ${editTitle}`);
      setEditingId(null);
    } else {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not save updates to the database.',
      });
    }
  };

  const handleAddClick = () => {
    setIsAdding(true);
    setNewTitle('');
    setNewContent('');
    // Auto-calculate next order
    const nextOrder = policies && policies.length > 0 ? Math.max(...policies.map(p => p.order)) + 1 : 1;
    setNewOrder(nextOrder);
    logUserAction('Opened "Add Policy Section" form.');
  };

  const handleSaveNew = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Title and content cannot be empty.',
      });
      return;
    }

    const docId = await addPolicySection(newTitle, newContent, newOrder);
    if (docId) {
      toast({
        title: 'Policy Section Added',
        description: `Successfully created "${newTitle}".`,
      });
      logUserAction(`Created new policy section: ${newTitle}`, { policyId: docId });
      setIsAdding(false);
      setNewTitle('');
      setNewContent('');
    } else {
      toast({
        variant: 'destructive',
        title: 'Add Failed',
        description: 'An error occurred while creating the policy section.',
      });
    }
  };

  const handleDeleteClick = async (policy: PolicySection) => {
    if (confirm(`Are you sure you want to delete the policy section "${policy.title}"?`)) {
      const success = await deletePolicySection(policy.id, policy.title);
      if (success) {
        toast({
          title: 'Policy Deleted',
          description: `Successfully deleted "${policy.title}".`,
        });
        logUserAction(`Deleted policy section: ${policy.title}`);
      } else {
        toast({
          variant: 'destructive',
          title: 'Delete Failed',
          description: 'An error occurred while deleting the policy section.',
        });
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-body">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl tracking-wider text-foreground flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            Bistro Handbooks
          </h1>
          <p className="mt-2 text-muted-foreground font-black uppercase text-[10px] tracking-widest">
            Official operational guidelines and conduct policies for all staff.
          </p>
        </div>

        {isOwner && policies && policies.length > 0 && (
          <Button onClick={handleAddClick} size="sm" className="font-bold tracking-wider uppercase shrink-0">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Section
          </Button>
        )}
      </div>

      {loading && (
        <div className="py-20 text-center text-xs font-headline tracking-widest animate-pulse uppercase">
          Loading policies...
        </div>
      )}

      {error && (
        <Card className="border-destructive/30 bg-destructive/5 border-2 shadow-none">
          <CardContent className="py-8 flex flex-col items-center justify-center text-center gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="font-bold text-destructive">Error loading handbook data</p>
            <p className="text-xs text-muted-foreground">{error.message}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && policies && policies.length === 0 && (
        <Card className="border-2 border-dashed bg-muted/5">
          <CardContent className="text-center py-20 flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-primary/5 border-2 border-primary/10">
              <ClipboardList className="h-12 w-12 text-primary opacity-20" />
            </div>
            <div className="space-y-1">
              <p className="text-xl font-headline tracking-tighter uppercase">No handbook sections found</p>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                Initialize the default operational policies to get started.
              </p>
            </div>
            {isOwner ? (
              <Button onClick={handleInitializeDefaults} size="lg" className="mt-4 font-black uppercase tracking-widest h-12 px-8">
                <Sparkles className="mr-2 h-5 w-5 text-emerald-400" />
                Initialize Default Policies
              </Button>
            ) : (
              <p className="text-xs italic text-muted-foreground uppercase tracking-widest mt-2">No policies have been defined yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add New Section View */}
      {isAdding && (
        <Card className="border-2 border-primary/30 bg-primary/5 animate-in fade-in slide-in-from-top-4 duration-300 shadow-none overflow-hidden">
          <CardHeader className="bg-primary/10 border-b">
            <CardTitle className="text-lg flex items-center justify-between uppercase">
              <span>New Policy Section</span>
              <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => setIsAdding(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-title" className="font-bold text-xs uppercase text-muted-foreground">Section Title</Label>
              <Input
                id="new-title"
                placeholder="e.g. 5. Social Media & External Communications"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="font-bold bg-background border-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-content" className="font-bold text-xs uppercase text-muted-foreground">Section Content</Label>
              <Textarea
                id="new-content"
                placeholder="Enter detailed guidelines..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={6}
                className="font-body bg-background border-2 leading-relaxed"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsAdding(false)} className="font-bold uppercase tracking-wider text-xs">
                Cancel
              </Button>
              <Button onClick={handleSaveNew} className="font-bold uppercase tracking-wider text-xs">
                <Save className="mr-1.5 h-4 w-4" />
                Create Section
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main List Rendering */}
      {!loading && !error && policies && policies.length > 0 && (
        <div className="space-y-4">
          {policies.map((policy) => {
            const isEditing = editingId === policy.id;
            const isExpanded = !!expandedIds[policy.id];

            if (isEditing) {
              return (
                <Card key={policy.id} className="border-2 border-primary/50 shadow-none overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <CardHeader className="bg-primary/10 border-b">
                    <CardTitle className="text-lg flex items-center justify-between uppercase">
                      <span>Editing: {policy.title}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={handleCancelEdit}>
                        <X className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`edit-title-${policy.id}`} className="font-bold text-xs uppercase text-muted-foreground">Section Title</Label>
                      <Input
                        id={`edit-title-${policy.id}`}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="font-bold bg-background border-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`edit-content-${policy.id}`} className="font-bold text-xs uppercase text-muted-foreground">Section Content</Label>
                      <Textarea
                        id={`edit-content-${policy.id}`}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={6}
                        className="font-body bg-background border-2 leading-relaxed"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={handleCancelEdit} className="font-bold uppercase tracking-wider text-xs">
                        Cancel
                      </Button>
                      <Button onClick={() => handleSaveEdit(policy.id)} className="font-bold uppercase tracking-wider text-xs">
                        <Save className="mr-1.5 h-4 w-4" />
                        Save Changes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card 
                key={policy.id} 
                className={cn(
                  "border-2 shadow-none overflow-hidden transition-all duration-300",
                  isExpanded ? "border-primary/20 bg-muted/10" : "hover:border-muted-foreground/30 hover:bg-muted/5"
                )}
              >
                <div 
                  onClick={() => toggleExpand(policy.id)}
                  className="p-5 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <h2 className={cn("text-base font-black uppercase tracking-tight transition-colors", isExpanded ? "text-primary" : "text-foreground")}>
                      {policy.title}
                    </h2>
                  </div>
                  
                  <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {isOwner && (
                      <div className="flex items-center gap-1.5 mr-2">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleEditClick(policy)}
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteClick(policy)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    )}
                    
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => toggleExpand(policy.id)}
                    >
                      {isExpanded ? <ChevronUp className="h-5 w-5 text-primary" /> : <ChevronDown className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-6 border-t border-muted/20 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="font-body">
                      {parseMarkdown(policy.content)}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
