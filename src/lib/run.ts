import { PrismaClient, Prisma } from '@prisma/client'

import { getEvolutionsForRoot, getEvolutionForSnapshot } from "./files";
import { assertEvolutionsTable, getEvolutionsFromDatabase } from "./db";

export async function runDatabaseDowns(schema: string, metaTable: string, fileDir: string) {
    const fileEvolutions = getEvolutionsForRoot(fileDir);

    const prisma = new PrismaClient();
    try {
        await assertEvolutionsTable(prisma, schema, metaTable);
        const databaseEvolutions = await getEvolutionsFromDatabase(prisma, schema, metaTable);    

        // database evolutions should fully match files
        if (databaseEvolutions.length > fileEvolutions.length) {
            console.warn(databaseEvolutions, fileEvolutions)
            throw new Error("Something is very wrong. Evolutions in DB do not match those on file.");
        } else {
            databaseEvolutions.forEach((dbEv, idx) => {
                const fileEv = fileEvolutions[idx]
                
                if (fileEv.hash !== dbEv.hash) {
                    throw new Error(`hashes do not match for evolution ${dbEv.id}`)
                }
            });
            
            return await prisma.$transaction(async (prisma) => {
                for (const fileEv of fileEvolutions.slice(databaseEvolutions.length).reverse()) {
                    // applying up
                    await prisma.$executeRaw(
                        Prisma.sql`UPDATE ${Prisma.raw(`${schema}.${metaTable}`)}
                        SET state = ${"applying_down"}
                        WHERE id = ${fileEv.revision};`
                    )
                    
                    for (const statement of fileEv.downStatements) {
                        await prisma.$executeRawUnsafe(statement);
                    }

                    await prisma.$executeRaw(
                        Prisma.sql`
                            DELETE FROM ${Prisma.raw(`${schema}.${metaTable}`)}
                            WHERE id = ${fileEv.revision}
                        `
                    )
                }
            }, { timeout: 1000000000})
        }
    } finally {
        prisma.$disconnect();
    }
}

export async function runSingleDowns(filename: string) {
    const { downStatements } = getEvolutionForSnapshot(filename)
    const prisma = new PrismaClient();

    try {
        return await prisma.$transaction(async (prisma) => {
            for (const statement of downStatements) {
                // console.warn('APPLY', statement)
                await prisma.$executeRawUnsafe(statement);
            }
        });
    } finally {
        prisma.$disconnect();
    }
}

/**
 * Ups
 */
 export async function runSequence(sequence: string[]) {
    const prisma = new PrismaClient();

    try {
        return prisma.$transaction(async (prisma) => {
            for (const statement of sequence) {
                // console.warn('APPLY', statement)
                await prisma.$executeRawUnsafe(statement);
            }
        });
    } finally {
        prisma.$disconnect();
    }
}

export async function runSingleUps(filename: string) {
    const { upStatements } = getEvolutionForSnapshot(filename)
    const prisma = new PrismaClient();

    try {
        return prisma.$transaction(async (prisma) => {
            for (const statement of upStatements) {
                // console.warn('APPLY', statement)
                await prisma.$executeRawUnsafe(statement);
            }
        });
    } finally {
        prisma.$disconnect();
    }
}

export async function runDatabaseUps(schema: string, metaTable: string, fileDir: string) {
    const prisma = new PrismaClient();

    try {
        await assertEvolutionsTable(prisma, schema, metaTable);
        const fileEvolutions = getEvolutionsForRoot(fileDir);
        const databaseEvolutions = await getEvolutionsFromDatabase(prisma, schema, metaTable);

        // if db.length > file
        if (databaseEvolutions.length > fileEvolutions.length) {
            throw new Error("Something is very wrong. More evolutions in DB than on file.");
        } else {
            // check if db matches
            // assert
            databaseEvolutions.forEach((dbEv, idx) => {
                const fileEv = fileEvolutions[idx]
                
                if (fileEv.hash !== dbEv.hash) {
                    throw new Error(`hashes do not match for evolution ${dbEv.id} ${fileEv.hash} ${dbEv.hash}`)
                }
            });

            // start from last db
            const lastDBIndex = databaseEvolutions.length

            // FOR UPS
            await prisma.$transaction(async (prisma) => {
                for (const fileEv of fileEvolutions.slice(lastDBIndex)) {
                // applying up
                // console.warn(`APPLYING UP ${fileEv.revision}`)
                    await prisma.$executeRaw(
                        Prisma.sql`INSERT INTO ${Prisma.raw(`${schema}.${metaTable}`)}
                        (id, hash, applied_at, apply_script, revert_script, state, last_problem)
                        values (${fileEv.revision}, ${fileEv.hash}, NOW(), ${fileEv.ups}, ${fileEv.downs}, ${"applying_up"}, ${""})`
                    )
                    
                    for (const statement of fileEv.upStatements) {
                        console.warn('APPLY', statement)
                        await prisma.$executeRawUnsafe(statement);
                    }

                    await prisma.$executeRaw(
                        Prisma.sql`
                            UPDATE ${Prisma.raw(`${schema}.${metaTable}`)} 
                            SET state = 'applied'
                            WHERE id = ${fileEv.revision}
                        `
                    )
                }
            }, { timeout: 1000000000}); // thought this was fucking fixed in 3.12.0?
        }    
    } finally {
        prisma.$disconnect();
    }
}