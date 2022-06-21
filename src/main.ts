import * as core from '@actions/core'

async function run(): Promise<void> {
  try {
    const sbomFile: string = core.getInput('sbom-file')
    core.debug(`Reading ${sbomFile} ...`) // debug is only output if you set the secret `ACTIONS_STEP_DEBUG` to true
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
