/** @filedesc Story navigation sidebar with search and collapsible story groups. */
import { useState } from 'preact/hooks';
import { StoryGroup } from '../stories';

interface Props {
    groups: StoryGroup[];
    selectedGroup: number;
    selectedStory: number;
    onSelect: (groupIdx: number, storyIdx: number) => void;
}

export function Sidebar({ groups, selectedGroup, selectedStory, onSelect }: Props) {
    const [search, setSearch] = useState('');
    const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

    const toggleGroup = (idx: number) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const q = search.toLowerCase();

    return (
        <aside class="sidebar">
            <div class="sidebar-header">
                <span class="sidebar-logo">Formspec</span>
                <span class="sidebar-subtitle">Stories</span>
            </div>
            <div class="sidebar-search">
                <input
                    type="search"
                    placeholder="Search components…"
                    value={search}
                    onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
                />
            </div>
            <nav class="sidebar-nav">
                {groups.map((group, gi) => {
                    const filtered = group.stories.filter(s =>
                        !q || s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
                    );
                    if (filtered.length === 0) return null;
                    const isCollapsed = collapsed.has(gi) && !q;
                    return (
                        <div key={group.label} class="nav-group">
                            <button
                                class="nav-group-header"
                                onClick={() => toggleGroup(gi)}
                                aria-expanded={!isCollapsed}
                            >
                                <span class="nav-group-arrow">{isCollapsed ? '▶' : '▼'}</span>
                                {group.label}
                                <span class="nav-group-count">{group.stories.length}</span>
                            </button>
                            {!isCollapsed && (
                                <ul class="nav-stories">
                                    {filtered.map(story => {
                                        const si = group.stories.indexOf(story);
                                        const active = gi === selectedGroup && si === selectedStory;
                                        return (
                                            <li key={story.label}>
                                                <button
                                                    class={`nav-story${active ? ' nav-story--active' : ''}`}
                                                    onClick={() => onSelect(gi, si)}
                                                    title={story.description}
                                                >
                                                    {story.label}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </nav>
        </aside>
    );
}
