import { existsSync, readFileSync, readdirSync } from 'fs';
import * as crypto from 'crypto';
import * as _ from 'lodash';

export type FileEvolution = {
    revision: number;
    ups: string;
    downs: string;
    hash: string;
    upStatements: string[];
    downStatements: string[];
}

type UpDowns = {
    ups: string;
    downs: string;
    upStatements: string[];
    downStatements: string[];    
}

type SnapshotEvolution = UpDowns;

const UP_REGEX = /^(#|--).*!Ups.*$/;
const DOWN_REGEX = /^(#|--).*!Downs.*$/;
const UP = "UP";
const DOWN = "DOWN";

function getUpDowns(filePath: string): UpDowns {
    const file = readFileSync(filePath)
    const fileString = file.toString('utf8');

    const fileLines = fileString.split("\n").map((line) => (line.trim()))

    const initialUps: string[] = [];
    const initialDowns: string[] = [];    

    var currentState: string | null = null;

    fileLines.forEach(function(line) {
        if (!currentState && UP_REGEX.test(line)) {
            currentState = UP
            return;
        }

        if (currentState === UP) {
            if (DOWN_REGEX.test(line)) {
                currentState = DOWN;
            } else {
                initialUps.push(line);
            }

            return;
        }

        if (currentState === DOWN) {
            initialDowns.push(line);
            return;
        }
    });

    const ups = initialUps.join("\n").trim();
    const downs = initialDowns.join("\n").trim();
    const upStatements = ups.split(/(?<!;);(?!;)/).map((l) => (l.trim().replace(/;;/g, ";"))).filter((l) => (l.length > 0));
    const downStatements = downs.split(/(?<!;);(?!;)/).map((l) => (l.trim().replace(/;;/g, ";"))).filter((l) => (l.length > 0))

    return { 
        ups,
        downs,
        upStatements,
        downStatements,
    };
}

function makeHash(ups: string, downs: string) {
    const shasum = crypto.createHash('sha1')        
    shasum.update(downs.trim() + ups.trim())
    const hash = shasum.digest('hex');

    return hash;
}

export function readSQLFile(root: string, filename: string): FileEvolution {
    const { ups, downs, upStatements, downStatements } = getUpDowns(`${process.cwd()}/${root}/${filename}`)

    // error catching
    const matches = filename.match(/([0-9]+)\.sql/);
    const revision = parseInt(matches ? matches[1] : '');
    
    const hash = makeHash(ups, downs);

    return {
        revision,
        ups,
        downs,
        hash,
        upStatements,
        downStatements
    }
}

export function getEvolutionForSnapshot(filename: string): SnapshotEvolution {
    return getUpDowns(`${process.cwd()}/${filename}`)
}

export function getEvolutionsForRoot(root: string): FileEvolution[] {
    const files = readdirSync(`${process.cwd()}/${root}`)

    // do order
    return _.sortBy(files.map(function(filename: string) {
        const evolution = readSQLFile(root, filename)
        return evolution;
    }), (f) => (f.revision));
}

export function calculateSchemaTable(files: string, schema: string| undefined, table: string | undefined) {
    const lastName = files.split('/').slice(-1)[0];
    const defaultedTable = table || `${lastName}_evolutions`;
    const defaultedSchema = schema || 'public';

    return {
        defaultedSchema,
        defaultedTable
    };
}


function getHasuraEvolutionFromDir(fullPath: string, folder: string): FileEvolution {
    const upsFile = `${fullPath}/up.sql`;
    const ups = existsSync(upsFile) ? readFileSync(upsFile).toString('utf8') : '';

    const downsFile = `${fullPath}/down.sql`;
    const downs = existsSync(downsFile) ? readFileSync(downsFile).toString('utf8') : '';

    const upStatements = ups.split(/(?<!;);(?!;)/).map((l) => (l.trim().replace(/;;/g, ";"))).filter((l) => (l.length > 0));
    const downStatements = downs.split(/(?<!;);(?!;)/).map((l) => (l.trim().replace(/;;/g, ";"))).filter((l) => (l.length > 0))

    const hash = makeHash(ups, downs);

    const revision = parseInt(folder.split('_')[0]);

    return {
        revision,
        ups,
        downs,
        hash,
        upStatements,
        downStatements
    }    
}

export function getHasuraEvolutionsForRoot(root: string): FileEvolution[] {
    const folder = readdirSync(`${process.cwd()}/${root}`)

    return folder.map((folder) => {
        return getHasuraEvolutionFromDir(`${process.cwd()}/${root}/${folder}`, folder)
    });
}
