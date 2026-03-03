'use client';
import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import type { Member } from '@/lib/types';
import { EditMemberForm } from '@/components/members/edit-member-form';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc } from 'firebase/firestore';
import { updateMember, deleteMember } from '@/firebase/firestore/members';
import { useFirebase } from '@/firebase/provider';


export default function EditMemberPage() {
  const router = useRouter();
  const params = useParams();
  const memberId = params.memberId as string;
  const { db } = useFirebase();

  const memberRef = useMemo(() => {
    if (!db || !memberId) return null;
    return doc(db, 'members', memberId);
  }, [db, memberId]);
  
  const { data: member, loading, error } = useDoc<Member>(memberRef);

  const handleUpdateMember = (updatedMember: Member) => {
    console.log('Updating member:', updatedMember);
    updateMember(memberId, updatedMember);
    router.push('/dashboard');
  };

  const handleDeleteMember = (id: string) => {
    console.log('Deleting member:', id);
    deleteMember(id);
    router.push('/dashboard');
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error loading member.</div>
  }

  if (!member) {
    return <div>Member not found</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-4xl tracking-wider text-foreground">
          Edit Member
        </h1>
        <p className="mt-2 text-muted-foreground">
          Editing details for <span className="font-bold text-primary">{member.name}</span>
        </p>
      </div>
      <EditMemberForm 
        member={member} 
        onUpdate={handleUpdateMember} 
        onDelete={handleDeleteMember}
      />
    </div>
  );
}
