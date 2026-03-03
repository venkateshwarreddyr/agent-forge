import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'static',   // Static site — no server-side rendering needed
  adapter: cloudflare(),
  site: 'https://multi-agent-orchestrator.pages.dev',
});
