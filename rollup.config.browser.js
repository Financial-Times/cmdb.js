import babel from 'rollup-plugin-babel';
import resolve from 'rollup-plugin-node-resolve';
import builtins from 'rollup-plugin-node-builtins';

export default {
  input: 'cmdb.js',
  output: {
    file: 'dist/cmdb.browser.js',
    format: 'umd',
    name: 'cmdb'
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
            targets: {
              browsers: ['> 1%', 'last 2 versions', 'Firefox ESR']
            }
          }
        ]
      ],
      plugins: ['external-helpers']
    }),
    builtins(),
    resolve({
      browser: true,
      extensions: ['.js', '.json'],
      preferBuiltins: false
    })
  ],
  sourcemap: true
};
