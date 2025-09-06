// File: app/api/webhook/route.ts

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Add this log to see if your webhook is being hit
  console.log("✅ Webhook received!");

  // Use the request parameter if needed
  const body = await request.text();
  console.log('Webhook body:', body);

  // Send a 200 OK response to Stripe
  return NextResponse.json({ message: "Webhook received successfully" }, { status: 200 });
}