"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSbomFile = exports.map = exports.process = exports.run = exports.SBom = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const cdx = __importStar(require("@cyclonedx/cyclonedx-library"));
const fs = __importStar(require("fs"));
const dependency_submission_toolkit_1 = require("@github/dependency-submission-toolkit");
class SBom extends cdx.Models.Bom {
    constructor() {
        super();
        this.dependencies = [];
    }
}
exports.SBom = SBom;
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const sbomFiles = core.getMultilineInput('sbom-files');
        if (sbomFiles === null || sbomFiles === void 0 ? void 0 : sbomFiles.length) {
            for (const sbomFile of sbomFiles) {
                try {
                    core.debug(`Processing ${sbomFile} ...`);
                    yield process(sbomFile);
                }
                catch (error) {
                    if (error instanceof Error)
                        core.setFailed(error.message);
                }
            }
        }
        else {
            core.warning('No SBOM files to process');
        }
    });
}
exports.run = run;
function process(sbomFile) {
    return __awaiter(this, void 0, void 0, function* () {
        const snapshot = map(parseSbomFile(sbomFile), sbomFile);
        try {
            yield (0, dependency_submission_toolkit_1.submitSnapshot)(snapshot, github === null || github === void 0 ? void 0 : github.context);
        }
        catch (error) {
            if (error instanceof Error)
                core.error(error.message);
            throw error;
        }
    });
}
exports.process = process;
function map(sbom, sbomFilename) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    //const bom: SBom = sbom as SBom
    const detectors = Array.from(sbom.metadata.tools.values()).map(tool => {
        var _a, _b, _c;
        return {
            name: (_a = tool.name) !== null && _a !== void 0 ? _a : 'unknown',
            version: (_b = tool.version) !== null && _b !== void 0 ? _b : 'unknown',
            url: ((_c = tool.externalReferences) === null || _c === void 0 ? void 0 : _c.values[0].url) || 'https://'
        };
    });
    const detector = (_a = detectors.pop()) !== null && _a !== void 0 ? _a : { name: '', url: '', version: '' };
    let scanned = (_b = sbom.metadata) === null || _b === void 0 ? void 0 : _b.timestamp;
    if (typeof sbom.metadata.timestamp === 'string') {
        scanned = new Date(sbom.metadata.timestamp);
    }
    const snap = new dependency_submission_toolkit_1.Snapshot(detector, github === null || github === void 0 ? void 0 : github.context, undefined, scanned);
    const buildTarget = new dependency_submission_toolkit_1.BuildTarget(sbomFilename ||
        ((_e = (_d = (_c = sbom.metadata) === null || _c === void 0 ? void 0 : _c.component) === null || _d === void 0 ? void 0 : _d.swid) === null || _e === void 0 ? void 0 : _e.version) ||
        ((_g = (_f = sbom.metadata) === null || _f === void 0 ? void 0 : _f.component) === null || _g === void 0 ? void 0 : _g.version) ||
        'someName');
    snap.addManifest(buildTarget);
    const packageCache = new dependency_submission_toolkit_1.PackageCache();
    const deps = dependencyForPackage((_j = (_h = sbom.metadata.component) === null || _h === void 0 ? void 0 : _h.purl) === null || _j === void 0 ? void 0 : _j.toString(), sbom.dependencies);
    if (!deps.length && ((_k = sbom.dependencies) === null || _k === void 0 ? void 0 : _k.length) && sbom.components) {
        // main package url has not defined explicit dependencies in SBOM, add all components
        for (const c of sbom.components) {
            if (c.purl)
                deps.push((_l = c.purl) === null || _l === void 0 ? void 0 : _l.toString());
        }
    }
    for (const dep of deps) {
        const pkg = packageCache.lookupPackage(dep);
        pkg
            ? buildTarget.addDirectDependency(pkg)
            : buildTarget.addDirectDependency(packageCache.package(dep));
        addIndirectDeps(dep, sbom, packageCache, buildTarget);
    }
    return snap;
}
exports.map = map;
function addIndirectDeps(dep, sbom, packageCache, buildTarget) {
    const indirectDeps = dependencyForPackage(dep, sbom.dependencies);
    for (const indirectDep of indirectDeps) {
        const inpkg = packageCache.lookupPackage(indirectDep);
        inpkg
            ? buildTarget.addIndirectDependency(inpkg)
            : buildTarget.addIndirectDependency(packageCache.package(indirectDep));
        addIndirectDeps(indirectDep, sbom, packageCache, buildTarget);
    }
}
/**
 * Find dependencies for a package url
 * @param purl Package URL
 * @param deps Dependencies as listed in SBOM
 * @returns List of package URLs, empty if no dependencies
 */
function dependencyForPackage(purl, deps) {
    if (!purl)
        return [];
    const componentDeps = deps === null || deps === void 0 ? void 0 : deps.find(c => c.ref.toString() === purl);
    return (componentDeps === null || componentDeps === void 0 ? void 0 : componentDeps.dependsOn) || [];
}
function parseSbomFile(sbomFile) {
    return JSON.parse(fs.readFileSync(sbomFile, 'utf8'));
}
exports.parseSbomFile = parseSbomFile;
run();
