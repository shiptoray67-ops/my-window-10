import { Capacitor } from '@capacitor/core';
import { AppVersionInfo, EmbeddedWebView } from '../plugins/embeddedWebView';

export const GITHUB_OWNER = 'shiptoray67-ops';
export const GITHUB_REPO_NAME = 'my-window-10';
export const GITHUB_REPO = `${GITHUB_OWNER}/${GITHUB_REPO_NAME}`;
export const GITHUB_LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
export const GITHUB_RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases/latest`;

export interface AppUpdateCheckResult {
  installed: AppVersionInfo;
  hasUpdate: boolean;
  latestVersionCode: number;
  latestVersionName: string;
  downloadUrl: string | null;
  releaseUrl: string;
  releaseNotes: string;
  publishedAt: string | null;
  checkedAt: number;
}

interface GitHubAsset {
  name?: string;
  browser_download_url?: string;
  size?: number;
}

interface GitHubReleaseResponse {
  tag_name?: string;
  name?: string;
  body?: string;
  html_url?: string;
  published_at?: string;
  assets?: GitHubAsset[];
}

export async function getInstalledAppVersion(): Promise<AppVersionInfo> {
  if (Capacitor.isNativePlatform()) {
    try {
      return await EmbeddedWebView.getAppVersion();
    } catch {
      return { versionCode: 1, versionName: '1.0.1', packageName: 'com.win10.simulator' };
    }
  }
  return { versionCode: 1, versionName: '1.0.1 (Web)', packageName: 'com.win10.simulator' };
}

function parseVersionCode(release: GitHubReleaseResponse): number {
  const body = release.body || '';
  const name = release.name || '';
  const tag = release.tag_name || '';

  const bodyMatch = body.match(/versionCode\s*[:=]\s*(\d+)/i);
  if (bodyMatch) return Number(bodyMatch[1]);

  const buildMatch = name.match(/Build\s+#?(\d+)/i);
  if (buildMatch) return Number(buildMatch[1]);

  const semverMatch = `${name} ${tag}`.match(/v?\d+\.\d+\.(\d+)/);
  if (semverMatch) return Number(semverMatch[1]);

  const tagNum = tag.match(/(\d+)/);
  if (tagNum) return Number(tagNum[1]);

  return 0;
}

function parseVersionName(release: GitHubReleaseResponse, code: number): string {
  const body = release.body || '';
  const name = release.name || '';

  const bodyMatch = body.match(/versionName\s*[:=]\s*([^\s\r\n]+)/i);
  if (bodyMatch) return bodyMatch[1];

  const semverMatch = name.match(/v?(\d+\.\d+\.\d+)/);
  if (semverMatch) return semverMatch[1];

  return code > 0 ? `1.0.${code}` : release.tag_name || 'latest';
}

export async function checkForAppUpdate(): Promise<AppUpdateCheckResult> {
  const installed = await getInstalledAppVersion();

  let response: Response;
  try {
    response = await fetch(GITHUB_LATEST_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
      cache: 'no-store',
    });
  } catch {
    throw new Error('Could not reach GitHub. Check your internet connection and try again.');
  }

  if (response.status === 404) {
    throw new Error('No published APK release was found yet on GitHub.');
  }
  if (response.status === 403) {
    throw new Error('GitHub API rate limit reached. Please try again in a few minutes.');
  }
  if (!response.ok) {
    throw new Error(`Update check failed (HTTP ${response.status}).`);
  }

  const release = (await response.json()) as GitHubReleaseResponse;
  const latestVersionCode = parseVersionCode(release);
  const latestVersionName = parseVersionName(release, latestVersionCode);

  const assets = Array.isArray(release.assets) ? release.assets : [];
  const preferredApk =
    assets.find((a) => (a.name || '').toLowerCase() === 'win10simulator.apk') ||
    assets.find((a) => (a.name || '').toLowerCase().endsWith('.apk'));

  const hasUpdate =
    latestVersionCode > 0 &&
    latestVersionCode > installed.versionCode &&
    Boolean(preferredApk?.browser_download_url);

  return {
    installed,
    hasUpdate,
    latestVersionCode,
    latestVersionName,
    downloadUrl: preferredApk?.browser_download_url || null,
    releaseUrl: release.html_url || GITHUB_RELEASES_PAGE,
    releaseNotes: (release.body || '').trim(),
    publishedAt: release.published_at || null,
    checkedAt: Date.now(),
  };
}
