"use client"
import Editor, { OnMount } from "@monaco-editor/react"
import { useRef } from "react"

interface EditorProps {
    code: string
    onChange: (value: string | undefined) => void
}

export default function CodeEditor({ code, onChange }: EditorProps) {
    const editorRef = useRef<any>(null)

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor

        // Enable search with Ctrl+F (already built-in, just ensuring it's accessible)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
            editor.getAction('actions.find')?.run()
        })

        // Enable command palette with Ctrl+Shift+P or F1
        editor.addCommand(monaco.KeyCode.F1, () => {
            editor.trigger('', 'editor.action.quickCommand', null)
        })
    }

    return (
        <main className="flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden relative">
            {/* Breadcrumbs */}
            <div className="glass-light px-6 py-3 border-b border-primary/10 text-sm text-muted-foreground bg-[#1e1e1e]">
                <span className="hover:text-primary cursor-pointer transition-colors">src</span>
                <span className="mx-2 text-primary/50">/</span>
                <span className="hover:text-primary cursor-pointer transition-colors">contracts</span>
                <span className="mx-2 text-primary/50">/</span>
                <span className="hover:text-primary cursor-pointer transition-colors">hello_world</span>
                <span className="mx-2 text-primary/50">/</span>
                <span className="text-primary">lib.rs</span>
            </div>

            <div className="flex-1">
                <Editor
                    height="100%"
                    defaultLanguage="rust"
                    theme="vs-dark"
                    value={code}
                    onChange={onChange}
                    onMount={handleEditorDidMount}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        fontFamily: "JetBrains Mono, monospace",
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        padding: { top: 16 },
                        find: {
                            addExtraSpaceOnTop: false,
                            autoFindInSelection: 'never',
                            seedSearchStringFromSelection: 'always'
                        },
                        quickSuggestions: true,
                        suggestOnTriggerCharacters: true,
                        acceptSuggestionOnEnter: "on",
                        tabCompletion: "on",
                        wordBasedSuggestions: "matchingDocuments"
                    }}
                />
            </div>

            {/* Glow effect */}
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-primary/5 via-transparent to-transparent blur-3xl pointer-events-none"></div>
        </main>
    )
}
