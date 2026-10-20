import { NextResponse } from 'next/server';

// Unique deployment identifier (git commit sha, vercel deployment id, or boot timestamp)
const deploymentVersion = 
  process.env.VERCEL_GIT_COMMIT_SHA || 
  process.env.VERCEL_DEPLOYMENT_ID || 
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 
  `build_${Date.now()}`;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    {
      version: deploymentVersion,
      timestamp: Date.now()
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }
  );
}
