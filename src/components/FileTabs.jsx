import { useRef, useEffect, useState } from 'react';
import './FileTabs.css';

/**
 * FileTabs - compact macOS-style tab strip
 */
const FileTabs = ({ openFiles, activeFilePath, onSwitchFile, onCloseFile, onNewFile }) => {
  const scrollContainerRef = useRef(null);
  const [hoveredTab, setHoveredTab] = useState(null);

  // Auto-scroll to active tab when it changes
  useEffect(() => {
    if (!scrollContainerRef.current || !activeFilePath) return;

    const activeTab = scrollContainerRef.current.querySelector(`[data-tab-path="${activeFilePath}"]`);
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeFilePath]);

  const getFileName = (path) => {
    return path.split('/').pop() || path;
  };

  const isUnsaved = (file) => {
    return file.content !== file.savedContent;
  };

  const handleCloseClick = (e, filePath) => {
    e.stopPropagation();
    onCloseFile(filePath);
  };

  const handleTabKeyDown = (event, filePath) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSwitchFile(filePath);
    }
  };

  if (openFiles.length === 0) {
    return null;
  }

  return (
    <div className="jm-file-tabs-container">
      <div
        ref={scrollContainerRef}
        className="jm-file-tabs-scroll"
      >
        {openFiles.map((file) => {
          const isActive = file.path === activeFilePath;
          const unsaved = isUnsaved(file);
          const fileName = getFileName(file.path);
          const isHovered = hoveredTab === file.path;

          return (
            <div
              key={file.path}
              data-tab-path={file.path}
              role="tab"
              tabIndex={0}
              aria-selected={isActive}
              className={`jm-file-tab ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
              onClick={() => onSwitchFile(file.path)}
              onKeyDown={(event) => handleTabKeyDown(event, file.path)}
              onMouseEnter={() => setHoveredTab(file.path)}
              onMouseLeave={() => setHoveredTab(null)}
              title={file.path}
            >
              <span className="jm-tab-leading">
                {unsaved ? (
                  <span className="jm-tab-unsaved-dot" />
                ) : (
                  <span className="jm-tab-file-dot" />
                )}
              </span>

              <span className="jm-tab-name">
                {fileName}
              </span>

              <button
                type="button"
                className="jm-tab-close"
                onClick={(e) => handleCloseClick(e, file.path)}
                tabIndex={-1}
                aria-label={`Close ${fileName}`}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M1 1L9 9M9 1L1 9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* New file button */}
      <button
        type="button"
        className="jm-file-tab-new"
        onClick={onNewFile}
        title="New File"
        aria-label="New file"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M6 1V11M1 6H11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
};

export default FileTabs;
