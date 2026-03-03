import { useRef, useState } from 'preact/hooks';
import felFunctionsSchema from '../../../../schemas/fel-functions.schema.json';

const FEL_GRAMMAR = `Variables:
$fieldKey       (Field from nearest scope)
$parent.child   (Nested field via dot-notation)
$repeat[n]      (1-based target in repeat array)
@index          (1-based position in repeat)
@current        (Current repeat instance)

Operators (highest to lowest precedence):
postfix         ($a.b, $a[1])
unary           (-, not)
multiply        (*, /, %)
add/concat      (+, -, &)
null-coalesce   (??)
membership      (in, not in)
comparison      (<, >, <=, >=)
equality        (=, !=)
logical AND     (and)
logical OR      (or)
ternary         (? :)
`;

export function FelHelper() {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'grammar' | 'functions'>('functions');

    function openDialog() {
        dialogRef.current?.showModal();
    }

    function closeDialog() {
        dialogRef.current?.close();
    }

    const filteredFunctions = felFunctionsSchema.functions.filter((f) => {
        const search = searchTerm.toLowerCase();
        return (
            f.name.toLowerCase().includes(search) ||
            f.description.toLowerCase().includes(search)
        );
    });

    return (
        <>
            <button
                class="fel-helper-btn"
                onClick={openDialog}
                title="FEL Quick Reference"
                type="button"
            >
                ƒx
            </button>

            <dialog ref={dialogRef} class="fel-dialog" onClick={(e) => {
                if (e.target === dialogRef.current) closeDialog();
            }}>
                <div class="fel-dialog-content">
                    <div class="fel-dialog-header">
                        <h3 class="fel-dialog-title">FEL Reference</h3>
                        <button class="fel-dialog-close" onClick={closeDialog} type="button">×</button>
                    </div>

                    <div class="fel-dialog-tabs">
                        <button
                            class={`fel-tab ${activeTab === 'functions' ? 'active' : ''}`}
                            onClick={() => setActiveTab('functions')}
                            type="button"
                        >
                            Functions
                        </button>
                        <button
                            class={`fel-tab ${activeTab === 'grammar' ? 'active' : ''}`}
                            onClick={() => setActiveTab('grammar')}
                            type="button"
                        >
                            Grammar
                        </button>
                    </div>

                    <div class="fel-dialog-body">
                        {activeTab === 'grammar' ? (
                            <pre class="fel-grammar-pre">{FEL_GRAMMAR}</pre>
                        ) : (
                            <div class="fel-functions-view">
                                <input
                                    class="studio-input fel-search-input"
                                    placeholder="Search functions..."
                                    value={searchTerm}
                                    onInput={(e) => setSearchTerm(e.currentTarget.value)}
                                />
                                <div class="fel-functions-list">
                                    {filteredFunctions.map((f: any) => (
                                        <div class="fel-function-card" key={f.name}>
                                            <div class="fel-function-header">
                                                <span class="fel-function-name">{f.name}</span>
                                                <span class="fel-function-signature">
                                                    ({(f.parameters || []).map((p: any) => p.name).join(', ')})
                                                </span>
                                                <span class="fel-function-returns"> → {f.returns}</span>
                                            </div>
                                            <div class="fel-function-desc">{f.description}</div>
                                            {f.examples && f.examples.length > 0 && (
                                                <div class="fel-function-example">
                                                    <strong>Ex:</strong> <code>{f.examples[0].expression}</code>
                                                    <span class="fel-example-result"> ➔ {JSON.stringify(f.examples[0].result)}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {filteredFunctions.length === 0 && (
                                        <div class="fel-no-results">No functions found.</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </dialog>
        </>
    );
}
