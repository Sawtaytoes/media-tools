import { execSync } from "node:child_process"
import { platform } from "node:os"
import { parse } from "node:path"

// Detects whether a Windows path lives on a network share. Used by the
// delete-mode endpoint to downgrade `trash` → `permanent` for paths that
// the OS Recycle Bin can't service — Windows network shares don't have a
// per-share Recycle Bin, so the `trash` package's Shell.Application call
// either silently permanent-deletes or fails. Either outcome misleads
// the user, so we detect up front and label the UI honestly.
//
// Two flavors of network path on Windows:
//
//   1. UNC paths like `\\\\server\\share\\foo`  — cheap to detect by prefix.
//   2. Mapped drives like `G:\\foo` whose root is a `net use` mount —
//      requires asking Windows which drive letters point at network
//      shares (DriveType=4 in WMI/CIM).
//
// On non-Windows platforms this is always false. macOS / Linux trash
// implementations handle network paths differently (per-mount .Trash
// folders) and we don't try to second-guess them.

// Pure core. Takes the platform flag and the pre-enumerated network-
// drive set as inputs, so the classification logic can be tested on any
// OS without spawning PowerShell. The wrapper below threads the real
// platform + cached drive set through this function.
export const classifyNetworkPath = ({
  filePath,
  isWindows,
  networkDriveLetters,
}: {
  filePath: string
  isWindows: boolean
  networkDriveLetters: Set<string>
}): boolean => {
  if (!isWindows) return false
  // UNC prefix — `\\server\share\...`. Node's path.parse on UNC paths
  // returns a root like `\\server\share\` which is fine, but the cheap
  // string check beats parsing for the common case.
  if (filePath.startsWith("\\\\")) return true
  const root = parse(filePath)
    .root.toUpperCase()
    .replace(/\\$/u, "")
  if (!root) return false
  return networkDriveLetters.has(root)
}

let cachedNetworkDriveLetters: Set<string> | null = null

const enumerateWindowsNetworkDriveLetters =
  (): Set<string> => {
    if (cachedNetworkDriveLetters)
      return cachedNetworkDriveLetters

    // Get-CimInstance is the modern replacement for `wmic` (deprecated on
    // recent Windows builds). Filtering at the CIM layer keeps stdout
    // small. -NoProfile avoids loading user PowerShell modules. Timeout
    // guards against PowerShell stalling on a misconfigured machine.
    try {
      const output = execSync(
        'powershell -NoProfile -Command "Get-CimInstance -ClassName Win32_LogicalDisk -Filter \\"DriveType=4\\" | Select-Object -ExpandProperty DeviceID"',
        {
          encoding: "utf8",
          timeout: 5000,
          windowsHide: true,
        },
      )
      const drives = output
        .split(/\r?\n/u)
        .map((line) => line.trim().toUpperCase())
        .filter(Boolean)
      cachedNetworkDriveLetters = new Set(drives)
    } catch {
      // PowerShell missing, blocked by execution policy, or some other
      // hiccup — fall back to "no network drives detected" rather than
      // crashing the request. UNC-prefix detection still works.
      cachedNetworkDriveLetters = new Set()
    }
    return cachedNetworkDriveLetters
  }

export const isNetworkPath = (
  filePath: string,
): boolean => {
  const isWindows = platform() === "win32"
  return classifyNetworkPath({
    filePath,
    isWindows,
    networkDriveLetters: isWindows
      ? enumerateWindowsNetworkDriveLetters()
      : new Set(),
  })
}

// Test seam — lets pathSafety / route tests reset the cache between
// runs. Production code never calls this.
export const resetNetworkPathCacheForTests = (): void => {
  cachedNetworkDriveLetters = null
}
