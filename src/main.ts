import * as core from '@actions/core'
import * as github from '@actions/github'
import * as cdx from '@cyclonedx/cyclonedx-library'
import * as fs from 'fs'
import {
  Detector,
  Job,
  jobFromContext
} from '@github/dependency-submission-toolkit/dist/snapshot'
import {
  PackageCache,
  Package,
  Snapshot,
  submitSnapshot,
  BuildTarget
} from '@github/dependency-submission-toolkit'

export class SBom extends cdx.Models.Bom {
  constructor() {
    super()
    this.dependencies = []
  }
  dependencies: Dependency[]
}

type Dependency = {
  ref: string
  dependsOn: string[]
}

export async function run(): Promise<void> {
  const sbomFiles: string[] = core.getMultilineInput('sbom-files')
  if (sbomFiles?.length) {
    for (const sbomFile of sbomFiles) {
      try {
        core.debug(`Processing ${sbomFile} ...`)
        await process(sbomFile)
      } catch (error) {
        if (error instanceof Error) core.setFailed(error.message)
      }
    }
  } else {
    core.warning('No SBOM files to process')
  }
}

export async function process(sbomFile: string): Promise<void> {
  const snapshot = map(parseSbomFile(sbomFile), sbomFile)
  try {
    await submitSnapshot(snapshot, github?.context)
  } catch (error) {
    if (error instanceof Error) core.error(error.message)
    throw error
  }
}

export function map(sbom: SBom, sbomFilename?: string): Snapshot {
  //const bom: SBom = sbom as SBom
  const detectors = Array.from(sbom.metadata.tools.values()).map(tool => {
    return {
      name: tool.name ?? 'unknown',
      version: tool.version ?? 'unknown',
      url: tool.externalReferences?.values[0].url || 'https://'
    } as Detector
  })
  const detector = detectors.pop() ?? {name: '', url: '', version: ''}

  let scanned: Date | undefined = sbom.metadata?.timestamp
  if (typeof sbom.metadata.timestamp === 'string') {
    scanned = new Date(sbom.metadata.timestamp)
  }

  const job: Job = jobFromContext(github.context)
  job.correlator += sbomFilename

  const snap: Snapshot = new Snapshot(detector, github?.context, job, scanned)

  const buildTarget = new BuildTarget(
    sbomFilename ||
      sbom.metadata?.component?.swid?.version ||
      sbom.metadata?.component?.version ||
      'someName'
  )
  snap.addManifest(buildTarget)

  const packageCache: PackageCache = new PackageCache()
  const deps = dependencyForPackage(
    sbom.metadata.component?.purl?.toString(),
    sbom.dependencies
  )
  if (!deps.length && sbom.dependencies?.length && sbom.components) {
    // main package url has not defined explicit dependencies in SBOM, add all components
    for (const c of sbom.components) {
      if (c.purl) deps.push(c.purl?.toString())
    }
  }
  for (const dep of deps) {
    const pkg: Package | undefined = packageCache.lookupPackage(dep)
    pkg
      ? buildTarget.addDirectDependency(pkg)
      : buildTarget.addDirectDependency(packageCache.package(dep))

    addIndirectDeps(dep, sbom, packageCache, buildTarget)
  }

  return snap
}

function addIndirectDeps(
  dep: string,
  sbom: SBom,
  packageCache: PackageCache,
  buildTarget: BuildTarget
): void {
  const indirectDeps = dependencyForPackage(dep, sbom.dependencies)
  for (const indirectDep of indirectDeps) {
    const inpkg: Package | undefined = packageCache.lookupPackage(indirectDep)
    inpkg
      ? buildTarget.addIndirectDependency(inpkg)
      : buildTarget.addIndirectDependency(packageCache.package(indirectDep))
    addIndirectDeps(indirectDep, sbom, packageCache, buildTarget)
  }
}

/**
 * Find dependencies for a package url
 * @param purl Package URL
 * @param deps Dependencies as listed in SBOM
 * @returns List of package URLs, empty if no dependencies
 */
function dependencyForPackage(
  purl: string | undefined,
  deps: Dependency[]
): string[] {
  if (!purl) return []
  const componentDeps = deps?.find(c => c.ref.toString() === purl)
  return componentDeps?.dependsOn || []
}

export function parseSbomFile(sbomFile: string): SBom {
  return JSON.parse(fs.readFileSync(sbomFile, 'utf8')) as SBom
}

run()
