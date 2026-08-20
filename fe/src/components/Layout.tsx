import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const NAV = [
  { to: '/', label: '운명찾기' },
  { to: '/my', label: '마이페이지' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen">
      {/* 커맨드 슬랩 — 주 내비 */}
      <header className="slab">
        <div className="mx-auto flex h-9 max-w-[820px] items-center gap-4 px-3">
          {/* 로고 레이스트랙 필 — 라운드를 쓰는 몇 안 되는 곳 (DESIGN.md Shapes) */}
          <Link
            to="/"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-white py-0.5 pl-1.5 pr-3"
          >
            <img src="/logo.png" alt="" className="h-6 w-6" />
            <span className="font-display text-[13px] text-brand-red">사랑찾아</span>
          </Link>

          {user &&
            NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `legend ${isActive ? 'text-amber' : 'text-nav-gold'} hover:text-amber`
                }
              >
                {item.label}
              </NavLink>
            ))}

          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `legend ${isActive ? 'text-amber' : 'text-nav-gold'} hover:text-amber`
              }
            >
              어드민
            </NavLink>
          )}

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <span className="chip bg-amber px-2 py-1 legend text-carbon">
                  {user.points.toLocaleString()} P
                </span>
                <button onClick={onLogout} className="legend text-nav-gold hover:text-amber">
                  로그아웃
                </button>
              </>
            ) : (
              <NavLink to="/login" className="legend text-nav-gold hover:text-amber">
                로그인
              </NavLink>
            )}
          </div>
        </div>
      </header>

      {/* 보조 스트립 */}
      <div className="bg-canvas-soft border-b-2 border-chrome-indigo">
        <div className="mx-auto max-w-[820px] px-3 py-1">
          <span className="legend text-carbon">LG전자 DX SCHOOL 6기 1반 전용</span>
        </div>
      </div>

      <main className="mx-auto max-w-[820px] px-3 py-4">
        <Outlet />
      </main>

      <footer className="slab mt-8">
        <div className="mx-auto max-w-[820px] px-3 py-3">
          <span className="text-[10px] text-canvas">사랑찾아 인생찾아 · 24명 한정 서비스</span>
        </div>
      </footer>
    </div>
  );
}
