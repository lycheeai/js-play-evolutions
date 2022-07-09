import { readFileSync, readdirSync } from 'fs';
import crypto from 'crypto';
import _ from 'lodash';

type FileEvolution = {
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

    const initialUps = [];
    const initialDowns = [];    

    var currentState = null;

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

function readSQLFile(root: string, filename: string): FileEvolution {
    const { ups, downs, upStatements, downStatements } = getUpDowns(`${process.cwd()}/${root}/${filename}`)

    // error catching
    const revision = parseInt(filename.match(/([0-9]+)\.sql/)[1]);
    
    const shasum = crypto.createHash('sha1')        
    shasum.update(downs.trim() + ups.trim())
    const hash = shasum.digest('hex');


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
