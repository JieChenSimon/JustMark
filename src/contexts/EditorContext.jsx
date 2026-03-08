import { createContext, useContext, useState, useRef } from 'react';

const EditorContext = createContext();

export const EditorProvider = ({ children }) => {
  const [markdown, setMarkdown] = useState("### JustMark\n Write in a single way...");
  const [currentFilePath, setCurrentFilePath] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const markdownRef = useRef(markdown);

  return (
    <EditorContext.Provider value={{
      markdown, setMarkdown,
      currentFilePath, setCurrentFilePath,
      hasUnsavedChanges, setHasUnsavedChanges,
      markdownRef
    }}>
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => useContext(EditorContext);
