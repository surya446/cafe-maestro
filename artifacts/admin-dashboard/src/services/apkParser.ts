/**
 * APK Metadata Parser
 *
 * Extracts release metadata directly from the APK file the owner
 * selects — nothing here is guessed or hand-typed. Everything is
 * read from the actual bytes of the file:
 *
 *   - Version name / version code / package name / min & target
 *     SDK -> parsed from the binary AndroidManifest.xml packed
 *     inside the APK (a ZIP), using `app-info-parser`.
 *   - SHA-256 of the whole file -> Web Crypto SubtleCrypto digest
 *     over the raw bytes (exact, not derived).
 *   - Signing certificate fingerprint ("APK Signature") -> the APK
 *     is a ZIP; nearly all real-world APKs still ship a v1/JAR
 *     signature block under META-INF/*.RSA|*.DSA|*.EC for backward
 *     compatibility even when v2/v3 signing is also used. We parse
 *     that PKCS#7 SignedData structure (via node-forge, a proper
 *     ASN.1/X.509 implementation — not hand-rolled parsing) and
 *     take the SHA-256 fingerprint of the signer's certificate,
 *     which is the same value `keytool`/`apksigner` would report.
 *   - Build timestamp -> the ZIP entry timestamp of
 *     AndroidManifest.xml (the time the build tool wrote the file
 *     into the archive). If a build system zeroes timestamps for
 *     reproducibility, this will read as null rather than a faked
 *     date.
 *
 * If the signing certificate cannot be located (v2/v3-only signed
 * APK with no legacy block), we report that plainly instead of
 * inventing a value.
 */

import JSZip from "jszip";
import forge from "node-forge";
// @ts-expect-error - app-info-parser ships no type declarations
import ApkParser from "app-info-parser/src/apk";

export interface ParsedApkMetadata {
  versionName: string | null;
  versionCode: number | null;
  packageName: string | null;
  minSdkVersion: number | null;
  targetSdkVersion: number | null;
  fileSizeBytes: number;
  sha256: string;
  signatureFingerprint: string | null;
  signatureUnavailableReason: string | null;
  buildTimestamp: string | null; // ISO string, or null if unavailable
}

function toIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function derToSha256Fingerprint(derBytes: Uint8Array): string {
  const md = forge.md.sha256.create();
  md.update(forge.util.binary.raw.encode(derBytes));
  return md
    .digest()
    .toHex()
    .match(/.{2}/g)!
    .join(":")
    .toUpperCase();
}

/**
 * Locate and parse the legacy v1 (JAR) signing block that most APKs
 * still embed under META-INF/ for backward compatibility, and
 * return the SHA-256 fingerprint of the signer's X.509 certificate.
 */
async function extractSignatureFingerprint(
  zip: JSZip
): Promise<{ fingerprint: string | null; reason: string | null }> {
  const sigFile = Object.keys(zip.files).find((name) =>
    /^META-INF\/[^/]+\.(RSA|DSA|EC)$/i.test(name)
  );

  if (!sigFile) {
    return {
      fingerprint: null,
      reason:
        "No legacy v1 signing block found (APK is signed with v2/v3 scheme only).",
    };
  }

  try {
    const bytes = await zip.files[sigFile].async("uint8array");
    const binaryStr = forge.util.binary.raw.encode(bytes);
    const asn1 = forge.asn1.fromDer(binaryStr);
    const p7 = forge.pkcs7.messageFromAsn1(asn1) as forge.pkcs7.PkcsSignedData;

    const certs = p7.certificates;
    if (!certs || certs.length === 0) {
      return {
        fingerprint: null,
        reason: "Signing block found but contained no certificate.",
      };
    }

    const certAsn1 = forge.pki.certificateToAsn1(certs[0]);
    const derStr = forge.asn1.toDer(certAsn1).getBytes();
    const derBytes = new Uint8Array(derStr.length);
    for (let i = 0; i < derStr.length; i++) derBytes[i] = derStr.charCodeAt(i);

    return { fingerprint: derToSha256Fingerprint(derBytes), reason: null };
  } catch (err) {
    return {
      fingerprint: null,
      reason: `Could not parse signing certificate: ${
        err instanceof Error ? err.message : "unknown error"
      }`,
    };
  }
}

async function extractBuildTimestamp(zip: JSZip): Promise<string | null> {
  const manifestFile = zip.files["AndroidManifest.xml"];
  if (!manifestFile?.date) return null;
  const date = manifestFile.date;
  // A large number of build tools leave the DOS default (1980-01-01)
  // when timestamps aren't explicitly set — that's not a real build
  // time, so we treat it as unavailable rather than showing it.
  if (date.getFullYear() <= 1980) return null;
  return date.toISOString();
}

export async function parseApkFile(file: File): Promise<ParsedApkMetadata> {
  const buffer = await file.arrayBuffer();

  const [manifestResult, zip, sha256] = await Promise.all([
    new ApkParser(file).parse() as Promise<any>,
    JSZip.loadAsync(buffer),
    computeSha256(buffer),
  ]);

  const { fingerprint, reason } = await extractSignatureFingerprint(zip);
  const buildTimestamp = await extractBuildTimestamp(zip);

  return {
    versionName: manifestResult?.versionName ?? null,
    versionCode: toIntOrNull(manifestResult?.versionCode),
    packageName: manifestResult?.package ?? null,
    minSdkVersion: toIntOrNull(manifestResult?.usesSdk?.minSdkVersion),
    targetSdkVersion: toIntOrNull(manifestResult?.usesSdk?.targetSdkVersion),
    fileSizeBytes: file.size,
    sha256,
    signatureFingerprint: fingerprint,
    signatureUnavailableReason: reason,
    buildTimestamp,
  };
}

/** Human label for a raw SDK integer, e.g. 28 -> "Android 9.0 (API 28)". */
const SDK_TO_ANDROID_VERSION: Record<number, string> = {
  21: "Android 5.0",
  22: "Android 5.1",
  23: "Android 6.0",
  24: "Android 7.0",
  25: "Android 7.1",
  26: "Android 8.0",
  27: "Android 8.1",
  28: "Android 9.0",
  29: "Android 10",
  30: "Android 11",
  31: "Android 12",
  32: "Android 12L",
  33: "Android 13",
  34: "Android 14",
  35: "Android 15",
  36: "Android 16",
};

export function formatAndroidVersion(apiLevel: number | null): string {
  if (apiLevel === null) return "Unknown";
  const label = SDK_TO_ANDROID_VERSION[apiLevel];
  return label ? `${label} (API ${apiLevel})` : `API ${apiLevel}`;
}
