// ... existing types ...
export interface CPUInfo {
  model_name: string;
  cores: number;
  threads: number;
  usage: number;
  usage_per_core: number[];
}

export interface RAMInfo {
  total: number;
  used: number;
  used_percent: number;
}

export interface DiskInfo {
  total: number;
  used: number;
  used_percent: number;
}

export interface SystemInfo {
  cpu: CPUInfo;
  ram: RAMInfo;
  disk: DiskInfo;
}

export interface InterfaceInfo {
  name: string;
  ipv4: string[] | null;
  ipv6: string[] | null;
}

export interface NetStats {
  bytes_sent: number;
  bytes_recv: number;
}

export interface NetworkInfo {
  interfaces: InterfaceInfo[];
  stats: NetStats;
  public_ip: string;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  port: number;
  protocol: string;
}

export interface FirewallRule {
  id: string;
  to: string;
  action: string;
  from: string;
  status: string;
}

export interface FirewallResponse {
  status: string;
  rules: FirewallRule[] | null;
}

export interface LoginResponse {
  token: string;
}

export interface DNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  zone_name?: string;
}

export interface CloudflareResponse {
  result: DNSRecord[];
  success: boolean;
  errors: any[];
}