import {RunOptions, RunTarget} from 'github-action-ts-run-api'
import {Component} from '@cyclonedx/cyclonedx-library/src/models'
import {expect, test, afterEach, jest} from '@jest/globals'
import {map, parseSbomFile, run, SBom} from '../src/main'
import {Manifest, Snapshot} from '@github/dependency-submission-toolkit'

describe('Parse', () => {
  afterEach(() => {
    jest.resetModules()
  })

  test('testParsing', () => {
    let bom: SBom = parseSbomFile('__tests__/data/valid-bom-1.4.json')
    expect(bom).not.toBeNull()
    expect(bom.metadata?.authors).not.toBeNull()

    bom = parseSbomFile('__tests__/data/dropwizard-1.3.15-sbom.json')
    expect(bom).not.toBeNull()
    expect(bom.metadata?.authors).not.toBeNull()
    const typedComponents: Component[] =
      bom.components as unknown as Component[]
    expect(typedComponents.length).toBe(167)
  })
})

describe('Map to GH dep submission', () => {
  afterEach(() => {
    jest.resetModules()
  })

  test('should map external references to detector', () => {
    const bomFile = '__tests__/data/valid-bom-1.4.json'
    const bom: SBom = parseSbomFile(bomFile)
    const snapshot: Snapshot = map(bom, bomFile)

    expect(snapshot.detector.name).toBe('Awesome Tool')
    expect(snapshot.detector.version).toBe('9.1.2')
    expect(snapshot.detector.url).toBe('https://awesome.com')
  })

  test('testCycloneDXMavenDropwizardExample', () => {
    const bomfile: string = '__tests__/data/dropwizard-1.3.15-sbom.json'
    const bom: SBom = parseSbomFile(bomfile)
    const snapshot: Snapshot = map(bom, bomfile)
    expect(snapshot).not.toBeNull()

    expect(Object.keys(snapshot.manifests).length).toBe(1)

    const manifest: Manifest =
      snapshot.manifests[Object.keys(snapshot.manifests)[0]]
    expect(manifest.directDependencies().length).toBe(167)
    expect(manifest.indirectDependencies().length).toBe(0) // dropwizard example has all deps listed as direct
  })

  test('testCycloneDXMavenKeycloakExample', () => {
    const bomfile: string = '__tests__/data/keycloak-10.0.2-sbom.json'
    const bom: SBom = parseSbomFile(bomfile)
    const snapshot: Snapshot = map(bom, bomfile)
    expect(snapshot).not.toBeNull()

    expect(Object.keys(snapshot.manifests).length).toBe(1)

    const manifest: Manifest =
      snapshot.manifests[Object.keys(snapshot.manifests)[0]]
    expect(manifest.directDependencies().length).toBe(903)
    expect(manifest.indirectDependencies().length).toBe(0) // dropwizard example has all deps listed as direct
  })

  test('testBaseUbuntuSyftExample', () => {
    const bomfile: string = '__tests__/data/base_ubuntu_syft_packages.json'
    const bom: SBom = parseSbomFile(bomfile)
    const snapshot: Snapshot = map(bom, bomfile)
    expect(snapshot).not.toBeNull()

    expect(Object.keys(snapshot.manifests).length).toBe(1)

    const manifest: Manifest =
      snapshot.manifests[Object.keys(snapshot.manifests)[0]]
    expect(manifest.directDependencies().length).toBe(118)
    expect(manifest.indirectDependencies().length).toBe(0)
  })
})

describe('GitHub action', () => {
  test('no inputs', async () => {
    const target = RunTarget.asyncFn(run)
    const options = RunOptions.create()
      .setInputs({
        token: 'noToken'
      })
      .setShouldFakeMinimalGithubRunnerEnv(true)
      .setGithubContext({
        payload: {pull_request: {number: 123}},
        repository: 'org/repo',
        job: 'performance-test',
        sha: 'someSha',
        ref: 'main'
      })
    const result = await target.run(options)
    expect(result.isSuccess).toBe(true) // no inputs should succeed (writes a warning)
  })

  test('invalid credentials', async () => {
    const target = RunTarget.asyncFn(run)
    const options = RunOptions.create()
      .setInputs({
        'sbom-files': '__tests__/data/dropwizard-1.3.15-sbom.json',
        token: 'noToken'
      })
      .setShouldFakeMinimalGithubRunnerEnv(true)
      .setGithubContext({
        payload: {pull_request: {number: 123}},
        repository: 'org/repo',
        job: 'performance-test',
        sha: 'someSha',
        ref: 'main'
      })

    const result = await target.run(options)
    expect(result.isSuccess).toBe(false) // should fail with bad credentials
  })
})
