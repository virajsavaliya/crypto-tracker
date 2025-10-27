// frontend/src/app/api/health/route.ts
// Purpose: Health check endpoint for frontend monitoring
// Reduces server load: Provides frontend health status for load balancer
// Test: curl http://localhost:3000/api/health

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'frontend',
      version: '1.0.0',
      uptime: process.uptime(),
    };

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}