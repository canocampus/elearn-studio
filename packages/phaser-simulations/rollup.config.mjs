import { defineConfig } from 'rollup'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'

// NODE_ENV can come from --environment NODE_ENV:production (rollup CLI) or process.env
const production = process.env.NODE_ENV === 'production'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    file: 'dist/phaser-bundle.js',
    format: 'iife',
    name: 'ELearnPhaser',
    sourcemap: !production,
    inlineDynamicImports: true,
  },
  plugins: [
    resolve({ browser: true }),
    typescript({ tsconfig: './tsconfig.json', sourceMap: !production }),
    production && terser({
      compress: {
        drop_console: false, // keep console for debug visibility in LMS
        passes: 2,
      },
      format: { comments: false },
    }),
  ].filter(Boolean),
})
