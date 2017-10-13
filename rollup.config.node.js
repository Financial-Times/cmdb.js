// Rollup plugins.
import babel from 'rollup-plugin-babel';
import cjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-replace';
import resolve from 'rollup-plugin-node-resolve';
import builtins from 'rollup-plugin-node-builtins';

export default {
  input: 'cmdb.js',
  output: {
    file: 'dist/cmdb.js',
    format: 'cjs'
  },
  plugins: [
    babel({
      babelrc: false,
      presets: [
        [
          'env',
          {
            modules: false,
            useBuiltIns: true,
            targets: { node: '4.3.2' }
          }
        ]
      ],
      plugins: ['external-helpers']
    }),
    cjs(),
    builtins(),
    replace({ 'process.env.NODE_ENV': JSON.stringify('production') }),
    resolve({
      browser: false,
      extensions: ['.js', '.json']
    })
  ],
  sourcemap: true
};
