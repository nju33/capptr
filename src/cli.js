#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
const yargs = require('yargs');
const R = require('ramda');
const puppeteer = require('puppeteer');
const filenamifyUrl = require('filenamify-url');

const argv = yargs
  .command(
    `
$0
  -o /tmp/capptr
  -u http://example.com
  -u http://example.com/foo
  -v 1366x768
  -v 320x480
`.trim(),
    'In the above, Capptr will create example.com:320x480.png, example.com:1366x768.png, example.com!foo:320x480.png and example.com!foo:1366x768.png'
  )
  .option('urls', {
    alias: 'u',
    type: 'array',
    default: []
  })
  .option('htmls', {
    alias: 'h',
    type: 'array',
    default: []
  })
  .option('viewports', {
    alias: 'v',
    type: 'array',
    default: []
  })
  .option('out-dir', {
    alias: 'o',
    type: 'string',
    default: '/tmp/capptr'
  })
  .help().argv;

const prepareViewports = R.compose(
  R.map(R.zipObj(['width', 'height'])),
  R.map(R.map(Number)),
  R.map(R.split('x')),
  R.unless(R.length, () => ['1366x768']),
  R.prop('viewports')
);
const prepare = R.applySpec({
  urls: R.prop('urls'),
  htmls: R.compose(
    R.map(html => path.join(__dirname, html)),
    R.prop('htmls')
  ),
  viewports: prepareViewports,
  outDir: R.prop('outDir')
});
const {urls, htmls, viewports, outDir} = prepare(argv);
if (urls.length === 0 && htmls.length === 0) {
  throw new Error('`urls` or `htmls` is required at least one');
}

const run = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await fs.ensureDir(outDir);

  for (const url of urls) {
    await page.goto(url);

    for (const viewport of viewports) {
      await page.setViewport(viewport);
      await page.screenshot({
        path: path.join(
          outDir,
          `${filenamifyUrl(url)}:${viewport.width}x${viewport.height}.png`
        ),
        fullPage: true
      });
    }
  }

  await browser.close();
};

run().catch(err => {
  console.error(err);
});
