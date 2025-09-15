import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

const Layout = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const kiosk = params.get('kiosk') === '1';
  return (
  <div className="min-h-screen flex flex-col bg-cream-50">
      {!kiosk && <Header />}
      <main className="flex-1">
        <Outlet />
      </main>
      {!kiosk && <Footer />}
    </div>
  );
};

export default Layout;
