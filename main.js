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
        const illegalChars = '<>:"/\\|?*';
        for (const char of illegalChars) {
            filename = filename.replace(char, '_');
        }
        return filename.trim();
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
    extractImages(htmlContent, outputDir, prefix) {
        const images = [];
        const base64Pattern = /<img[^>]*src=["'](data:image\/[^;]+;base64,[^"']+)["']*>/g;
        let i = 0;
        let match;
        while ((match = base64Pattern.exec(htmlContent)) !== null) {
            const dataUrl = match[1];
            try {
                const [header, data] = dataUrl.split(',', 2);
                const imgData = atob(data);
                let ext = '.png';
                if (header.includes('webp'))
                    ext = '.webp';
                else if (header.includes('jpeg') || header.includes('jpg'))
                    ext = '.jpg';
                else if (header.includes('gif'))
                    ext = '.gif';
                const imgFilename = `${prefix}_${(i + 1).toString().padStart(2, '0')}${ext}`;
                const imgPath = (0, obsidian_1.normalizePath)(`${outputDir}/${imgFilename}`);
                const binary = atob(data);
                const array = new Uint8Array(binary.length);
                for (let j = 0; j < binary.length; j++) {
                    array[j] = binary.charCodeAt(j);
                }
                this.app.vault.createBinary(imgPath, array.buffer);
                images.push(imgFilename);
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
        let imgIndex = 0;
        const strongPattern = /<(strong|b)[^>]*>(.*?)<\/(strong|b)>/g;
        const hPattern = /<h([123])[^>]*>(.*?)<\/h[123]>/g;
        const pPattern = /<p[^>]*>(.*?)<\/p>/g;
        const liPattern = /<li[^>]*>(.*?)<\/li>/g;
        const bqPattern = /<blockquote[^>]*>(.*?)<\/blockquote>/g;
        const sectionPattern = /<section[^>]*>(.*?)<\/section>/g;
        const spanTextstylePattern = /<span[^>]*textstyle[^>]*>(.*?)<\/span>/g;
        const spanLeafPattern = /<span[^>]*leaf[^>]*>(.*?)<\/span>/g;
        const imgSrcPattern = /<img[^>]*src=["'](data:image[^"']+)["']*>/;
        const imgDataSrcPattern = /<img[^>]*data-src=["']([^"']+)["']*>/;
        const sections = content.matchAll(sectionPattern);
        for (const sectionMatch of sections) {
            const sectionContent = sectionMatch[1];
            const hMatch = hPattern.exec(sectionContent);
            if (hMatch) {
                const level = parseInt(hMatch[1]);
                let titleText = hMatch[2].replace(strongPattern, '$2');
                titleText = this.cleanHtml(titleText);
                if (titleText) {
                    result.push('#'.repeat(level) + ' ' + titleText);
                    result.push('');
                }
            }
            const textstyleMatches = sectionContent.matchAll(spanTextstylePattern);
            for (const stMatch of textstyleMatches) {
                const textContent = stMatch[1];
                if (imgSrcPattern.test(textContent) || imgDataSrcPattern.test(textContent)) {
                    if (imgIndex < images.length) {
                        result.push(`![图片${imgIndex + 1}](images/${images[imgIndex]})`);
                        result.push('');
                        imgIndex++;
                    }
                }
                else {
                    let textClean = textContent.replace(strongPattern, '**$2**');
                    textClean = this.cleanHtml(textClean);
                    if (textClean) {
                        result.push(textClean);
                        result.push('');
                    }
                }
            }
            if (!spanTextstylePattern.test(sectionContent)) {
                const leafMatches = sectionContent.matchAll(spanLeafPattern);
                for (const leafMatch of leafMatches) {
                    const textContent = leafMatch[1];
                    if (imgSrcPattern.test(textContent) || imgDataSrcPattern.test(textContent)) {
                        if (imgIndex < images.length) {
                            result.push(`![图片${imgIndex + 1}](images/${images[imgIndex]})`);
                            result.push('');
                            imgIndex++;
                        }
                    }
                    else {
                        let textClean = textContent.replace(strongPattern, '**$2**');
                        textClean = this.cleanHtml(textClean);
                        if (textClean) {
                            result.push(textClean);
                            result.push('');
                        }
                    }
                }
            }
            const pMatches = sectionContent.matchAll(pPattern);
            for (const pMatch of pMatches) {
                const pContent = pMatch[1];
                if (imgSrcPattern.test(pContent) || imgDataSrcPattern.test(pContent)) {
                    if (imgIndex < images.length) {
                        result.push(`![图片${imgIndex + 1}](images/${images[imgIndex]})`);
                        result.push('');
                        imgIndex++;
                    }
                }
                else {
                    let pText = pContent.replace(strongPattern, '**$2**');
                    pText = this.cleanHtml(pText);
                    if (pText) {
                        result.push(pText);
                        result.push('');
                    }
                }
            }
            const liMatches = sectionContent.matchAll(liPattern);
            for (const liMatch of liMatches) {
                let liText = liMatch[1].replace(strongPattern, '**$2**');
                liText = this.cleanHtml(liText);
                if (liText) {
                    result.push(`- ${liText}`);
                }
            }
            const bqMatches = sectionContent.matchAll(bqPattern);
            for (const bqMatch of bqMatches) {
                const bqText = this.cleanHtml(bqMatch[1]);
                if (bqText) {
                    result.push(`> ${bqText}`);
                    result.push('');
                }
            }
        }
        if (result.length === 0) {
            const pMatches = content.matchAll(pPattern);
            for (const pMatch of pMatches) {
                const pContent = pMatch[1];
                if (imgSrcPattern.test(pContent) || imgDataSrcPattern.test(pContent)) {
                    if (imgIndex < images.length) {
                        result.push(`![图片${imgIndex + 1}](images/${images[imgIndex]})`);
                        result.push('');
                        imgIndex++;
                    }
                }
                else {
                    let pText = pContent.replace(strongPattern, '**$2**');
                    pText = this.cleanHtml(pText);
                    if (pText) {
                        result.push(pText);
                        result.push('');
                    }
                }
            }
            const hMatches = content.matchAll(hPattern);
            for (const hMatch of hMatches) {
                const level = parseInt(hMatch[1]);
                let titleText = hMatch[2].replace(strongPattern, '$2');
                titleText = this.cleanHtml(titleText);
                if (titleText) {
                    result.push('#'.repeat(level) + ' ' + titleText);
                    result.push('');
                }
            }
            const liMatches = content.matchAll(liPattern);
            for (const liMatch of liMatches) {
                let liText = liMatch[1].replace(strongPattern, '**$2**');
                liText = this.cleanHtml(liText);
                if (liText) {
                    result.push(`- ${liText}`);
                }
            }
        }
        return result.join('\n');
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
            const imageFolderPath = (0, obsidian_1.normalizePath)(`${parent.path}/${this.settings.imageFolder}`);
            let imageFolder;
            try {
                imageFolder = this.app.vault.getAbstractFileByPath(imageFolderPath);
                if (!imageFolder) {
                    imageFolder = await this.app.vault.createFolder(imageFolderPath);
                }
            }
            catch {
                imageFolder = await this.app.vault.createFolder(imageFolderPath);
            }
            const imgPrefix = this.cleanFilename(title).substring(0, 20);
            const images = this.extractImages(content || htmlContent, imageFolderPath, imgPrefix);
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
            const mdFilename = `${title}.md`;
            const mdPath = (0, obsidian_1.normalizePath)(`${parent.path}/${this.cleanFilename(mdFilename)}.md`);
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
