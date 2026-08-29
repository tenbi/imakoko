import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// GitHub Pages のサブパス配信でも動くよう、相対パスで出力する
export default defineConfig({
  base: './',
  plugins: [svelte()],
});
