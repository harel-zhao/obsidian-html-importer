"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
const DEFAULT_SETTINGS = {
    autoConvert: true,
    preserveImages: true,
    imageFolder: 'images',
    extractMetadata: true,
};
class HtmlImporterPlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        this.settings = DEFAULT_SETTINGS;
    }
    async onload() {
        await this.loadSettings();
        this.addCommand({
            id: 'convert-html-file',
            name: '转换 HTML 文件为 Markdown',
            callback: async () => {
                const file = this.app.workspace.getActiveFile();
                if (file && file.extension === 'html') {
                    await this.convertHtmlToMd(file);
                }
            }
        });
        this.addCommand({
            id: 'convert-all-html-in-folder',
            name: '转换文件夹中所有 HTML 文件',
            callback: async () => {
                const folder = this.app.fileManager.getNewFileParent('');
                await this.batchConvert(folder.path);
            }
        });
        this.addSettingTab(new HtmlImporterSettingTab(this.app, this));
        this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
            if (file instanceof obsidian_1.TFile && file.extension === 'html') {
                menu.addItem((item) => {
                    item
                        .setTitle('转换为 Markdown')
                        .setIcon('document')
                        .onClick(() => this.convertHtmlToMd(file));
                });
            }
        }));
        this.registerEvent(this.app.vault.on('create', async (file) => {
            if (this.settings.autoConvert && file instanceof obsidian_1.TFile && file.extension === 'html') {
                await this.convertHtmlToMd(file);
            }
        }));
    }
    async loadSettings() {
        const data = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
    cleanFilename(filename) {
        if (!filename)
            return 'untitled';
        const cleaned = String(filename)
            .replace(/[<>:"/\\|?*]+/g, '_')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[. ]+$/g, '');
        return cleaned || 'untitled';
    }
    getMarkdownBasename(title) {
        return this.cleanFilename(title).replace(/\.md$/i, '') || 'untitled';
    }
    extractTitle(htmlContent) {
        const patterns = [
            /class=title--leading[^>]*>([^<]+)</,
            /<h1[^>]*>([^<]+)<\/h1>/,
            /<title>([^<]+)<\/title>/,
            /og:title[^>]*content="([^"]+)"/,
        ];
        for (const pattern of patterns) {
            const match = htmlContent.match(pattern);
            if (match) {
                let title = match[1].trim();
                if (title.includes('|')) {
                    title = title.split('|')[0].trim();
                }
                return title;
            }
        }
        return null;
    }
    extractAuthor(htmlContent) {
        const patterns = [
            />([^<>]+)<\/a>.*?article-avatar/,
            /author[^>]*>([^<]+)</,
            /class="author"[^>]*>([^<]+)</,
        ];
        for (const pattern of patterns) {
            const match = htmlContent.match(pattern);
            if (match)
                return match[1].trim();
        }
        return null;
    }
    extractDate(htmlContent) {
        const patterns = [
            /<span class=dot><\/span>([^<]+)</,
            /class="date"[^>]*>([^<]+)</,
            /datetime="([^"]+)"/,
        ];
        for (const pattern of patterns) {
            const match = htmlContent.match(pattern);
            if (match)
                return match[1].trim();
        }
        return null;
    }
    extractHot(htmlContent) {
        const match = htmlContent.match(/icon-a-commonhotfill[^>]*><\/i>([^<]+)/);
        return match ? match[1].trim() : null;
    }
    extractSource(htmlContent) {
        const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
            let title = titleMatch[1].trim();
            if (title.includes('|')) {
                return title.split('|').pop()?.trim() || null;
            }
            return title;
        }
        const ogMatch = htmlContent.match(/og:site_name[^>]*content="([^"]+)"/);
        return ogMatch ? ogMatch[1].trim() : null;
    }
    extractUrl(htmlContent) {
        const patterns = [
            /og:url[^>]*content="([^"]+)"/,
            /canonical[^>]*href="([^"]+)"/,
            /url:\s*(https?:\/\/[^\s"<>]+)/,
        ];
        for (const pattern of patterns) {
            const match = htmlContent.match(pattern);
            if (match)
                return match[1].trim();
        }
        return null;
    }
    extractTags(htmlContent) {
        const tags = [];
        const tagMatches = htmlContent.matchAll(/>([^<]+)<\/a>.*?rel=tag/g);
        for (const match of tagMatches) {
            const tag = match[1].trim();
            if (tag)
                tags.push(tag);
        }
        const classTagMatches = htmlContent.matchAll(/class="tag"[^>]*>([^<]+)</g);
        for (const match of classTagMatches) {
            const tag = match[1].trim();
            if (tag && !tags.includes(tag))
                tags.push(tag);
        }
        return tags;
    }
    extractContent(htmlContent) {
        const patterns = [
            /class=["']?rich_media_content["']?[^>]*>(.*?)<\/div>\s*<\/div>/s,
            /class=["']?postArticle["']?[^>]*>(.*?)<\/div>\s*<\/article>/s,
            /class="article-content"[^>]*>(.*?)<\/div>/s,
            /class="post-content"[^>]*>(.*?)<\/div>/s,
            /class="entry-content"[^>]*>(.*?)<\/div>/s,
            /class="content"[^>]*>(.*?)<\/div>/s,
            /<article[^>]*>(.*?)<\/article>/s,
            /id="article"[^>]*>(.*?)<\/div>/s,
        ];
        for (const pattern of patterns) {
            const match = htmlContent.match(pattern);
            if (match)
                return match[1];
        }
        return null;
    }
    async extractImages(htmlContent, outputDir, prefix, relativeDir) {
        const images = [];
        const base64Pattern = /<img[^>]*src=["'](data:image\/[^;]+;base64,[^"']+)["']*>/g;
        let i = 0;
        let match;
        const safePrefix = this.cleanFilename(prefix).replace(/\.md$/i, '').substring(0, 20) || 'image';
        while ((match = base64Pattern.exec(htmlContent)) !== null) {
            const dataUrl = match[1];
            try {
                const [header, data] = dataUrl.split(',', 2);
                let ext = '.png';
                if (header.includes('webp'))
                    ext = '.webp';
                else if (header.includes('jpeg') || header.includes('jpg'))
                    ext = '.jpg';
                else if (header.includes('gif'))
                    ext = '.gif';
                const imgFilename = `${safePrefix}_${(i + 1).toString().padStart(2, '0')}${ext}`;
                const imgPath = (0, obsidian_1.normalizePath)(`${outputDir}/${imgFilename}`);
                const binary = atob(data);
                const array = new Uint8Array(binary.length);
                for (let j = 0; j < binary.length; j++) {
                    array[j] = binary.charCodeAt(j);
                }
                await this.app.vault.createBinary(imgPath, array.buffer);
                images.push((0, obsidian_1.normalizePath)(`${relativeDir}/${imgFilename}`));
                i++;
            }
            catch (e) {
                console.error('Failed to extract base64 image:', e);
            }
        }
        return images;
    }
    cleanHtml(text) {
        if (!text)
            return '';
        text = text.replace(/<[^>]+>/g, '');
        text = text.replace(/&nbsp;/g, ' ');
        text = text.replace(/&lt;/g, '<');
        text = text.replace(/&gt;/g, '>');
        text = text.replace(/&amp;/g, '&');
        text = text.replace(/&#39;/g, "'");
        text = text.replace(/&quot;/g, '"');
        text = text.replace(/·/g, '•');
        return text.trim();
    }
    htmlToMd(content, images) {
        if (!content)
            return '';
        const result = [];
        const imageState = { index: 0 };
        const pushText = (html, prefix = '') => {
            let text = html.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
            text = this.cleanHtml(text);
            if (text) {
                result.push(`${prefix}${text}`);
                result.push('');
            }
        };
        const pushImage = (src) => {
            if (imageState.index < images.length && src.startsWith('data:image')) {
                result.push(`![图片${imageState.index + 1}](${images[imageState.index]})`);
                result.push('');
                imageState.index++;
            }
            else if (!src.startsWith('data:image')) {
                result.push(`![](${src})`);
                result.push('');
            }
        };
        const pushInline = (html) => {
            const imgPattern = /<img\b[^>]*(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
            let lastIndex = 0;
            let match;
            while ((match = imgPattern.exec(html)) !== null) {
                pushText(html.slice(lastIndex, match.index));
                pushImage(match[1]);
                lastIndex = match.index + match[0].length;
            }
            pushText(html.slice(lastIndex));
        };
        const processBlocks = (html) => {
            const blockPattern = /<(article|section|ul|ol|h[1-6]|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>|<img\b[^>]*(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
            let foundBlock = false;
            let match;
            while ((match = blockPattern.exec(html)) !== null) {
                foundBlock = true;
                if (match[3]) {
                    pushImage(match[3]);
                    continue;
                }
                const tag = match[1].toLowerCase();
                const inner = match[2];
                if (tag === 'article' || tag === 'section' || tag === 'ul' || tag === 'ol') {
                    processBlocks(inner);
                }
                else if (tag.startsWith('h')) {
                    const heading = this.cleanHtml(inner.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '$2'));
                    if (heading) {
                        result.push(`${'#'.repeat(Number(tag.substring(1)))} ${heading}`);
                        result.push('');
                    }
                }
                else if (tag === 'li') {
                    pushText(inner, '- ');
                }
                else if (tag === 'blockquote') {
                    const quote = this.cleanHtml(inner);
                    if (quote) {
                        result.push(quote.split('\n').map((line) => `> ${line}`).join('\n'));
                        result.push('');
                    }
                }
                else {
                    pushInline(inner);
                }
            }
            if (!foundBlock) {
                pushInline(html);
            }
        };
        processBlocks(content);
        return result.join('\n').trim();
    }
    async convertHtmlToMd(htmlFile) {
        try {
            const htmlContent = await this.app.vault.read(htmlFile);
            const title = this.extractTitle(htmlContent) || htmlFile.basename;
            const author = this.extractAuthor(htmlContent) || '未知';
            const date = this.extractDate(htmlContent);
            const hot = this.extractHot(htmlContent);
            const source = this.extractSource(htmlContent) || '未知';
            const url = this.extractUrl(htmlContent);
            const tags = this.extractTags(htmlContent);
            const content = this.extractContent(htmlContent);
            const parent = htmlFile.parent;
            if (!parent) {
                new obsidian_1.Notice('无法确定文件所在文件夹');
                return;
            }
            const markdownBasename = this.getMarkdownBasename(title);
            const imgPrefix = markdownBasename.substring(0, 20);
            let images = [];
            if (this.settings.preserveImages) {
                const imageFolderName = this.cleanFilename(this.settings.imageFolder || 'images');
                const imageFolderPath = (0, obsidian_1.normalizePath)(`${parent.path}/${imageFolderName}`);
                try {
                    const imageFolder = this.app.vault.getAbstractFileByPath(imageFolderPath);
                    if (!imageFolder) {
                        await this.app.vault.createFolder(imageFolderPath);
                    }
                }
                catch {
                    await this.app.vault.createFolder(imageFolderPath);
                }
                images = await this.extractImages(content || htmlContent, imageFolderPath, imgPrefix, imageFolderName);
            }
            let frontmatter = '';
            if (this.settings.extractMetadata) {
                frontmatter = `---
title: ${title}
author: ${author}
date: ${date || ''}
hot: ${hot || ''}
source: ${source}
url: ${url || ''}
tags: ${tags.join(', ')}
---

`;
            }
            const mdContent = `${frontmatter}# ${title}

${this.settings.extractMetadata ? `> **作者：** ${author}\n> **热度：** ${hot || '未知'}\n> **来源：** ${source}\n\n---\n\n` : ''}${this.htmlToMd(content || htmlContent, images)}`;
            const mdFilename = `${markdownBasename}.md`;
            const mdPath = (0, obsidian_1.normalizePath)(`${parent.path}/${mdFilename}`);
            let existingFile = this.app.vault.getAbstractFileByPath(mdPath);
            if (existingFile instanceof obsidian_1.TFile) {
                await this.app.vault.modify(existingFile, mdContent);
            }
            else {
                await this.app.vault.create(mdPath, mdContent);
            }
            new obsidian_1.Notice(`已转换: ${title}`);
        }
        catch (e) {
            console.error('HTML 转换失败:', e);
            new obsidian_1.Notice(`转换失败: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    async batchConvert(folderPath) {
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!(folder instanceof obsidian_1.TFolder)) {
            new obsidian_1.Notice('无效的文件夹路径');
            return;
        }
        const htmlFiles = [];
        const collectFiles = (f) => {
            for (const child of f.children) {
                if (child instanceof obsidian_1.TFile && child.extension === 'html') {
                    htmlFiles.push(child);
                }
                else if (child instanceof obsidian_1.TFolder) {
                    collectFiles(child);
                }
            }
        };
        collectFiles(folder);
        if (htmlFiles.length === 0) {
            new obsidian_1.Notice('文件夹中没有 HTML 文件');
            return;
        }
        for (const file of htmlFiles) {
            await this.convertHtmlToMd(file);
        }
        new obsidian_1.Notice(`已完成 ${htmlFiles.length} 个文件的转换`);
    }
}
exports.default = HtmlImporterPlugin;
class HtmlImporterSettingTab extends obsidian_1.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        new obsidian_1.Setting(containerEl)
            .setName('自动转换')
            .setDesc('当创建或导入 HTML 文件时自动转换为 Markdown')
            .addToggle((toggle) => toggle.setValue(this.plugin.settings.autoConvert).onChange(async (value) => {
            this.plugin.settings.autoConvert = value;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName('保留图片')
            .setDesc('将图片保存到本地 images 文件夹')
            .addToggle((toggle) => toggle.setValue(this.plugin.settings.preserveImages).onChange(async (value) => {
            this.plugin.settings.preserveImages = value;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName('图片文件夹')
            .setDesc('保存图片的文件夹名称')
            .addText((text) => text.setValue(this.plugin.settings.imageFolder).onChange(async (value) => {
            this.plugin.settings.imageFolder = value;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName('提取元数据')
            .setDesc('在 Markdown 文件中包含 frontmatter 元数据')
            .addToggle((toggle) => toggle.setValue(this.plugin.settings.extractMetadata).onChange(async (value) => {
            this.plugin.settings.extractMetadata = value;
            await this.plugin.saveSettings();
        }));
    }
}
