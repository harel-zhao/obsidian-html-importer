const assert = require('assert');
const Module = require('module');

if (typeof global.atob !== 'function') {
  global.atob = (value) => Buffer.from(value, 'base64').toString('binary');
}

class Plugin {
  addCommand() {}
  addSettingTab() {}
  registerEvent() {}
  async loadData() {
    return {};
  }
  async saveData() {}
}

class PluginSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
  }
}

class TFile {
  constructor(path, basename, extension, parent) {
    this.path = path;
    this.basename = basename;
    this.extension = extension;
    this.parent = parent;
  }
}

class TFolder {
  constructor(path, children = []) {
    this.path = path;
    this.children = children;
  }
}

class Notice {
  constructor(message) {
    this.message = message;
  }
}

class Setting {
  constructor() {}
  setName() {
    return this;
  }
  setDesc() {
    return this;
  }
  addToggle() {
    return this;
  }
  addText() {
    return this;
  }
}

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'obsidian') {
    return {
      Plugin,
      PluginSettingTab,
      TFile,
      TFolder,
      Notice,
      Setting,
      normalizePath: (path) => path.replace(/\\/g, '/'),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const HtmlImporterPlugin = require('../main.js').default;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPlugin({ html, settings = {}, binaryDelay = 0, existingMarkdown = false }) {
  const plugin = new HtmlImporterPlugin();
  plugin.settings = {
    autoConvert: true,
    preserveImages: true,
    imageFolder: 'images',
    extractMetadata: true,
    ...settings,
  };

  const parent = new TFolder('notes');
  const file = new TFile('notes/source.html', 'source', 'html', parent);
  const events = [];
  const created = [];

  plugin.app = {
    vault: {
      read: async () => html,
      getAbstractFileByPath: (path) => {
        if (existingMarkdown && path.endsWith('.md')) {
          return new TFile(path, path.replace(/^.*\//, '').replace(/\.md$/i, ''), 'md', parent);
        }
        return null;
      },
      createFolder: async (path) => {
        events.push(['folder', path]);
        return new TFolder(path);
      },
      createBinary: async (path, buffer) => {
        events.push(['binary:start', path, buffer.byteLength]);
        if (binaryDelay) {
          await wait(binaryDelay);
        }
        events.push(['binary:end', path]);
      },
      create: async (path, content) => {
        events.push(['file', path, content]);
        created.push({ path, content });
      },
      modify: async (target, content) => {
        events.push(['modify', target.path, content]);
      },
    },
  };

  return { plugin, file, events, created };
}

async function testOutputFilenameAndCleanFilename() {
  const { plugin, file, created } = createPlugin({
    html: '<html><head><title>A:B:C?.MD</title></head><body><article><h1>A:B:C?.MD</h1><p>Body</p></article></body></html>',
  });

  assert.strictEqual(plugin.cleanFilename('a:b:c?.md'), 'a_b_c_.md');
  assert.strictEqual(plugin.getMarkdownBasename('a:b:c?.MD'), 'a_b_c_');
  await plugin.convertHtmlToMd(file);

  assert.strictEqual(created.length, 1);
  assert.strictEqual(created[0].path, 'notes/A_B_C_.md');
  assert(!created[0].path.endsWith('.md.md'));
}

function testSourceOrder() {
  const plugin = new HtmlImporterPlugin();
  const markdown = plugin.htmlToMd('<article><h6>Head</h6><p>Hello <strong>world</strong></p></article>', []);

  assert.strictEqual(markdown, '###### Head\n\nHello **world**');
}

function testNestedBlockOrder() {
  const plugin = new HtmlImporterPlugin();
  const markdown = plugin.htmlToMd(
    '<article><section><h2>Section</h2><p>Intro</p><ul><li>One</li><li>Two</li></ul><blockquote>Quote</blockquote></section><p>Done</p></article>',
    []
  );

  assert.strictEqual(markdown, '## Section\n\nIntro\n\n- One\n\n- Two\n\n> Quote\n\nDone');
}

function testImageSourceOrder() {
  const plugin = new HtmlImporterPlugin();
  const markdown = plugin.htmlToMd(
    '<article><h1>Head</h1><img src="data:image/png;base64,AA=="><p>Before <img data-src="https://example.com/a.png"> After</p></article>',
    ['images/local.png']
  );

  const headingIndex = markdown.indexOf('# Head');
  const localImageIndex = markdown.indexOf('(images/local.png)');
  const beforeIndex = markdown.indexOf('Before');
  const remoteImageIndex = markdown.indexOf('![](https://example.com/a.png)');
  const afterIndex = markdown.indexOf('After');

  assert(headingIndex !== -1);
  assert(localImageIndex > headingIndex);
  assert(beforeIndex > localImageIndex);
  assert(remoteImageIndex > beforeIndex);
  assert(afterIndex > remoteImageIndex);
}

async function testPreserveImagesDisabled() {
  const { plugin, file, events, created } = createPlugin({
    settings: { preserveImages: false },
    html: '<html><head><title>Pic</title></head><body><article><p><img src="data:image/png;base64,AA=="><img data-src="https://example.com/a.png"></p></article></body></html>',
  });

  await plugin.convertHtmlToMd(file);

  assert(!events.some(([type]) => type === 'folder'));
  assert(!events.some(([type]) => type.startsWith('binary')));
  assert(created[0].content.includes('![](https://example.com/a.png)'));
  assert(!created[0].content.includes('data:image/png'));
}

async function testImageWritesBeforeMarkdownCreate() {
  const { plugin, file, events, created } = createPlugin({
    binaryDelay: 10,
    html: '<html><head><title>Pic</title></head><body><article><p><img src="data:image/png;base64,AA=="></p></article></body></html>',
  });

  await plugin.convertHtmlToMd(file);

  const binaryEndIndex = events.findIndex(([type]) => type === 'binary:end');
  const fileIndex = events.findIndex(([type]) => type === 'file');
  assert(binaryEndIndex !== -1);
  assert(fileIndex !== -1);
  assert(binaryEndIndex < fileIndex);
  assert(created[0].content.includes('(images/Pic_01.png)'));
}

async function testImageWritesBeforeMarkdownModify() {
  const { plugin, file, events } = createPlugin({
    existingMarkdown: true,
    binaryDelay: 10,
    html: '<html><head><title>Pic</title></head><body><article><p><img src="data:image/png;base64,AA=="></p></article></body></html>',
  });

  await plugin.convertHtmlToMd(file);

  const binaryEndIndex = events.findIndex(([type]) => type === 'binary:end');
  const modifyIndex = events.findIndex(([type]) => type === 'modify');
  assert(binaryEndIndex !== -1);
  assert(modifyIndex !== -1);
  assert(binaryEndIndex < modifyIndex);
}

async function run() {
  await testOutputFilenameAndCleanFilename();
  testSourceOrder();
  testNestedBlockOrder();
  testImageSourceOrder();
  await testPreserveImagesDisabled();
  await testImageWritesBeforeMarkdownCreate();
  await testImageWritesBeforeMarkdownModify();
  console.log('All tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
