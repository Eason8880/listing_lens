import dns from "node:dns/promises";
import net from "node:net";

import { AppError } from "@/lib/app-error";

function isPrivateIPv4(ip: string) {
  const parts = ip.split(".").map((segment) => Number(segment));

  if (parts.length !== 4 || parts.some((segment) => Number.isNaN(segment))) {
    return false;
  }

  const [a, b] = parts;

  if (a === 0 || a === 10 || a === 127) {
    return true;
  }

  if (a === 169 && b === 254) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }

  return false;
}

function isPrivateIPv6(ip: string) {
  const normalized = ip.toLowerCase();

  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

export function isPrivateIpLiteral(ip: string) {
  const ipVersion = net.isIP(ip);

  if (ipVersion === 4) {
    return isPrivateIPv4(ip);
  }

  if (ipVersion === 6) {
    return isPrivateIPv6(ip);
  }

  return false;
}

async function assertPublicHostname(hostname: string) {
  const lowered = hostname.toLowerCase();

  if (lowered === "localhost" || lowered.endsWith(".localhost") || lowered.endsWith(".local")) {
    throw new AppError("不支持访问本地或内网地址。", 400);
  }

  const ipVersion = net.isIP(hostname);

  if (ipVersion) {
    if (isPrivateIpLiteral(hostname)) {
      throw new AppError("不支持访问本地或内网地址。", 400);
    }

    return;
  }

  const addresses = await dns.lookup(hostname, {
    all: true,
    verbatim: true,
  });

  if (!addresses.length) {
    throw new AppError("无法解析目标地址。", 400);
  }

  const hasPrivateAddress = addresses.some((entry) => isPrivateIpLiteral(entry.address));

  if (hasPrivateAddress) {
    throw new AppError("目标地址不安全，已拒绝访问。", 400);
  }
}

export async function ensureSafeHttpUrl(input: string) {
  let parsed: URL;

  try {
    parsed = new URL(input);
  } catch {
    throw new AppError("请输入有效的 http 或 https 链接。", 400);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new AppError("仅支持 http 或 https 链接。", 400);
  }

  if (parsed.username || parsed.password) {
    throw new AppError("链接中不能包含账号或密码。", 400);
  }

  await assertPublicHostname(parsed.hostname);

  return parsed;
}
