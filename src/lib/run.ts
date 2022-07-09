import { PrismaClient, Prisma, EvolutionsMeta } from '@prisma/client'

import { FileEvolution, getEvolutionsForRoot, getHasuraEvolutionsForRoot, readSQLFile } from "./files";
import { assertEvolutionsTable, getEvolutionsFromDatabase } from "./db";
import * as _ from 'lodash';

const APPLYING_UP = 'applying_up';
const APPLYING_DOWN = 'applying_down';
const APPLIED = 'applied';

enum EvolutionsState {
    Valid = 1,
    ErrorUp = 2,
    ErrorDown = 3,
    Bad = 4
}


export class EvolutionsClient {
    private prisma: PrismaClient;

    constructor(private hasura: boolean = false) {
        this.prisma = new PrismaClient();
    }

    async getTable(table: string) {
        console.warn(table);
        return this.prisma.$queryRaw<EvolutionsMeta[]>(Prisma.sql`
            SELECT * FROM ${Prisma.raw(table)} ORDER BY id
        `);
    }

    private async applyUp(schema: string, metaTable: string, fileEv: FileEvolution) {
        console.warn(`APPLYING UP ${fileEv.revision}`)
        await this.prisma.$transaction(async (prisma) => {
            for (const statement of fileEv.upStatements) {
                console.warn('APPLY', statement)
                try {
                    await prisma.$executeRawUnsafe(statement);
                } catch (e) {
                    const message = e.meta?.message || e.message;
                    await this.prisma.$executeRaw(
                        Prisma.sql`
                            UPDATE ${Prisma.raw(`${schema}.${metaTable}`)} 
                            SET last_problem = ${message}
                            WHERE id = ${fileEv.revision}
                        `
                    );

                    throw new Error(message);
                }
            }

            await prisma.$executeRaw(
                Prisma.sql`
                    UPDATE ${Prisma.raw(`${schema}.${metaTable}`)} 
                    SET state = ${APPLIED}
                    WHERE id = ${fileEv.revision}
                `
            )
        });
    }

    async runEvolutionsUp(schema: string, metaTable: string, fileDir: string) {

        const { state } = await this.checkDBState(schema, metaTable);

        if (state !== EvolutionsState.Valid) {
            throw new Error("Invalid database state. Need to repair.")
        }

        const fileEvolutions = this.hasura ? getHasuraEvolutionsForRoot(fileDir) : getEvolutionsForRoot(fileDir);
        const databaseEvolutions = await getEvolutionsFromDatabase(this.prisma, schema, metaTable);

        // if db.length > file
        if (databaseEvolutions.length > fileEvolutions.length) {
            throw new Error("Something is very wrong. More evolutions in DB than on file.");
        }

        // check if db matches
        // assert
        databaseEvolutions.forEach((dbEv, idx) => {
            const fileEv = fileEvolutions[idx];

            if (fileEv.hash !== dbEv.hash) {
                throw new Error(`hashes do not match for evolution ${dbEv.id} ${fileEv.hash} ${dbEv.hash}`)
            }
        });

        // start from last db
        const lastDBIndex = databaseEvolutions.length

        // FOR UPS
        for (const fileEv of fileEvolutions.slice(lastDBIndex)) {
            await this.prisma.$executeRaw(
                Prisma.sql`INSERT INTO ${Prisma.raw(`${schema}.${metaTable}`)}
                (id, hash, applied_at, apply_script, revert_script, state, last_problem)
                values (${fileEv.revision}, ${fileEv.hash}, NOW(), ${fileEv.ups}, ${fileEv.downs}, ${APPLYING_UP}, ${""})`
            );

            await this.applyUp(schema, metaTable, fileEv)
        }
    }


    private async applyDown(schema: string, metaTable: string, id: number, statements: string[]) {
        await this.prisma.$transaction(async (prisma) => {
            for (const statement of statements) {
                console.warn('APPLY', statement)                        
                try {
                    await prisma.$executeRawUnsafe(statement);
                } catch (e) {
                    const message = e.meta?.message || e.message;
                    await this.prisma.$executeRaw(
                        Prisma.sql`
                            UPDATE ${Prisma.raw(`${schema}.${metaTable}`)} 
                            SET last_problem = ${message}
                            WHERE id = ${id}
                        `
                    );

                    throw e;
                }
            }

            await prisma.$executeRaw(
                Prisma.sql`
                    DELETE FROM ${Prisma.raw(`${schema}.${metaTable}`)}
                    WHERE id = ${id}
                `
            )
        });        
    }
    // Note: this uses SQL from the database as opposed to file
    async runEvolutionsDown(schema: string, metaTable: string, revertTo: number) {
        // we don't check file evolutions here because we revert using the db

        await assertEvolutionsTable(this.prisma, schema, metaTable);
        const databaseEvolutions = await getEvolutionsFromDatabase(this.prisma, schema, metaTable);
        const dbEvolutionsToApply = databaseEvolutions.filter((d) => (d.id > revertTo)).reverse()

        for (const dbEv of dbEvolutionsToApply) {
            // applying down
            console.warn(`APPLYING DOWN ${dbEv.id}`)                
            await this.prisma.$executeRaw(
                Prisma.sql`UPDATE ${Prisma.raw(`${schema}.${metaTable}`)}
                SET state = ${APPLYING_DOWN}
                WHERE id = ${dbEv.id};`
            )

            const statements = (dbEv.revert_script || '').split(/(?<!;);(?!;)/).map((l) => (l.trim().replace(/;;/g, ";"))).filter((l) => (l.length > 0))
            await this.applyDown(schema, metaTable, dbEv.id, statements)
        }
    }

    /**
     * Danger
     */
    async checkDBState(schema: string, metaTable: string) {
        await assertEvolutionsTable(this.prisma, schema, metaTable);

        const databaseEvolutions = await getEvolutionsFromDatabase(this.prisma, schema, metaTable);
        const lastOne = databaseEvolutions.slice(-1)[0];
        const notApplied = _.filter(databaseEvolutions, (e) => (e.state !== APPLIED));
        if (notApplied.length === 0) {
            // valid state
            return {
                state: EvolutionsState.Valid,
                lastId: lastOne?.id || 0
            };
        }
        if (notApplied.length > 1) {
            return {
                state: EvolutionsState.Bad,
                lastId: lastOne.id                
            };
        }

        if(lastOne.state === APPLYING_UP) {
            return {
                state: EvolutionsState.ErrorUp,
                lastId: lastOne.id
            };
        } else if (lastOne.state === APPLYING_DOWN) {
            return {
                state: EvolutionsState.ErrorDown,
                lastId: lastOne.id
            };
        } else {
            return {
                state: EvolutionsState.Bad,
                lastId: lastOne.id                
            };
        }
    }

    async clearErrors(schema: string, metaTable: string) {
        const { state, lastId } = await this.checkDBState(schema, metaTable)

        switch(state) {
            case EvolutionsState.Valid:
                console.warn('NO ERRORS TO CLEAR');
                return false;
            case EvolutionsState.ErrorDown:
                console.warn('USE REPAIR-DOWN FUNCTION')
                return false;
            case EvolutionsState.ErrorUp:
                await this.prisma.$executeRaw(Prisma.sql`
                    DELETE FROM ${Prisma.raw(`${schema}.${metaTable}`)}
                    WHERE id = ${lastId}
                `);
                return true;
            default:
                throw new Error("Bad state");
        }
    }

    async repairDown(schema: string, metaTable: string, fileDir: string) {
        const { state, lastId } = await this.checkDBState(schema, metaTable)

        switch(state) {
            case EvolutionsState.Valid:
                console.warn('NO ERRORS TO CLEAR');
                return false;
            case EvolutionsState.ErrorDown:
                // execute for lastId
                const fileEv = readSQLFile(fileDir, `${lastId}.sql`);

                // we will attempt repairing
                await this.prisma.$executeRaw(
                    Prisma.sql`
                        UPDATE ${Prisma.raw(`${schema}.${metaTable}`)}
                        SET hash = ${fileEv.hash},
                            state = ${APPLYING_DOWN},
                            last_problem = '',
                            revert_script = ${fileEv.downs}
                        WHERE id = ${lastId}
                    `
                );
                await this.applyDown(schema, metaTable, lastId, fileEv.downStatements);
                return true;
            case EvolutionsState.ErrorUp:
                console.warn('USE CLEAR-ERROR FUNCTION')
                return false;
            default:
                throw new Error("Bad state");
        }
    }


    /**
     * Lifecycle
     */
    close() {
        this.prisma.$disconnect();
    }

}
