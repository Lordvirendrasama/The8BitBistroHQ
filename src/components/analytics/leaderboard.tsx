
'use client';
import { useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import type { Member } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Crown } from 'lucide-react';
import Image from 'next/image';
import { useFirebase } from '@/firebase/provider';

export function Leaderboard() {
  const { db } = useFirebase();
  const membersCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'members');
  }, [db]);
  const { data: members, loading, error } = useCollection<Member>(membersCollection);

  const sortedMembers = useMemo(() => {
    if (!members) return [];
    return [...members].sort((a, b) => b.xp - a.xp).slice(0, 10);
  }, [members]);

  const getRankColor = (rank: number) => {
    if (rank === 0) return 'text-yellow-400';
    if (rank === 1) return 'text-gray-400';
    if (rank === 2) return 'text-yellow-600';
    return 'text-muted-foreground';
  };

  if (loading) return <Card><CardHeader><CardTitle>Leaderboard</CardTitle></CardHeader><CardContent>Loading...</CardContent></Card>;
  if (error) return <Card><CardHeader><CardTitle>Leaderboard</CardTitle></CardHeader><CardContent>Error loading members.</CardContent></Card>;

  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="font-headline tracking-wide text-xl">Leaderboard</CardTitle>
        <CardDescription className="text-xs">Top members by total XP.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] px-2">Rank</TableHead>
              <TableHead className="px-2">Member</TableHead>
              <TableHead className="text-right px-2">XP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMembers.map((member, index) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium p-2">
                  <div className="flex items-center justify-center">
                    {index < 3 ? (
                      <Crown className={`h-5 w-5 ${getRankColor(index)}`} />
                    ) : (
                      <span className="text-sm">{index + 1}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="p-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <Image src={member.avatarUrl} alt={member.name} width={32} height={32} data-ai-hint="pixel avatar" />
                      <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">{member.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-bold text-sm p-2">{member.xp.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
