/** @filedesc Shared shell viewport background gradients (Studio + assistant workspace). */

export function getShellBackgroundImage(theme: 'light' | 'dark'): string {
  if (theme === 'dark') {
    return [
      'radial-gradient(circle at 0% 0%, rgba(123,161,255,0.13), transparent 26%)',
      'radial-gradient(circle at 100% 0%, rgba(131,216,219,0.11), transparent 28%)',
      'linear-gradient(180deg, rgba(19,24,33,0.96), rgba(23,32,46,0.98) 34%, rgba(27,38,54,0.94) 100%)',
    ].join(', ');
  }
  return [
    'radial-gradient(circle at 0% 0%, rgba(183,121,31,0.12), transparent 26%)',
    'radial-gradient(circle at 100% 0%, rgba(47,107,126,0.12), transparent 28%)',
    'linear-gradient(180deg, rgba(255,249,241,0.8), rgba(246,240,232,0.96) 34%, rgba(241,232,220,0.82) 100%)',
  ].join(', ');
}
