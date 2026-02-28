import { NextResponse } from 'next/server';
import { getFirestore, collection, query, where, getDocs, doc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase/init';
import type { Member } from '@/lib/types';

// IMPORTANT: How to use this API route
// 1. You must have a WhatsApp Business Account and access to the Cloud API.
//    Follow the guide here: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
// 2. Create a `.env.local` file in the root of your project.
// 3. Add your WhatsApp API credentials to the `.env.local` file:
//    WHATSAPP_API_TOKEN="YOUR_PERMANENT_API_TOKEN"
//    WHATSAPP_PHONE_NUMBER_ID="YOUR_PHONE_NUMBER_ID"
// 4. Update the `WHATSAPP_API_VERSION` if needed.

const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_API_VERSION = 'v20.0';


async function getMemberPhoneNumbers(memberIds: string[]): Promise<string[]> {
    if (!memberIds || memberIds.length === 0) {
        return [];
    }
    const { db } = initializeFirebase();
    const membersRef = collection(db, 'members');
    const q = query(membersRef, where('__name__', 'in', memberIds));
    const querySnapshot = await getDocs(q);

    const phoneNumbers: string[] = [];
    querySnapshot.forEach((doc) => {
        const member = doc.data() as Member;
        if (member.phone) {
            const cleanedPhone = member.phone.replace(/\D/g, '');
            phoneNumbers.push(cleanedPhone);
        }
    });

    return phoneNumbers;
}

async function sendWhatsAppMessage(phoneNumber: string, message: string) {
    if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
        throw new Error('WhatsApp API credentials are not configured in environment variables.');
    }
    
    const apiUrl = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const body = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: {
            preview_url: false,
            body: message,
        },
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error(`Failed to send message to ${phoneNumber}:`, errorData);
        throw new Error(`WhatsApp API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    return await response.json();
}


export async function POST(req: Request) {
    try {
        const { memberIds, message } = await req.json();

        if (!memberIds || memberIds.length === 0 || !message) {
            return NextResponse.json({ error: 'Missing memberIds or message' }, { status: 400 });
        }

        const phoneNumbers = await getMemberPhoneNumbers(memberIds);
        
        let sentCount = 0;
        let failedCount = 0;

        for (const number of phoneNumbers) {
            try {
                await sendWhatsAppMessage(number, message);
                sentCount++;
            } catch (e) {
                console.error(`Error sending to ${number}:`, e);
                failedCount++;
            }
        }

        return NextResponse.json({ 
            message: 'Broadcast processing complete.',
            sentCount,
            failedCount,
        });

    } catch (error: any) {
        console.error('Broadcast API Error:', error);
        return NextResponse.json({ error: error.message || 'An internal server error occurred.' }, { status: 500 });
    }
}
