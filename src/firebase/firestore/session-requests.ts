
'use client';

import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export interface SessionRequestPartyMember {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface SessionRequest {
  id: string;
  primaryMemberId: string;
  primaryMemberName: string;
  primaryMemberAvatar: string;
  partyMembers: SessionRequestPartyMember[]; // includes primary
  status: 'pending' | 'approved' | 'denied';
  timestamp: string;
}

/**
 * Creates a new session request from the scan page.
 */
export const createSessionRequest = async (
  primary: SessionRequestPartyMember,
  party: SessionRequestPartyMember[]
): Promise<string | null> => {
  const db = getFirestore();
  try {
    const ref = await addDoc(collection(db, 'sessionRequests'), {
      primaryMemberId: primary.id,
      primaryMemberName: primary.name,
      primaryMemberAvatar: primary.avatarUrl,
      partyMembers: party,
      status: 'pending',
      timestamp: new Date().toISOString(),
    });
    return ref.id;
  } catch (e) {
    console.error('Error creating session request:', e);
    return null;
  }
};

/**
 * Approves or denies a session request.
 */
export const updateSessionRequest = async (
  requestId: string,
  status: 'approved' | 'denied'
) => {
  const db = getFirestore();
  try {
    await updateDoc(doc(db, 'sessionRequests', requestId), { status });
  } catch (e) {
    console.error('Error updating session request:', e);
  }
};

/**
 * Deletes a session request (cleanup after handling).
 */
export const deleteSessionRequest = async (requestId: string) => {
  const db = getFirestore();
  try {
    await deleteDoc(doc(db, 'sessionRequests', requestId));
  } catch (e) {
    console.error('Error deleting session request:', e);
  }
};
