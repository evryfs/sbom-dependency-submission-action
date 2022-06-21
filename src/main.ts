import * as core from '@actions/core'
import * as cdx from '@cyclonedx/cyclonedx-library'
import * as fs from 'fs'

async function run(): Promise<void> {
  try {
    const sbomFile: string = core.getInput('sbom-file')
    parseSbomFile(sbomFile)
    core.debug(`Reading ${sbomFile} ...`) // debug is only output if you set the secret `ACTIONS_STEP_DEBUG` to true
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

export function parseSbomFile(sbomFile: string): cdx.Models.Bom {
  //const bom = new cdx.Models.Bom()
  const bom: cdx.Models.Bom = JSON.parse(
    fs.readFileSync(sbomFile, 'utf8')
  ) as cdx.Models.Bom

  return bom
}

run()
