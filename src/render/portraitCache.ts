/**
 * Memoising cache keyed by species + shiny. Guarantees the expensive `render` callback runs at most
 * once per key (until `clear`).
 */
export function portraitKey(speciesId: string, shiny: boolean): string {
  return `${shiny ? '1' : '0'}:${speciesId}`;
}

export class PortraitCache<T> {
  private readonly items = new Map<string, T>();
  renders = 0;

  constructor(private readonly render: (speciesId: string, shiny: boolean) => T) {}

  has(speciesId: string, shiny = false): boolean {
    return this.items.has(portraitKey(speciesId, shiny));
  }

  get(speciesId: string, shiny = false): T {
    const key = portraitKey(speciesId, shiny);
    const hit = this.items.get(key);
    if (hit !== undefined) return hit;
    this.renders += 1;
    const made = this.render(speciesId, shiny);
    this.items.set(key, made);
    return made;
  }

  clear(): void {
    this.items.clear();
  }
}

/**
 * Runs queued jobs until `budgetMs` elapses (always at least one), returning how many ran.
 * `now` is injectable for tests.
 */
export function runWithinBudget(queue: Array<() => void>, budgetMs: number, now: () => number = () => performance.now()): number {
  const start = now();
  let ran = 0;
  while (queue.length > 0 && (ran === 0 || now() - start < budgetMs)) {
    const job = queue.shift();
    job?.();
    ran += 1;
  }
  return ran;
}
