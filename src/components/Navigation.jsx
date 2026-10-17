import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';

const pages = [
  { path: '/', label: 'about' },
  { path: '/writing', label: 'writing' },
  { path: '/open-source', label: 'open source' },
];

const Navigation = () => {
  const { pathname } = useLocation();

  const items = [
    ...pages.map(({ path, label }) => (
      pathname === path
        ? <span key={path} className="nav-current" aria-current="page">{label}</span>
        : <Link key={path} to={path}>{label}</Link>
    )),
    <a key="github" href="https://github.com/denyszhak" target="_blank" rel="noopener noreferrer">github</a>,
    <a key="email" href="mailto:denyszhak@gmail.com">email</a>,
  ];

  return (
    <header className="site-header">
      <Link to="/" className="site-name">denys zhak</Link>
      <nav>
        {items.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 && <span className="nav-separator"> | </span>}
            {item}
          </Fragment>
        ))}
      </nav>
    </header>
  );
};

export default Navigation;
