export const selectionTimelineKeys = {
  categoryOption: (groupId: string, optionId: string) =>
    `cat:${groupId}:${optionId}`,
  productRec: (groupId: string) => `rec:${groupId}`,
  personalize: (groupId: string, optionId: string) =>
    `pers:${groupId}:${optionId}`,
};

export function appendSelectionTimeline(
  timeline: string[],
  key: string
): string[] {
  return timeline.includes(key) ? timeline : [...timeline, key];
}

export function removeSelectionTimeline(
  timeline: string[],
  key: string
): string[] {
  return timeline.filter((k) => k !== key);
}

export function removeSelectionTimelinePrefix(
  timeline: string[],
  prefix: string
): string[] {
  return timeline.filter((k) => !k.startsWith(prefix));
}

export function parseSelectionTimelineKey(key: string):
  | { kind: 'category'; groupId: string; optionId: string }
  | { kind: 'productRec'; groupId: string }
  | { kind: 'personalize'; groupId: string; optionId: string }
  | null {
  if (key.startsWith('cat:')) {
    const parts = key.split(':');
    const groupId = parts[1];
    const optionId = parts.slice(2).join(':');
    if (!groupId || !optionId) return null;
    return { kind: 'category', groupId, optionId };
  }
  if (key.startsWith('rec:')) {
    const groupId = key.slice(4);
    if (!groupId) return null;
    return { kind: 'productRec', groupId };
  }
  if (key.startsWith('pers:')) {
    const parts = key.split(':');
    const groupId = parts[1];
    const optionId = parts.slice(2).join(':');
    if (!groupId || !optionId) return null;
    return { kind: 'personalize', groupId, optionId };
  }
  return null;
}
