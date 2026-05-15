const DENO_LATEST_RELEASE_URL = "https://api.github.com/repos/denoland/deno/releases/latest";
const DENO_RELEASE_TAG_PATTERN = /^v?(\d+\.\d+\.\d+)$/;
const DOCKER_DENO_VERSION_PATTERN = /^(ARG DENO_VERSION=)(\d+\.\d+\.\d+)$/m;

interface DockerDenoVersionUpdate {
  changed: boolean;
  previousVersion: string;
  nextVersion: string;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function parseDenoReleaseVersion(tagName: unknown): string | Error {
  if (typeof tagName !== "string") {
    return new Error("The latest Deno release did not include a string tag name.");
  }

  const versionMatch = DENO_RELEASE_TAG_PATTERN.exec(tagName);
  if (!versionMatch) {
    return new Error(`The latest Deno release tag "${tagName}" is not a stable semantic version.`);
  }

  return versionMatch[1];
}

export function replaceDockerDenoVersion(dockerfile: string, nextVersion: string): { dockerfile: string; update: DockerDenoVersionUpdate } | Error {
  const currentVersionMatch = DOCKER_DENO_VERSION_PATTERN.exec(dockerfile);
  if (!currentVersionMatch) {
    return new Error("Dockerfile must contain an ARG DENO_VERSION=<major>.<minor>.<patch> line.");
  }

  const previousVersion = currentVersionMatch[2];
  const updatedDockerfile = dockerfile.replace(DOCKER_DENO_VERSION_PATTERN, (_line, prefix: string) => `${prefix}${nextVersion}`);

  return {
    dockerfile: updatedDockerfile,
    update: {
      changed: previousVersion !== nextVersion,
      previousVersion,
      nextVersion,
    },
  };
}

async function fetchLatestDenoVersion(): Promise<string | Error> {
  let response: Response;
  try {
    response = await fetch(DENO_LATEST_RELEASE_URL, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });
  } catch (error) {
    return new Error(`Unable to fetch the latest Deno release: ${toErrorMessage(error)}`);
  }

  if (!response.ok) {
    return new Error(`Unable to fetch the latest Deno release: GitHub returned HTTP ${response.status}.`);
  }

  let release: { tag_name?: unknown };
  try {
    release = await response.json() as { tag_name?: unknown };
  } catch (error) {
    return new Error(`Unable to parse the latest Deno release response: ${toErrorMessage(error)}`);
  }

  return parseDenoReleaseVersion(release.tag_name);
}

async function updateDockerfileDenoVersion(): Promise<DockerDenoVersionUpdate | Error> {
  const nextVersion = await fetchLatestDenoVersion();
  if (nextVersion instanceof Error) {
    return nextVersion;
  }

  const dockerfileUrl = new URL("../Dockerfile", import.meta.url);
  let dockerfile: string;
  try {
    dockerfile = await Deno.readTextFile(dockerfileUrl);
  } catch (error) {
    return new Error(`Unable to read Dockerfile: ${toErrorMessage(error)}`);
  }

  const replacement = replaceDockerDenoVersion(dockerfile, nextVersion);
  if (replacement instanceof Error) {
    return replacement;
  }

  if (replacement.update.changed) {
    try {
      await Deno.writeTextFile(dockerfileUrl, replacement.dockerfile);
    } catch (error) {
      return new Error(`Unable to update Dockerfile: ${toErrorMessage(error)}`);
    }
  }

  return replacement.update;
}

if (import.meta.main) {
  const update = await updateDockerfileDenoVersion();
  if (update instanceof Error) {
    console.error(update.message);
    Deno.exit(1);
  }

  if (update.changed) {
    console.log(`Updated Dockerfile DENO_VERSION from ${update.previousVersion} to ${update.nextVersion}.`);
  } else {
    console.log(`Dockerfile DENO_VERSION is already ${update.nextVersion}.`);
  }
}
