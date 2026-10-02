import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = process.cwd();
const outputDirectory = path.join(projectRoot, 'dist');
const serverOutputDirectory = path.join(projectRoot, '.prerender');
const serverEntry = path.join(serverOutputDirectory, 'entry-server.js');
const template = await readFile(path.join(outputDirectory, 'index.html'), 'utf8');
const { render, routeMetadata } = await import(pathToFileURL(serverEntry).href);

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const renderMetadata = (metadata) => {
  const canonicalUrl = new URL(metadata.path, 'https://www.denyszhak.com').href;
  const imageUrl = new URL(metadata.image, 'https://www.denyszhak.com').href;
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const imageAlt = escapeHtml(metadata.imageAlt);

  return [
    '<meta name="author" content="Denys Zhak" />',
    '<meta name="robots" content="index, follow" />',
    `<link rel="canonical" href="${canonicalUrl}" />`,
    '<meta property="og:site_name" content="Denys Zhak" />',
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="${metadata.type}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    `<meta property="og:image" content="${imageUrl}" />`,
    `<meta property="og:image:alt" content="${imageAlt}" />`,
    `<meta name="twitter:card" content="${metadata.twitterCard}" />`,
    '<meta name="twitter:creator" content="@denyszhak_" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${imageUrl}" />`,
    `<meta name="twitter:image:alt" content="${imageAlt}" />`,
  ].join('\n    ');
};

for (const route of routeMetadata) {
  const { appHtml, metadata } = render(route.path);
  const page = template
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(metadata.title)}</title>`)
    .replace(
      /<meta name="description" content=".*?" \/>/,
      `<meta name="description" content="${escapeHtml(metadata.description)}" />`,
    )
    .replace('<!-- route-metadata -->', renderMetadata(metadata))
    .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);

  const routeDirectory = route.path === '/'
    ? outputDirectory
    : path.join(outputDirectory, route.path.slice(1));

  await mkdir(routeDirectory, { recursive: true });
  await writeFile(path.join(routeDirectory, 'index.html'), page);
}

await rm(serverOutputDirectory, { recursive: true, force: true });
