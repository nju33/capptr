#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
const yargs = require('yargs');
const R = require('ramda');
const puppeteer = require('puppeteer');
const Listr = require('listr');
const filenamifyUrl = require('filenamify-url');

const argv = yargs
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

  const tasks = new Listr(
    urls.map(url => {
      return {
        title: url,
        task: async () => {
          return new Listr(
            viewports.map((viewport, i) => {
              return {
                title: `${viewport.width}x${viewport.height}`,
                task: async () => {
                  if (i === 0) {
                    await page.goto(url);
                  }

                  await page.setViewport(viewport);
                  await page.screenshot({
                    path: path.join(
                      outDir,
                      `${filenamifyUrl(url)}_${viewport.width}x${
                        viewport.height
                      }.png`
                    ),
                    type: 'png',
                    fullPage: true
                  });
                }
              };
            })
          );
        }
      };
    })
  );

  // for (const url of urls) {
  //   await page.goto(url);

  //   for (const viewport of viewports) {
  //     await page.setViewport(viewport);
  //     await page.screenshot({
  //       path: path.join(
  //         outDir,
  //         `${filenamifyUrl(url)}.png?size=${viewport.width}x${viewport.height}`
  //       ),
  //       type: 'png',
  //       fullPage: true
  //     });
  //   }
  // }

  await tasks.run();
  await browser.close();
};

run().catch(err => {
  console.error(err);
});
