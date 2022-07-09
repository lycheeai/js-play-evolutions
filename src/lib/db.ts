import { PrismaClient, EvolutionsMeta } from '@prisma/client'

export async function getEvolutionsFromDatabase(prisma: PrismaClient, schema: string, metaTable: string) {

    const evolutions = await prisma.$queryRawUnsafe<EvolutionsMeta[]>(
        `SELECT * FROM ${schema}.${metaTable} ORDER BY id`
    );

    return evolutions
}

export async function assertEvolutionsTable(prisma: PrismaClient, schema: string, metaTable: string) {
    // TODO: this could probably go elsewhere
    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS ${schema};`);

    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS ${schema}.${metaTable} (
        id int not null primary key,
        hash varchar(255) not null,
        applied_at timestamp not null,
        apply_script text,
        revert_script text,
        state varchar(255),
        last_problem text
    )`);
}
