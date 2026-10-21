import { NextRequest, NextResponse } from 'next/server';
import { apiUrl, projectId, cookieName, workspaceUrl, privatePortal, entryOverride, adminOnly } from './lib/workspace-sso';
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === '/sso' || path.startsWith('/api/sso') || path.startsWith('/_next/') || /\.(?:png|jpe?g|svg|ico|webp|woff2?|css|js|map)$/.test(path)) return NextResponse.next();
  const loginPage = ['/login', '/signup', '/admin/login', '/forgot-password', '/reset-password'].includes(path);
  const protectedRoute = privatePortal || path.startsWith('/dashboard') || path.startsWith('/admin') || path.startsWith('/api/');
  if (!loginPage && !protectedRoute) return NextResponse.next();
  const token = request.cookies.get(cookieName)?.value;
  if (!token) {
    if (path.startsWith('/api/')) return NextResponse.json({ message: 'Open this project from your workspace' }, { status: 401 });
    return NextResponse.redirect(new URL(workspaceUrl));
  }
  try {
    const response = await fetch(`${apiUrl}/workspace/introspect`, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ project: projectId }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      if (response.status >= 500) return new NextResponse('The workspace service is unavailable. Please try again.', { status: 503 });
      const redirect = NextResponse.redirect(new URL(workspaceUrl)); redirect.cookies.delete(cookieName); return redirect;
    }
    const session = await response.json();
    if (session.access !== 'ADMIN' && (adminOnly || path.startsWith('/admin') || path.startsWith('/dashboard/admin') || path.startsWith('/dashboard/admins') || path.startsWith('/api/admin'))) return new NextResponse('Your developer has assigned user access. Admin access is required for this page.', { status: 403 });
    if (loginPage || privatePortal && path === '/' && entryOverride !== '/') {
      const redirect = NextResponse.redirect(new URL(workspaceUrl));
      redirect.cookies.delete(cookieName);
      return redirect;
    }
    return NextResponse.next();
  } catch { return new NextResponse('Unable to validate your workspace access. Please try again.', { status: 503 }); }
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
