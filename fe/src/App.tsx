import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Match } from './pages/Match';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { My } from './pages/My';
import { Pandora } from './pages/Pandora';
import { Community } from './pages/Community';
import { EditProfile } from './pages/EditProfile';
import { Admin } from './pages/Admin';

/** 로그인 필요. admin 옵션이면 어드민만 통과한다. */
function Guard({ admin = false, children }: { admin?: boolean; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="legend text-carbon">불러오는 중…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
            <Route
              path="match"
              element={
                <Guard>
                  <Match />
                </Guard>
              }
            />
            <Route
              path="community"
              element={
                <Guard>
                  <Community />
                </Guard>
              }
            />
            <Route
              path="pandora"
              element={
                <Guard>
                  <Pandora />
                </Guard>
              }
            />
            <Route
              path="my"
              element={
                <Guard>
                  <My />
                </Guard>
              }
            />
            <Route
              path="my/edit"
              element={
                <Guard>
                  <EditProfile />
                </Guard>
              }
            />
            <Route
              path="admin"
              element={
                <Guard admin>
                  <Admin />
                </Guard>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
