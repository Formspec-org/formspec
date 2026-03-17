/** @filedesc Stories dev app: orchestrates story selection, JSON editors, and live preview pane. */
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { storyGroups, Story, defaultThemeDoc } from './stories';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { Preview } from './components/Preview';
import { EngineOutput } from './components/EngineOutput';

export function App() {
    const [selectedGroup, setSelectedGroup] = useState(0);
    const [selectedStory, setSelectedStory] = useState(0);
    const [defText, setDefText] = useState('');
    const [compText, setCompText] = useState('');
    const [themeText, setThemeText] = useState('');
    const [defError, setDefError] = useState<string | null>(null);
    const [compError, setCompError] = useState<string | null>(null);
    const [themeError, setThemeError] = useState<string | null>(null);
    const [parsedDef, setParsedDef] = useState<object | null>(null);
    const [parsedComp, setParsedComp] = useState<object | null>(null);
    const [parsedTheme, setParsedTheme] = useState<object | null>(null);
    const [engineOutput, setEngineOutput] = useState<{ validation: unknown; response: unknown } | null>(null);
    const previewRef = useRef<HTMLElement>(null);
    const defDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    const compDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    const themeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    // True once the user manually edits the theme editor; cleared when a story with a themeDoc is selected
    const themeDirty = useRef(false);
    // Track whether theme editor has been populated at all (for first-load default)
    const themeLoaded = useRef(false);

    const loadStory = useCallback((groupIdx: number, storyIdx: number) => {
        const story: Story = storyGroups[groupIdx].stories[storyIdx];
        setSelectedGroup(groupIdx);
        setSelectedStory(storyIdx);
        setDefText(JSON.stringify(story.definition, null, 2));
        setCompText(JSON.stringify(story.componentDoc, null, 2));
        setDefError(null);
        setCompError(null);
        setParsedDef(story.definition);
        setParsedComp(story.componentDoc);
        setEngineOutput(null);

        // Update theme editor when:
        //  - story defines its own themeDoc (always applies, resets dirty flag), OR
        //  - no theme has been loaded yet (first load)
        if (story.themeDoc) {
            setThemeText(JSON.stringify(story.themeDoc, null, 2));
            setParsedTheme(story.themeDoc);
            setThemeError(null);
            themeDirty.current = false;
            themeLoaded.current = true;
        } else if (!themeLoaded.current) {
            // Initial load — populate with default starter theme
            const str = JSON.stringify(defaultThemeDoc, null, 2);
            setThemeText(str);
            setParsedTheme(defaultThemeDoc);
            themeLoaded.current = true;
        }
        // Otherwise: story has no themeDoc and user has edited the theme → leave it alone
    }, []);

    useEffect(() => {
        loadStory(0, 0);
    }, []);

    const onDefChange = useCallback((text: string) => {
        setDefText(text);
        if (defDebounce.current) clearTimeout(defDebounce.current);
        defDebounce.current = setTimeout(() => {
            try { setParsedDef(JSON.parse(text)); setDefError(null); }
            catch (e) { setDefError((e as Error).message); }
        }, 350);
    }, []);

    const onCompChange = useCallback((text: string) => {
        setCompText(text);
        if (compDebounce.current) clearTimeout(compDebounce.current);
        compDebounce.current = setTimeout(() => {
            try { setParsedComp(JSON.parse(text)); setCompError(null); }
            catch (e) { setCompError((e as Error).message); }
        }, 350);
    }, []);

    const onThemeChange = useCallback((text: string) => {
        themeDirty.current = true;
        setThemeText(text);
        if (themeDebounce.current) clearTimeout(themeDebounce.current);
        themeDebounce.current = setTimeout(() => {
            try { setParsedTheme(JSON.parse(text)); setThemeError(null); }
            catch (e) { setThemeError((e as Error).message); }
        }, 350);
    }, []);

    const refreshOutput = useCallback(() => {
        const el = previewRef.current as any;
        if (!el) return;
        const engine = el.getEngine?.();
        if (!engine) return;
        try {
            const validation = engine.getValidationReport({ mode: 'continuous' });
            const response = el.submit?.({ mode: 'continuous', emitEvent: false })?.response ?? null;
            setEngineOutput({ validation, response });
        } catch {
            setEngineOutput(null);
        }
    }, []);

    return (
        <div class="shell">
            <Sidebar
                groups={storyGroups}
                selectedGroup={selectedGroup}
                selectedStory={selectedStory}
                onSelect={loadStory}
            />
            <Editor
                defText={defText}
                compText={compText}
                themeText={themeText}
                defError={defError}
                compError={compError}
                themeError={themeError}
                onDefChange={onDefChange}
                onCompChange={onCompChange}
                onThemeChange={onThemeChange}
            />
            <div class="canvas">
                <Preview
                    ref={previewRef}
                    definition={parsedDef}
                    componentDoc={parsedComp}
                    themeDoc={parsedTheme}
                />
                <EngineOutput
                    output={engineOutput}
                    onRefresh={refreshOutput}
                />
            </div>
        </div>
    );
}
