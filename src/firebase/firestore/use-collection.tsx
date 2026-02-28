'use client';
import { useState, useEffect } from 'react';
import { onSnapshot, Query, DocumentData, QuerySnapshot, FirestoreError } from 'firebase/firestore';

export const useCollection = <T extends DocumentData>(query: Query<DocumentData> | null) => {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!query) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot) => {
        const data: T[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
        setData(data);
        setLoading(false);
      },
      (err: FirestoreError) => {
        setError(err);
        setLoading(false);
        console.error(err);
      }
    );

    return () => unsubscribe();
  }, [query]);

  return { data, loading, error };
};
