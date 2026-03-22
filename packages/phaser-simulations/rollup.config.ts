import { defineConfig } from 'rollup'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'

const production = process.env.NODE_ENV === 'production'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    file: 'dist/phaser-bundle.js',
    format: 'iife',
    name: 'ELearnPhaser',
    sourcemap: !production,
  },
  plugins: [resolve(), typescript(), production && terser()],
})
