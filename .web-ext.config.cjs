module.exports = {
  sourceDir: '.',
  artifactsDir: '.web-ext-artifacts',
  run: {
    firefox: 'firefoxdeveloperedition',
    startUrl: ['about:debugging#/runtime/this-firefox'],
    watchFiles: [
      'dotgit.js', 'content_script.js', 'manifest.json',
      'recorder.js', 'popup/popup.js', 'options/options.js',
      'scraper/orchestrate.js', 'scraper/relay.js', 'scraper/accounts.js',
      'scraper/containers.js', 'scraper/rotation.js', 'scraper/uivision.js',
    ],
  },
  ignoreFiles: [
    'workflow/node_modules/**',
    'workflow/src/**',
    '.git/**',
    '.web-ext-artifacts/**',
    'node_modules/**',
    '.claude/**',
    '.superpowers/**',
  ],
};
