
'use client';
import { getFirestore, collection, addDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import type { AdminNotification, AdminNotificationType } from '@/lib/types';
import type { CustomUser } from '../auth/use-user';

export const createAdminNotification = async (message: string, triggeredByUser: CustomUser, type: AdminNotificationType = 'INCOMPLETE_SHIFT') => {
    const db = getFirestore();
    const notificationsCollection = collection(db, 'adminNotifications');
    
    const notification: Omit<AdminNotification, 'id'> = {
        message,
        type,
        isRead: false,
        timestamp: new Date().toISOString(),
        triggeredBy: {
            username: triggeredByUser.username,
            displayName: triggeredByUser.displayName,
            role: triggeredByUser.role,
        }
    };

    try {
        await addDoc(notificationsCollection, notification);
    } catch (e) {
        console.error("Error creating admin notification: ", e);
    }
};

export const dismissAdminNotification = async (notificationId: string) => {
    const db = getFirestore();
    const notificationRef = doc(db, 'adminNotifications', notificationId);
    try {
        await updateDoc(notificationRef, { isRead: true });
    } catch (e) {
        console.error("Error dismissing admin notification: ", e);
    }
};

export const dismissAllAdminNotifications = async (notificationIds: string[]) => {
    if (!notificationIds || notificationIds.length === 0) return;
    const db = getFirestore();
    
    const chunkSize = 450;
    const chunks: string[][] = [];
    for (let i = 0; i < notificationIds.length; i += chunkSize) {
        chunks.push(notificationIds.slice(i, i + chunkSize));
    }

    try {
        await Promise.all(chunks.map(async (chunk) => {
            const batch = writeBatch(db);
            chunk.forEach(id => {
                const ref = doc(db, 'adminNotifications', id);
                batch.update(ref, { isRead: true });
            });
            await batch.commit();
        }));
    } catch (e) {
        console.error("Error dismissing all admin notifications: ", e);
        throw e;
    }
};

