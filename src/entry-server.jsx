import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { AppRoutes } from './App';
import { getRouteMetadata, routeMetadata } from './siteMetadata';

export { routeMetadata };

export const render = (pathname) => ({
  appHtml: renderToString(
    <StrictMode>
      <StaticRouter location={pathname}>
        <AppRoutes />
      </StaticRouter>
    </StrictMode>,
  ),
  metadata: getRouteMetadata(pathname),
});
