import { visit } from 'unist-util-visit';

/**
 * Remark plugin to convert Obsidian wiki-link image syntax to standard markdown
 * Converts ![[image.png]] to ![](attachmentFolder/image.png)
 */
export function remarkObsidianImage(options = {}) {
    const attachmentFolder = options.attachmentFolder || '00- Attachment';

    console.log('🔧 Obsidian Image Plugin initialized with folder:', attachmentFolder);

    return (tree) => {
        visit(tree, 'text', (node, index, parent) => {
            if (!node.value) return;

            // Match Obsidian image syntax: ![[filename.ext]]
            // Support common image extensions
            const regex = /!\[\[([^\]]+\.(png|jpg|jpeg|gif|webp|svg|bmp|ico))\]\]/gi;

            const parts = [];
            let lastIndex = 0;
            let match;
            let hasMatches = false;

            while ((match = regex.exec(node.value)) !== null) {
                hasMatches = true;
                const filename = match[1];

                console.log('🖼️ Found Obsidian image:', {
                    original: match[0],
                    filename,
                    attachmentFolder
                });

                // Add text before match
                if (match.index > lastIndex) {
                    parts.push({
                        type: 'text',
                        value: node.value.substring(lastIndex, match.index)
                    });
                }

                // Add image node with standard markdown syntax
                const newSyntax = `![](${attachmentFolder}/${filename})`;
                console.log('  → Converting to:', newSyntax);

                parts.push({
                    type: 'text',
                    value: newSyntax
                });

                lastIndex = match.index + match[0].length;
            }

            // Add remaining text
            if (lastIndex < node.value.length) {
                parts.push({
                    type: 'text',
                    value: node.value.substring(lastIndex)
                });
            }

            // Replace node if we found matches
            if (hasMatches && parts.length > 0) {
                console.log('✅ Replacing node with', parts.length, 'parts');
                parent.children.splice(index, 1, ...parts);
            }
        });
    };
}
