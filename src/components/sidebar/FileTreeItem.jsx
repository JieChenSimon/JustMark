import { useState, useEffect, useRef, memo } from 'react';
import { IconDocument, IconFolder } from '../icons/AppIcons';

/**
 * 内联新建文件/文件夹输入行
 */
export const InlineCreateRow = memo(function InlineCreateRow({
    level,
    type,
    value,
    inputRef,
    onChange,
    onConfirm,
    onCancel
}) {
    const indent = level * 10;
    return (
        <div
            className="w-full px-1.5 py-0.5 text-left text-[11px] flex items-center gap-1 transition-all group"
        >
            <span className="shrink-0" style={{ width: `${indent + 8}px` }} />
            <span className="flex-shrink-0 text-black/30 dark:text-white/28">
                {type === 'folder' ? <IconFolder className="h-[15px] w-[15px]" /> : <IconDocument className="h-[15px] w-[15px]" />}
            </span>
            <input
                ref={inputRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        onConfirm();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        onCancel();
                    }
                }}
                className="flex-1 border-b border-black/10 bg-transparent text-[11px] text-[color:var(--jm-text)] outline-none focus:border-[var(--jm-accent)] dark:border-white/10"
                placeholder={type === 'folder' ? 'New folder' : 'New file'}
                autoComplete="off"
                autoFocus
            />
        </div>
    );
});

/**
 * 文件树节点组件 — 使用 memo 避免不必要的 re-render
 */
export const FileTreeItem = memo(function FileTreeItem({
    entry,
    basePath,
    rootPath,
    level,
    currentFilePath,
    selectedSidebarPath,
    expandedFolders,
    folderRefreshTimestamps,
    onToggleFolder,
    onOpenFile,
    getSubfolderContents,
    onStartInlineCreate,
    onDeleteEntry,
    onSelectEntry,
    onRenameEntry,
    onRevealInFinder,
    onDragStartEntry,
    onDragEndEntry,
    onDragHoverEntry,
    onDropEntry,
    inlineCreate,
    inlineInputRef,
    onInlineChange,
    onInlineConfirm,
    onInlineCancel,
    fileTags,
    draggedPath,
    dropTargetPath,
    invalidDropPath,
    dragOperation
}) {
    const resolveEntryPath = (item, parentPath) => item.path || `${parentPath}/${item.name}`;
    const getParentPath = (path) => path.slice(0, path.lastIndexOf('/'));
    const getPathDepth = (path, ancestorPath) => {
        if (!path || !ancestorPath || !path.startsWith(ancestorPath)) return 0;
        const relativePath = path.slice(ancestorPath.length);
        const segments = relativePath.split('/').filter(Boolean);
        return Math.max(0, segments.length - 1);
    };
    const [children, setChildren] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(entry.name);
    const renameInputRef = useRef(null);
    const contextMenuRef = useRef(null);
    const dragPreviewRef = useRef(null);
    const fullPath = resolveEntryPath(entry, basePath);
    const parentPath = getParentPath(fullPath);
    const isExpanded = expandedFolders.has(fullPath);
    const prevExpandedRef = useRef(isExpanded);
    const isCurrentDocument = currentFilePath === fullPath;
    const isSelected = selectedSidebarPath === fullPath;
    const indent = getPathDepth(fullPath, rootPath) * 10;
    const isDragged = draggedPath === fullPath;
    const isDropTarget = dropTargetPath === fullPath;
    const isInvalidDropTarget = invalidDropPath === fullPath;
    const contextMenuWidth = 168;
    const contextMenuHeight = entry.isDirectory ? 180 : 134;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : contextMenuWidth + 24;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : contextMenuHeight + 24;
    const contextMenuLeft = Math.max(12, Math.min(contextMenu?.x ?? 0, viewportWidth - contextMenuWidth - 12));
    const contextMenuTop = Math.max(12, Math.min(contextMenu?.y ?? 0, viewportHeight - contextMenuHeight - 12));

    useEffect(() => {
        // 折叠时立即清空 children，避免 DOM 抖动
        if (prevExpandedRef.current && !isExpanded) {
            setChildren([]);
            setIsLoading(false);
        }
        prevExpandedRef.current = isExpanded;

        const shouldLoad = entry.isDirectory && isExpanded;

        if (!shouldLoad) {
            return;
        }

        let cancelled = false;
        if (children.length === 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsLoading(true);
        }

        getSubfolderContents(fullPath)
            .then((contents) => {
                if (!cancelled) {
                    setChildren(contents);
                    setIsLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    if (children.length === 0) {
                        setChildren([]);
                        setIsLoading(false);
                    }
                }
            });

        return () => {
            cancelled = true;
        };
    }, [entry.isDirectory, isExpanded, folderRefreshTimestamps, fullPath, getSubfolderContents]);

    const handleClick = () => {
        if (entry.isDirectory) {
            onToggleFolder(fullPath);
        } else {
            if (onSelectEntry) {
                onSelectEntry(fullPath, entry.isDirectory);
            }
            onOpenFile(fullPath);
        }
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onSelectEntry) {
            onSelectEntry(fullPath, entry.isDirectory);
        }

        // 获取鼠标位置
        const x = e.clientX;
        const y = e.clientY;

        setContextMenu({
            x,
            y,
            type: entry.isDirectory ? 'folder' : 'file',
            path: fullPath
        });
    };

    const handleDragStart = (e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'copyMove';
        e.dataTransfer.setData('text/plain', fullPath);
        const dragPreview = document.createElement('div');
        dragPreview.className = 'pointer-events-none rounded-xl border border-slate-300/60 bg-white/88 px-3 py-1.5 text-[11px] font-medium text-slate-800 shadow-[0_14px_28px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-slate-600/60 dark:bg-slate-900/88 dark:text-slate-100';
        dragPreview.textContent = `${dragOperation === 'copy' ? '➕' : '↘'} ${entry.name}`;
        dragPreview.style.position = 'fixed';
        dragPreview.style.top = '-1000px';
        dragPreview.style.left = '-1000px';
        document.body.appendChild(dragPreview);
        dragPreviewRef.current = dragPreview;
        e.dataTransfer.setDragImage(dragPreview, 14, 14);
        onDragStartEntry?.(fullPath, entry.isDirectory);
    };

    const handleDragEnd = (e) => {
        e.stopPropagation();
        if (dragPreviewRef.current) {
            dragPreviewRef.current.remove();
            dragPreviewRef.current = null;
        }
        onDragEndEntry?.();
    };

    const handleDragOver = (e) => {
        if (!entry.isDirectory) return;
        e.preventDefault();
        e.stopPropagation();
        onDragHoverEntry?.(fullPath, true, e.altKey);
        e.dataTransfer.dropEffect = isInvalidDropTarget ? 'none' : dragOperation;
    };

    const handleDrop = (e) => {
        if (!entry.isDirectory) return;
        e.preventDefault();
        e.stopPropagation();
        onDropEntry?.(fullPath);
    };

    useEffect(() => {
        if (!contextMenu) {
            return undefined;
        }

        const handlePointerDown = (event) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
                setContextMenu(null);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setContextMenu(null);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [contextMenu]);

    return (
        <>
            <button
                data-tree-node="true"
                data-path={fullPath}
                data-parent-path={parentPath}
                data-is-directory={entry.isDirectory ? 'true' : 'false'}
                data-expanded={isExpanded ? 'true' : 'false'}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                draggable={!isRenaming}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`select-none px-1.5 py-0.5 text-left text-[11px] flex items-center gap-1 transition-colors group rounded-[7px] ${isDropTarget
                    ? 'bg-[color:var(--jm-sidebar-active)] ring-1 ring-inset ring-[color:var(--jm-sidebar-active-border)]'
                    : isInvalidDropTarget
                        ? 'bg-red-500/6 ring-1 ring-inset ring-red-500/35'
                        : isSelected
                    ? 'bg-[color:var(--jm-sidebar-active)] text-[color:var(--jm-accent)] ring-1 ring-inset ring-[color:var(--jm-sidebar-active-border)] dark:text-blue-200'
                    : 'text-[color:var(--jm-text)]/88 hover:bg-[color:var(--jm-sidebar-hover)] dark:hover:bg-[color:var(--jm-sidebar-hover)]'
                    } ${isDragged ? 'opacity-45 scale-[0.985]' : ''}`}
            >
                <span className="shrink-0" style={{ width: `${indent + 8}px` }} />
                {entry.isDirectory && (
                    <svg
                        className={`w-3 h-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''} ${isSelected ? 'text-[color:var(--jm-accent)] dark:text-blue-300' : 'text-black/24 dark:text-white/26'
                            }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                )}
                {!entry.isDirectory && <span className="w-3 h-3 shrink-0" />}
                <span className={`flex-shrink-0 ${isSelected ? 'opacity-100 text-[color:var(--jm-accent)] dark:text-blue-300' : 'opacity-60 text-black/24 dark:text-white/26'}`}>
                    {entry.isDirectory ? <IconFolder className="h-[15px] w-[15px]" /> : <IconDocument className="h-[15px] w-[15px]" />}
                </span>
                {isRenaming ? (
                    <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                const trimmed = renameValue.trim();
                                if (trimmed && trimmed !== entry.name) {
                                    onRenameEntry(fullPath, trimmed);
                                }
                                setIsRenaming(false);
                            } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setRenameValue(entry.name);
                                setIsRenaming(false);
                            }
                        }}
                        onBlur={() => {
                            const trimmed = renameValue.trim();
                            if (trimmed && trimmed !== entry.name) {
                                onRenameEntry(fullPath, trimmed);
                            }
                            setIsRenaming(false);
                        }}
                                className="flex-1 border-b border-[var(--jm-accent)] bg-transparent text-[11px] text-[color:var(--jm-text)] outline-none"
                        autoComplete="off"
                    />
                ) : (
                    <>
                        <span className={`truncate ${isSelected ? 'font-medium' : 'font-normal'} ${isCurrentDocument && !isSelected ? 'text-[color:var(--jm-text)]/94' : ''}`}>
                            {entry.name}
                        </span>
                        {isCurrentDocument && !isSelected && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--jm-accent)]" />
                        )}
                        {isDropTarget && (
                            <span className="ml-auto rounded-lg border border-[color:var(--jm-accent)]/16 bg-white/72 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.08em] uppercase text-[color:var(--jm-accent)] dark:bg-neutral-900/60">
                                {dragOperation === 'copy' ? 'Copy Here' : 'Move Here'}
                            </span>
                        )}
                        {!entry.isDirectory && fileTags && fileTags[fullPath] && fileTags[fullPath].length > 0 && (
                            <div className="flex gap-0.5 ml-1 flex-shrink-0">
                                {fileTags[fullPath].slice(0, 2).map((tag, i) => (
                                    <span
                                        key={i}
                                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: tag.color }}
                                        title={tag.name}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </button>

            {/* macOS 原生风格右键菜单 */}
            {contextMenu && contextMenu.path === fullPath && (
                <div
                    ref={contextMenuRef}
                    className="jm-sidebar-context-menu fixed z-50 origin-top-left animate-scale-in"
                    style={{
                        top: `${contextMenuTop}px`,
                        left: `${contextMenuLeft}px`,
                        width: `${contextMenuWidth}px`
                    }}
                >
                    {contextMenu.type === 'folder' && (
                        <>
                            <button
                                onClick={() => {
                                    onStartInlineCreate(fullPath, 'file');
                                    setContextMenu(null);
                                }}
                                className="jm-sidebar-context-menu-item"
                            >
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                                <span>New File</span>
                            </button>
                            <button
                                onClick={() => {
                                    onStartInlineCreate(fullPath, 'folder');
                                    setContextMenu(null);
                                }}
                                className="jm-sidebar-context-menu-item"
                            >
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7a2 2 0 012-2h3l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" />
                                </svg>
                                <span>New Folder</span>
                            </button>
                            <div className="jm-sidebar-context-menu-separator" />
                        </>
                    )}
                    <button
                        onClick={() => {
                            setRenameValue(entry.name);
                            setIsRenaming(true);
                            setContextMenu(null);
                            setTimeout(() => {
                                if (renameInputRef.current) {
                                    renameInputRef.current.focus();
                                    const dotIndex = entry.name.lastIndexOf('.');
                                    if (!entry.isDirectory && dotIndex > 0) {
                                        renameInputRef.current.setSelectionRange(0, dotIndex);
                                    } else {
                                        renameInputRef.current.select();
                                    }
                                }
                            }, 50);
                        }}
                        className="jm-sidebar-context-menu-item"
                    >
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Rename</span>
                    </button>
                    <button
                        onClick={() => {
                            onRevealInFinder(fullPath);
                            setContextMenu(null);
                        }}
                        className="jm-sidebar-context-menu-item"
                    >
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        <span>Reveal in Finder</span>
                    </button>
                    <div className="jm-sidebar-context-menu-separator" />
                    <button
                        onClick={(e) => {
                            onDeleteEntry(fullPath, e);
                            setContextMenu(null);
                        }}
                        className="jm-sidebar-context-menu-item jm-sidebar-context-menu-item-danger"
                    >
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3H4v2h16V7h-3z" />
                        </svg>
                        <span>Delete</span>
                    </button>
                </div>
            )}

            {entry.isDirectory && (
                <div className={`jm-tree-children${isExpanded ? ' expanded' : ''}`}>
                    {isLoading ? (
                        <div className="w-full px-1.5 py-0.5 text-[10px] text-black/30 dark:text-white/28">
                            <span className="inline-block" style={{ width: `${indent + 24}px` }} />
                            Loading…
                        </div>
                    ) : (
                        children.map((child) => (
                            <FileTreeItem
                                key={child.path || `${fullPath}/${child.name}`}
                                entry={child}
                                basePath={getParentPath(resolveEntryPath(child, fullPath))}
                                rootPath={rootPath}
                                level={level + 1}
                                currentFilePath={currentFilePath}
                                selectedSidebarPath={selectedSidebarPath}
                                expandedFolders={expandedFolders}
                                folderRefreshTimestamps={folderRefreshTimestamps}
                                onToggleFolder={onToggleFolder}
                                onOpenFile={onOpenFile}
                                getSubfolderContents={getSubfolderContents}
                                onStartInlineCreate={onStartInlineCreate}
                                onDeleteEntry={onDeleteEntry}
                                onRenameEntry={onRenameEntry}
                                onRevealInFinder={onRevealInFinder}
                                onDragStartEntry={onDragStartEntry}
                                onDragEndEntry={onDragEndEntry}
                                onDragHoverEntry={onDragHoverEntry}
                                onDropEntry={onDropEntry}
                                inlineCreate={inlineCreate}
                                inlineInputRef={inlineInputRef}
                                onInlineChange={onInlineChange}
                                onInlineConfirm={onInlineConfirm}
                                onInlineCancel={onInlineCancel}
                                onSelectEntry={onSelectEntry}
                                fileTags={fileTags}
                                draggedPath={draggedPath}
                                dropTargetPath={dropTargetPath}
                                invalidDropPath={invalidDropPath}
                                dragOperation={dragOperation}
                            />
                        ))
                    )}
                    {inlineCreate && inlineCreate.parentPath === fullPath && (
                        <InlineCreateRow
                            level={level + 1}
                            type={inlineCreate.type}
                            value={inlineCreate.value}
                            inputRef={inlineInputRef}
                            onChange={onInlineChange}
                            onConfirm={onInlineConfirm}
                            onCancel={onInlineCancel}
                        />
                    )}
                </div>
            )}
        </>
    );
});
