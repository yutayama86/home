import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://shikumi-base.com',
  integrations: [sitemap()],
});
