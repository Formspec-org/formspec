/** @filedesc Tabbed panel displaying FormEngine validation report and response JSON. */
import { useState } from 'preact/hooks';

interface Props {
    output: { validation: unknown; response: unknown } | null;
    onRefresh: () => void;
}

type Tab = 'validation' | 'response';

export function EngineOutput({ output, onRefresh }: Props) {
    const [tab, setTab] = useState<Tab>('validation');

    const content = output
        ? JSON.stringify(tab === 'validation' ? output.validation : output.response, null, 2)
        : null;

    return (
        <div class="engine-output">
            <div class="engine-toolbar">
                <button
                    class={`engine-tab${tab === 'validation' ? ' engine-tab--active' : ''}`}
                    onClick={() => setTab('validation')}
                >
                    Validation
                </button>
                <button
                    class={`engine-tab${tab === 'response' ? ' engine-tab--active' : ''}`}
                    onClick={() => setTab('response')}
                >
                    Response
                </button>
                <button class="engine-refresh" onClick={onRefresh} title="Read engine state">
                    ↻ Refresh
                </button>
            </div>
            <pre class="engine-pre">
                {content ?? <span class="engine-empty">Click ↻ Refresh to read engine state</span>}
            </pre>
        </div>
    );
}
