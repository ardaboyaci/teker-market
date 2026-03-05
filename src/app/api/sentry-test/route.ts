import { NextResponse } from 'next/server';

export async function GET() {
    // Purposefully throw an error to test the Sentry integration
    throw new Error('Sentry Test Error from TekerMarket API Route');

    return NextResponse.json({ message: 'Bu yanit asla donmeyecek cünkü hata firlatildi.' });
}
