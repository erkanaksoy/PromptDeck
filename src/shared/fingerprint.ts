export function lightweightHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function responseFingerprint(
  platform: string,
  identity: string,
  text: string,
  order: number
): string {
  return `${platform}:${lightweightHash(`${identity}|${order}|${text.trim().slice(-1600)}`)}`;
}
