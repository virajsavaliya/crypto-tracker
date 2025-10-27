// File: app/api/webhook/route.ts

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Add this log to see if your webhook is being hit

  // Use the request parameter if needed
  await request.text();

  // Send a 200 OK response to Stripe
  return NextResponse.json({ message: "Webhook received successfully" }, { status: 200 });
}