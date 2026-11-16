import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { routeMetadata } from './src/siteMetadata.js'

const servePrerenderedRoutes = () => ({
  name: 'serve-prerendered-routes',
  configurePreviewServer(server) {
    const prerenderedPaths = new Set(
      routeMetadata
        .map((route) => route.path)
        .filter((routePath) => routePath !== '/'),
    )

    server.middlewares.use((request, _response, next) => {
      if (!request.url) return next()

      const url = new URL(request.url, 'http://localhost')
      const pathname = url.pathname.replace(/\/$/, '')
      if (prerenderedPaths.has(pathname)) {
        request.url = `${pathname}/index.html${url.search}`
      }

      next()
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), servePrerenderedRoutes()],
})
