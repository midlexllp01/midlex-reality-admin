'use client';
import { useEffect, useRef, useState } from 'react';

export default function WorkspaceSignIn() {
  const started = useRef(false);
  const [error, setError] = useState('');
  const [workspace, setWorkspace] = useState('');

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // 1. Direct client-side SSO handoff payload from Midlex Workspace
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    const search = typeof window !== 'undefined' ? window.location.search.slice(1) : '';
    const params = new URLSearchParams(hash || search);
    const ssoRaw = params.get('sso');

    if (ssoRaw) {
      try {
        const rawJson = atob(ssoRaw);
        const data = JSON.parse(decodeURIComponent(escape(rawJson)));
        const user = data.user || {};
        const admin = data.access === 'ADMIN' || user.role === 'DEVELOPER' || user.role === 'ADMIN';

        localStorage.setItem('midlex_token', data.token || 'workspace_sso_token');
        localStorage.setItem('midlex_user', JSON.stringify(user));

        // Subsystem compatibility storage
        const cbtSession = { ...user, role: admin ? 'ADMIN' : 'USER', candidateId: user.workspaceId || user.id, assignedExamIds: [] };
        localStorage.setItem('midlex_cbt_session', JSON.stringify(cbtSession));
        if (admin) localStorage.setItem('midlex_cbt_admin_session', JSON.stringify(cbtSession));

        localStorage.setItem('midlex_mip_session', JSON.stringify({ ...user, role: admin ? 'INTERNSHIP_ADMIN' : 'STUDENT_INTERN', internId: user.workspaceId || user.id, totalHoursLogged: 0 }));

        localStorage.setItem('midlex_hrms_user', JSON.stringify({ ...user, role: admin ? 'HR_ADMIN' : 'STAFF', staffId: user.id, department: 'GENERAL', staffCategory: 'SUPPORT_STAFF', supportRole: 'Staff', firstLoginSetupComplete: true }));
        if (admin) localStorage.setItem('midlex_hrms_admin_access', 'true');

        localStorage.setItem('midlex_realty_admin_token', data.token || 'workspace_sso_token');
        localStorage.setItem('midlex_realty_admin_user', JSON.stringify(user));

        localStorage.setItem('midlex_finance_token', data.token || 'workspace_sso_token');

        localStorage.setItem('midlex_ai_workspace_token', data.token || 'workspace_sso_token');
        localStorage.setItem('midlex_ai_workspace_user', JSON.stringify(user));

        const destPath = data.path || '/dashboard';
        window.history.replaceState(null, '', destPath);
        window.location.replace(destPath);
        return;
      } catch (err) {
        console.error('SSO handoff parse failed:', err);
      }
    }

    // 2. Fallback server-side code exchange
    const code = params.get('code');
    window.history.replaceState(null, '', '/sso');
    async function exchange() {
      try {
        const response = await fetch('/api/sso', code ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) } : { cache: 'no-store' });
        const data = await response.json();
        setWorkspace(data.workspaceUrl || '');
        if (!response.ok) throw new Error(data.message || 'The project link has expired. Open it again from your workspace.');
        const user = data.user;
        const admin = data.access === 'ADMIN' || user.role === 'DEVELOPER' || user.role === 'ADMIN';
        localStorage.setItem('midlex_token', data.token);
        localStorage.setItem('midlex_user', JSON.stringify(user));

        const cbtSession = { ...user, role: admin ? 'ADMIN' : 'USER', candidateId: user.workspaceId || user.id, assignedExamIds: [] };
        localStorage.setItem('midlex_cbt_session', JSON.stringify(cbtSession));
        if (admin) localStorage.setItem('midlex_cbt_admin_session', JSON.stringify(cbtSession));

        localStorage.setItem('midlex_mip_session', JSON.stringify({ ...user, role: admin ? 'INTERNSHIP_ADMIN' : 'STUDENT_INTERN', internId: user.workspaceId || user.id, totalHoursLogged: 0 }));

        localStorage.setItem('midlex_hrms_user', JSON.stringify({ ...user, role: admin ? 'HR_ADMIN' : 'STAFF', staffId: user.id, department: 'GENERAL', staffCategory: 'SUPPORT_STAFF', supportRole: 'Staff', firstLoginSetupComplete: true }));
        if (admin) localStorage.setItem('midlex_hrms_admin_access', 'true');

        localStorage.setItem('midlex_realty_admin_token', data.token);
        localStorage.setItem('midlex_realty_admin_user', JSON.stringify(user));

        window.location.replace(data.path || '/dashboard');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to open project');
      }
    }
    void exchange();
  }, []);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 20, padding: 30, fontFamily: 'Arial, sans-serif', background: '#f5f8f3', color: '#173e34', textAlign: 'center' }}>
      <strong style={{ letterSpacing: 4 }}>MIDLEX WORKSPACE</strong>
      <p role={error ? 'alert' : 'status'}>{error || 'Opening your secure project session...'}</p>
      {error && <a href={workspace || 'https://admin.midlex.xyz'}>Return to workspace</a>}
    </main>
  );
}
