import * as core from '@actions/core'
import * as cdx from '@cyclonedx/cyclonedx-library'
import * as fs from 'fs'
import {PackageURL} from 'packageurl-js'
import {Detector} from '@github/dependency-submission-toolkit/dist/snapshot'

import {
  PackageCache,
  Package,
  Snapshot,
  submitSnapshot,
  BuildTarget
} from '@github/dependency-submission-toolkit'

export async function run(): Promise<void> {
  try {
    const sbomFile: string = core.getInput('sbom-file')
    core.debug(`Processing ${sbomFile} ...`) // debug is only output if you set the secret `ACTIONS_STEP_DEBUG` to true
    await process(sbomFile)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

export async function process(sbomFile: string): Promise<void> {
  const snapshot = map(parseSbomFile(sbomFile))
  await submitSnapshot(snapshot)
}

function map(bom: cdx.Models.Bom): Snapshot {
  const detectors = Array.from(bom.metadata.tools.values()).map(tool => {
    return {
      name: tool.name ?? 'unknown',
      url: '',
      version: tool.version ?? 'unknown'
    } as Detector
  })
  const detector = detectors.pop() ?? {name: '', url: '', version: ''}
  const snapshot = new Snapshot(detector)

  const buildTarget = new BuildTarget('someName')
  snapshot.addManifest(buildTarget)

  // https://github.com/CycloneDX/cyclonedx-javascript-library/issues/86
  const packages: Package[] = bom.components.sorted().map(component => {
    const packageUrl: PackageURL = component.purl as PackageURL
    return new Package(packageUrl)
  })

  const packageCache = new PackageCache()
  for (const pkg of packages) {
    packageCache.addPackage(pkg)
    buildTarget.addBuildDependency(pkg)
  }

  return snapshot
}

function parseSbomFile(sbomFile: string): cdx.Models.Bom {
  return JSON.parse(fs.readFileSync(sbomFile, 'utf8')) as cdx.Models.Bom
}

run()
