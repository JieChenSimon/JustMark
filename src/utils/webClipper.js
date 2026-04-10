import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { Readability } from '@mozilla/readability';

/**
 * Extracts a URL from the given text
 * @param {string} text - Text that may contain a URL
 * @returns {string|null} - The extracted URL or null
 */
export function extractUrlFromText(text) {
    if (!text || typeof text !== 'string') return null;

    const trimmed = text.trim();

    // Check if the entire text is a URL
    const urlPattern = /^https?:\/\/[^\s<>"{}|\\^`[\]]+$/i;
    if (urlPattern.test(trimmed)) {
        return trimmed;
    }

    // Try to extract URL from markdown link format [text](url)
    const markdownLinkMatch = trimmed.match(/\[.*?\]\((https?:\/\/[^\s)]+)\)/);
    if (markdownLinkMatch) {
        return markdownLinkMatch[1];
    }

    // Try to extract first URL from text
    const urlMatch = trimmed.match(/(https?:\/\/[^\s<>"{}|\\^`[\]]+)/i);
    if (urlMatch) {
        return urlMatch[1];
    }

    return null;
}

/**
 * Resolve relative URL to absolute URL
 * @param {string} relativeUrl - Relative or absolute URL
 * @param {string} baseUrl - Base URL for resolution
 * @returns {string} - Absolute URL
 */
function resolveUrl(relativeUrl, baseUrl) {
    if (!relativeUrl) return '';

    // Already absolute
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://') || relativeUrl.startsWith('data:')) {
        return relativeUrl;
    }

    try {
        return new URL(relativeUrl, baseUrl).href;
    } catch {
        return relativeUrl;
    }
}

/**
 * Create Turndown service with custom rules
 * @param {string} baseUrl - Base URL for resolving relative paths
 */
function createTurndownService(baseUrl) {
    const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-',
        emDelimiter: '*',
    });

    // Use GFM plugin for tables, strikethrough, etc.
    turndownService.use(gfm);

    const escapeTableCell = (value) => value
        .replace(/\|/g, '\\|')
        .replace(/\n+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

    // Convert common HTML tables into Markdown tables so clipped content
    // stays editable in the source view instead of leaking raw HTML.
    turndownService.addRule('htmlTables', {
        filter: (node) => node.nodeName === 'TABLE',
        replacement: (_content, node) => {
            const rows = Array.from(node.querySelectorAll('tr'))
                .map((row) => Array.from(row.children)
                    .filter((cell) => ['TD', 'TH'].includes(cell.nodeName))
                    .map((cell) => escapeTableCell(cell.textContent || '')))
                .filter((cells) => cells.length > 0);

            if (rows.length === 0) {
                return '\n';
            }

            const hasHeaderRow = Array.from(node.querySelectorAll('tr')).some((row) =>
                Array.from(row.children).some((cell) => cell.nodeName === 'TH')
            );

            let header;
            let bodyRows;

            if (hasHeaderRow) {
                header = rows[0];
                bodyRows = rows.slice(1);
            } else if (rows.every((cells) => cells.length === 2)) {
                header = ['Field', 'Value'];
                bodyRows = rows;
            } else {
                const columnCount = Math.max(...rows.map((cells) => cells.length));
                header = Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`);
                bodyRows = rows.map((cells) => [...cells, ...Array(Math.max(0, columnCount - cells.length)).fill('')]);
            }

            const separator = header.map(() => '---');
            const tableLines = [
                `| ${header.join(' | ')} |`,
                `| ${separator.join(' | ')} |`,
                ...bodyRows.map((cells) => `| ${cells.join(' | ')} |`)
            ];

            return `\n${tableLines.join('\n')}\n`;
        }
    });

    // Custom image handling with absolute URLs
    turndownService.addRule('images', {
        filter: 'img',
        replacement: (content, node) => {
            const alt = node.getAttribute('alt') || '';
            // Try data-src first (lazy loading), then src
            let src = node.getAttribute('data-src') || node.getAttribute('src') || '';

            if (!src) return '';

            // Resolve to absolute URL
            src = resolveUrl(src, baseUrl);

            return `![${alt}](${src})`;
        }
    });

    // Better code block handling
    turndownService.addRule('preCode', {
        filter: (node) => {
            return node.nodeName === 'PRE' && node.querySelector('code');
        },
        replacement: (content, node) => {
            const code = node.querySelector('code');
            const language = code?.className?.match(/language-(\w+)/)?.[1] ||
                code?.className?.match(/(\w+)/)?.[1] || '';
            const text = code?.textContent || content;
            return `\n\`\`\`${language}\n${text.trim()}\n\`\`\`\n`;
        }
    });

    // Handle inline code
    turndownService.addRule('inlineCode', {
        filter: (node) => {
            return node.nodeName === 'CODE' && node.parentNode.nodeName !== 'PRE';
        },
        replacement: (content) => {
            return `\`${content}\``;
        }
    });

    // Handle section elements
    turndownService.addRule('section', {
        filter: 'section',
        replacement: (content) => content
    });

    // Handle links with absolute URLs
    turndownService.addRule('links', {
        filter: 'a',
        replacement: (content, node) => {
            let href = node.getAttribute('href') || '';
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
                return content;
            }

            // Resolve to absolute URL
            href = resolveUrl(href, baseUrl);

            const title = node.getAttribute('title');
            if (title) {
                return `[${content}](${href} "${title}")`;
            }
            return `[${content}](${href})`;
        }
    });

    return turndownService;
}

/**
 * Extract content from WeChat article pages
 */
function extractWeChatContent(doc) {
    const contentDiv = doc.querySelector('#js_content') ||
        doc.querySelector('.rich_media_content') ||
        doc.querySelector('[id*="content"]');

    if (!contentDiv) return null;

    // Clone and clean the content
    const clone = contentDiv.cloneNode(true);

    // Remove hidden elements
    clone.querySelectorAll('[style*="display: none"], [style*="display:none"], [hidden]').forEach(el => el.remove());

    // Make lazy-loaded images work
    clone.querySelectorAll('img[data-src]').forEach(img => {
        const dataSrc = img.getAttribute('data-src');
        if (dataSrc) {
            img.setAttribute('src', dataSrc);
        }
    });

    const title = doc.querySelector('#activity-name, .rich_media_title, h1')?.textContent?.trim() || 'WeChat Article';

    return {
        title,
        content: clone.innerHTML,
        excerpt: ''
    };
}

/**
 * Extract content from generic pages with fallback methods
 */
function extractGenericContent(doc) {
    // Pre-process: convert lazy-loaded images
    doc.querySelectorAll('img[data-src]').forEach(img => {
        const dataSrc = img.getAttribute('data-src');
        if (dataSrc && !img.getAttribute('src')) {
            img.setAttribute('src', dataSrc);
        }
    });

    // Try Readability first
    try {
        const reader = new Readability(doc.cloneNode(true), {
            keepClasses: false,
            charThreshold: 50,
        });

        const article = reader.parse();

        if (article && article.content && article.content.length > 100) {
            return article;
        }
    } catch (e) {
        console.warn('Readability failed:', e);
    }

    // Fallback: Try common content selectors
    const contentSelectors = [
        'article',
        '[role="main"]',
        'main',
        '.post-content',
        '.article-content',
        '.entry-content',
        '.content',
        '#content',
        '.main-content',
        '#main-content',
        '.post-body',
        '.article-body',
    ];

    for (const selector of contentSelectors) {
        const element = doc.querySelector(selector);
        if (element && element.textContent.trim().length > 100) {
            return {
                title: doc.querySelector('h1, title')?.textContent?.trim() || 'Untitled',
                content: element.innerHTML,
                excerpt: ''
            };
        }
    }

    // Last resort: Use body content but try to remove nav, header, footer
    const body = doc.body.cloneNode(true);
    ['nav', 'header', 'footer', 'aside', '.sidebar', '#sidebar', 'script', 'style', 'noscript'].forEach(sel => {
        body.querySelectorAll(sel).forEach(el => el.remove());
    });

    return {
        title: doc.querySelector('h1, title')?.textContent?.trim() || 'Untitled',
        content: body.innerHTML,
        excerpt: ''
    };
}

/**
 * Converts HTML to Markdown using Readability and Turndown
 * @param {string} html - Raw HTML content
 * @param {string} sourceUrl - The source URL for base path resolution
 * @returns {{title: string, markdown: string, excerpt: string}} - Converted content
 */
export function htmlToMarkdown(html, sourceUrl) {
    // Create a DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Set base URL for relative paths
    const baseElement = doc.createElement('base');
    baseElement.href = sourceUrl;
    doc.head.prepend(baseElement);

    // Detect site type and use appropriate extractor
    let article;

    if (sourceUrl.includes('mp.weixin.qq.com') || sourceUrl.includes('weixin.qq.com')) {
        // WeChat article
        article = extractWeChatContent(doc);
        if (!article) {
            throw new Error('Could not extract WeChat article content');
        }
    } else {
        // Generic page
        article = extractGenericContent(doc);
        if (!article) {
            throw new Error('Could not extract content from the page');
        }
    }

    // Convert to markdown with base URL for resolving relative paths
    const turndownService = createTurndownService(sourceUrl);
    const markdown = turndownService.turndown(article.content);

    // Clean up the markdown
    const cleanedMarkdown = markdown
        .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
        .replace(/\t/g, '  ')        // Replace tabs with spaces
        .trim();

    return {
        title: article.title || 'Untitled',
        markdown: cleanedMarkdown,
        excerpt: article.excerpt || '',
    };
}

/**
 * Formats the clipped content with metadata header
 * @param {string} markdown - The markdown content
 * @param {{title: string, sourceUrl: string, clipDate: string, excerpt: string}} metadata
 * @returns {string} - Formatted markdown with metadata
 */
export function formatClippedContent(markdown, metadata) {
    const header = [
        `# ${metadata.title}`,
        '',
        `> **Source**: ${metadata.sourceUrl}`,
        `> **Clipped**: ${metadata.clipDate}`,
        metadata.excerpt ? `> ${metadata.excerpt.substring(0, 200)}${metadata.excerpt.length > 200 ? '...' : ''}` : '',
        '',
        '---',
        '',
    ].filter(line => line !== undefined).join('\n');

    return header + markdown;
}
