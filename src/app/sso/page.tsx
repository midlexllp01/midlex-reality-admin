'use client';
import { useEffect, useRef, useState } from 'react';
export default function WorkspaceSignIn() {
  const started = useRef(false); const [error, setError] = useState(''); const [workspace, setWorkspace] = useState('');
  useEffect(() => {
    if (started.current) return; started.current = true;
    const code = new URLSearchParams(window.location.hash.slice(1)).get('code');
    // Never leave the one-time handoff in browser history, referrers or application logs.
    window.history.replaceState(null, '', '/sso');
    async function exchange() {
      try {
        let response = await fetch('/api/sso', code ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) } : { cache: 'no-store' });
        let data = await response.json();
        const fresh = !!code && response.ok;
        if (!response.ok && code) {
          const existing = await fetch('/api/sso', { cache: 'no-store' });
          if (existing.ok) { response = existing; data = await existing.json(); }
        }
        setWorkspace(data.workspaceUrl || '');
        if (!response.ok) throw new Error(data.message || 'The project link has expired. Open it again from your workspace.');
        if (fresh && ['https://staff.midlex.xyz', 'https://admin.midlex.xyz', 'https://developer.midlex.xyz'].includes(data.workspaceUrl)) localStorage.setItem('midlex_workspace_return', data.workspaceUrl);
        const user = data.user; const admin = data.access === 'ADMIN';
        localStorage.setItem('midlex_token', data.token); localStorage.setItem('midlex_user', JSON.stringify(user));
        // Compatibility adapters preserve existing project components and data stores.
        if (data.project === 'cbt') localStorage.setItem('midlex_cbt_session', JSON.stringify({ ...user, role: admin ? 'ADMIN' : 'USER', candidateId: user.workspaceId, assignedExamIds: [] }));
        if (data.project === 'mip') localStorage.setItem('midlex_mip_session', JSON.stringify({ ...user, role: admin ? 'INTERNSHIP_ADMIN' : 'STUDENT_INTERN', internId: user.workspaceId, totalHoursLogged: 0 }));
        if (data.project === 'hrms') localStorage.setItem('midlex_hrms_user', JSON.stringify({ ...user, role: admin ? 'HR_ADMIN' : 'STAFF', staffId: user.id, department: 'GENERAL', staffCategory: 'SUPPORT_STAFF', supportRole: 'Staff', firstLoginSetupComplete: true }));
        if (data.project === 'realty') { localStorage.setItem('midlex_realty_admin_token', data.token); localStorage.setItem('midlex_realty_admin_user', JSON.stringify(user)); }
        if (data.project === 'cbt' && admin) localStorage.setItem('midlex_cbt_admin_session', localStorage.getItem('midlex_cbt_session')!);
        if (data.project === 'hrms' && admin) localStorage.setItem('midlex_hrms_admin_access', 'true');
        window.location.replace(data.path);
      } catch (e) { setError(e instanceof Error ? e.message : 'Unable to open project'); }
    }
    void exchange();
  }, []);
  return <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 20, padding: 30, fontFamily: 'Arial, sans-serif', background: '#f5f8f3', color: '#173e34', textAlign: 'center' }}><strong style={{ letterSpacing: 4 }}>MIDLEX WORKSPACE</strong><p role={error ? 'alert' : 'status'}>{error || 'Opening your secure project session…'}</p>{error && <a href={workspace || '/api/sso'}>Return to workspace</a>}</main>;
}
