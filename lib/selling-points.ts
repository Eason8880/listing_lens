import type { SellingPointItem } from "@/lib/types";

function cleanLine(line: string) {
  return line.replace(/^[\-\*\d\.\)\(\s]+/, "").trim();
}

function cleanTarget(target: string) {
  return target.replace(/\s*(?:→|—|–|-|=|:|\|)\s*$/u, "").trim();
}

function isNoTextMessage(line: string) {
  return /未检测到卖点文字/i.test(line);
}

function hasChinese(line: string) {
  return /[\u4e00-\u9fff]/u.test(line);
}

function isTargetFragment(line: string) {
  return /^[A-Za-z0-9&/()+,.'"%\-\s]+$/u.test(line);
}

export function parseSellingPoints(raw: string): SellingPointItem[] {
  if (!raw) {
    return [];
  }

  const lines = raw
    .split(/\r?\n|；|;/u)
    .map((line) => cleanLine(line))
    .filter(Boolean);
  const items: SellingPointItem[] = [];
  const pendingTargetFragments: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/->/gu, "→").replace(/：/gu, ":");

    if (isNoTextMessage(line)) {
      return [];
    }

    if (line.includes("→")) {
      const [left, ...rest] = line.split("→");
      const target = cleanTarget([...pendingTargetFragments, left].join(" ").trim());
      const zh = rest.join("→").trim();

      if (target && zh) {
        items.push({ target, zh });
      }

      pendingTargetFragments.length = 0;
      continue;
    }

    if (hasChinese(line)) {
      const firstChineseIndex = line.search(/[\u4e00-\u9fff]/u);
      const left = cleanTarget(line.slice(0, firstChineseIndex).trim());
      const zh = line.slice(firstChineseIndex).trim();
      const target = [...pendingTargetFragments, left].join(" ").trim();

      if (target && zh) {
        items.push({ target, zh });
      }

      pendingTargetFragments.length = 0;
      continue;
    }

    if (isTargetFragment(line)) {
      pendingTargetFragments.push(line);
    }
  }

  return items;
}
