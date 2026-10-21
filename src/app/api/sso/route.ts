import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { projectId, apiUrl, cookieName, workspaceUrl, entryOverride, adminOnly } from '../../../lib/workspace-sso';
export const dynamic = 'force-dynamic';
function sameOrigin(request: NextRequest) {
  try { return new URL(request.headers.get('origin') || '').host === request.headers.get('host'); } catch { return false; }
}
async function inspect(token: string) {
  return fetch(`${apiUrl}/workspace/introspect`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ project: projectId }), cache: 'no-store', signal: AbortSignal.timeout(15000) });
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ message: 'Invalid origin' }, { status: 403 });
  const secret = process.env.WORKSPACE_PROJECT_SECRET;
  if (!secret) return NextResponse.json({ message: 'Project SSO is not configured. Ask your developer to set WORKSPACE_PROJECT_SECRET.' }, { status: 503 });
  try {
    const { code } = await request.json();
    const upstream = await fetch(`${apiUrl}/workspace/redeem`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-project-secret': secret }, body: JSON.stringify({ code, project: projectId }), cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const data = await upstream.json();
    if (upstream.ok && adminOnly && data.access !== 'ADMIN') return NextResponse.json({ message: 'Admin project access is required', workspaceUrl }, { status: 403 });
    if (upstream.ok && entryOverride) data.path = entryOverride;
    const response = NextResponse.json({ ...data, workspaceUrl }, { status: upstream.status, headers: { 'Cache-Control': 'no-store' } });
    if (upstream.ok) response.cookies.set(cookieName, data.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 28800 });
    return response;
  } catch { return NextResponse.json({ message: 'Unable to connect to the workspace service' }, { status: 503 }); }
}
export async function GET() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return NextResponse.json({ message: 'Open this project from your workspace', workspaceUrl }, { status: 401 });
  try {
    const upstream = await inspect(token); const data = await upstream.json();
    const access = data.access;
    const path = projectId === 'realty' && access === 'ADMIN' ? '/admin' : ['cbt', 'mip'].includes(projectId) && access === 'ADMIN' ? '/dashboard/admin' : ['media', 'analytics', 'realty'].includes(projectId) ? '/' : '/dashboard';
    if (upstream.ok && adminOnly && data.access !== 'ADMIN') return NextResponse.json({ message: 'Admin project access is required', workspaceUrl }, { status: 403 });
    return NextResponse.json({ ...data, ...(upstream.ok ? { token, path: entryOverride || path } : {}), workspaceUrl }, { status: upstream.status, headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ message: 'Unable to validate your access', workspaceUrl }, { status: 503 }); }
}
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({}, { status: 403 });
  const response = NextResponse.json({ workspaceUrl }); response.cookies.delete(cookieName); return response;
}
