/** @filedesc USWDS side-by-side presets — shared engine initialData and Real USWDS mirror state by definition title. */

/** Flat paths + repeat counts for the React “Real USWDS” comparison pane. */
export type RealUswdsRenderPreset = {
    errors: Record<string, string>;
    values: Record<string, any>;
    repeats: Record<string, number>;
};

/** Preset for `RealUSWDSStory` (flat field paths). */
export function getRealUswdsPreset(definition: { title?: string } | null | undefined): RealUswdsRenderPreset {
    switch (definition?.title) {
        case 'Conditional Fields':
            return { errors: {}, values: { hasOther: true }, repeats: {} };
        case 'Validation Demo':
            return {
                errors: {
                    username: 'Username must be 3-20 characters',
                    password: 'Password must be at least 8 characters',
                },
                values: { username: 'ab', password: 'short' },
                repeats: {},
            };
        case 'Repeat Group':
            return {
                errors: {},
                values: {
                    'members[0].memberName': 'Avery Chen',
                    'members[0].memberRole': 'Project Lead',
                    'members[1].memberName': 'Jordan Patel',
                    'members[1].memberRole': 'Technical Writer',
                },
                repeats: { members: 2 },
            };
        default:
            return { errors: {}, values: {}, repeats: {} };
    }
}

/** Formspec `initialData` (response `data` shape) for `<formspec-render>` — mirrors {@link getRealUswdsPreset}. */
export function getAdapterHydrationForDefinition(definition: { title?: string } | null | undefined): {
    initialData?: Record<string, any>;
    touchAll?: boolean;
} {
    switch (definition?.title) {
        case 'Conditional Fields':
            return { initialData: { hasOther: true } };
        case 'Validation Demo':
            return { initialData: { username: 'ab', password: 'short' }, touchAll: true };
        case 'Repeat Group':
            return {
                initialData: {
                    members: [
                        { memberName: 'Avery Chen', memberRole: 'Project Lead' },
                        { memberName: 'Jordan Patel', memberRole: 'Technical Writer' },
                    ],
                },
            };
        default:
            return {};
    }
}
