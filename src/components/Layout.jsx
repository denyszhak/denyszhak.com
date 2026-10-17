import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import { posts } from '../posts';

const Layout = () => {
  return (
    <div className="container">
      <Navigation />
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">last updated {posts[0].date}</footer>
    </div>
  );
};

export default Layout;
