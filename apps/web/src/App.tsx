import { useEffect, useState } from 'react';
import { MantineProvider, createTheme, Center, Loader } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { Me } from '@shared';
import { tokenStore, type Api, ApiError } from './api/client.ts';
import { ApiCtx, AuthCtx } from './ctx.tsx';
import { Shell } from './components/Shell.tsx';
import { LoginPage } from './pages/Login.tsx';
import { DashboardPage } from './pages/Dashboard.tsx';
import { TablesPage } from './pages/Tables.tsx';
import { EntriesPage } from './pages/Entries.tsx';
import { EditorPage } from './pages/Editor.tsx';
import { ReleasesPage } from './pages/Releases.tsx';
import { HistoryPage } from './pages/History.tsx';
import { AdminPage } from './pages/Admin.tsx';

const theme = createTheme({ primaryColor: 'indigo', defaultRadius: 'md', fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif' });

export function App({ api }: { api: Api }) {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 10_000, retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2, refetchOnWindowFocus: false } }
  }));
  const [me, setMe] = useState<Me | null>(null);
  const [booting, setBooting] = useState(true);
  const logout = () => { tokenStore.set(null); setMe(null); qc.clear(); };

  useEffect(() => {   // 저장된 토큰으로 자동 로그인
    if (api.demo || !tokenStore.get()) { setBooting(false); return; }
    api.me().then(setMe).catch(() => tokenStore.set(null)).finally(() => setBooting(false));
  }, [api]);
  useEffect(() => {   // 토큰 만료(401)면 로그인 화면으로
    return qc.getQueryCache().subscribe(ev => { const e: any = ev?.query?.state?.error; if (e instanceof ApiError && e.status === 401) logout(); });
  }, [qc]);

  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications position="top-center" />
      <QueryClientProvider client={qc}>
        <ApiCtx.Provider value={api}>
          <AuthCtx.Provider value={{ me, setMe, logout }}>
            {booting ? <Center h="100vh"><Loader /></Center> : !me ? <LoginPage /> : (
              <HashRouter>
                <Shell>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/balance" element={<TablesPage />} />
                    <Route path="/balance/:table" element={<EntriesPage />} />
                    <Route path="/balance/:table/:key" element={<EditorPage />} />
                    <Route path="/releases" element={<ReleasesPage />} />
                    <Route path="/history" element={<HistoryPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </Shell>
              </HashRouter>
            )}
          </AuthCtx.Provider>
        </ApiCtx.Provider>
      </QueryClientProvider>
    </MantineProvider>
  );
}
